import { Hono } from "hono";
import { prettyJSON } from "hono/pretty-json";
import { validator } from "hono/validator";
import type { components } from "../../types/api";
import { Event } from "./Event";
import { Guest } from "./Guest";
import { generateEventId } from "./utils/id";
import { validateTurnstile } from "./utils/validate-turnstile";
import { getConnInfo } from "hono/cloudflare-workers";

function isValidId(value: string): boolean {
  // Match event IDs (e + 7 chars) or guest IDs (g + 7 chars) = 8 chars total
  return value.match(/^[eg][0-9a-zA-Z]{7}$/g) !== null;
}

declare module "hono" {
  interface ContextVariableMap {
    event: DurableObjectStub<Event>;
    guest: DurableObjectStub<Guest>;
  }
}

const app = new Hono<{ Bindings: Cloudflare.Env }>();
app.use(prettyJSON());
app.notFound((c) => c.json({ message: "Not Found", ok: false }, 404));
app.get("/", async (c) =>
  c.env.ASSETS.fetch("https://assets.local/index.html"),
);
app.get("/docs", async (c) =>
  c.env.ASSETS.fetch("https://assets.local/docs/openapi.html"),
);

const api = new Hono<{ Bindings: Cloudflare.Env }>();

// Turnstile token verification middleware
api.use("*", async (c, next) => {
  const token = c.req.header("X-Turnstile-Token");

  if (!token) {
    return c.json(
      {
        error: "UNAUTHORIZED",
        message: "Turnstile token is required",
      },
      401,
    );
  }

  const isValid = await validateTurnstile(
    token,
    getConnInfo(c).remote.address,
    c.env,
  );

  if (!isValid) {
    return c.json(
      {
        error: "UNAUTHORIZED",
        message: "Invalid Turnstile token",
      },
      401,
    );
  }

  // Token is valid, continue to the next handler
  await next();
});

function getEvent(
  env: Cloudflare.Env,
  eventId: string,
): DurableObjectStub<Event> {
  const id = env.EVENT.idFromName(eventId);
  return env.EVENT.get(id);
}

function getGuest(
  env: Cloudflare.Env,
  guestId: string,
): DurableObjectStub<Guest> {
  const id = env.GUEST.idFromName(guestId);
  return env.GUEST.get(id);
}

api.post(
  "/events",
  validator("json", (value, c) => {
    const data = value as components["schemas"]["CreateEventRequest"];
    if (!data.name || !data.description) {
      return c.text("Invalid event data", 400);
    }
    return data;
  }),
  async (c) => {
    const eventData = c.req.valid("json");

    // Generate eventId first, then get the specific Event DO
    const eventId = generateEventId();
    const eventDO = getEvent(c.env, eventId);

    const event = await eventDO.init(eventId, eventData);
    return c.json(event);
  },
);

api.get(
  "/events/:eventId",
  validator("param", (value, c) => {
    if (!isValidId(value.eventId)) {
      return c.text("Invalid event ID", 400);
    }
    return value;
  }),
  async (c) => {
    const { eventId } = c.req.valid("param");
    const eventDO = getEvent(c.env, eventId);

    const event = await eventDO.get();

    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    return c.json(event);
  },
);

api.put(
  "/events/:eventId",
  validator("param", (value, c) => {
    if (!isValidId(value.eventId)) {
      return c.text("Invalid event ID", 400);
    }
    return value;
  }),
  validator("json", (value) => {
    const data = value as { name?: string; description?: string };

    if (data.name !== undefined && (!data.name || data.name.length > 200)) {
      throw new Error("Name must be non-empty and under 200 characters");
    }

    if (data.description !== undefined && data.description.length > 2000) {
      throw new Error("Description must be under 2000 characters");
    }
    return data;
  }),
  async (c) => {
    const { eventId } = c.req.valid("param");
    const updateData = c.req.valid("json");

    const eventDO = getEvent(c.env, eventId);
    const updatedEvent = await eventDO.update(updateData);

    if (!updatedEvent) {
      return c.json({ error: "Event not found" }, 404);
    }

    return c.json(updatedEvent);
  },
);

api.post(
  "/events/:eventId/guests",
  validator("param", (value, c) => {
    if (!isValidId(value.eventId)) {
      return c.text("Invalid event ID", 400);
    }
    return value;
  }),
  validator("json", (value) => {
    const data = value as { guestName?: string };
    return data;
  }),
  async (c) => {
    const { eventId } = c.req.valid("param");
    const { guestName } = c.req.valid("json");
    const eventDO = getEvent(c.env, eventId);

    try {
      // Generate guest link via Event DO
      const guestLink = await eventDO.generateGuestLink(guestName);
      return c.json(guestLink);
    } catch (error) {
      return c.json({ error: "Failed to generate guest link" }, 400);
    }
  },
);

api.get(
  "/events/:eventId/availability",
  validator("param", (value, c) => {
    if (!isValidId(value.eventId)) {
      return c.text("Invalid event ID", 400);
    }
    return value;
  }),
  async (c) => {
    const { eventId } = c.req.valid("param");
    const eventDO = getEvent(c.env, eventId);

    try {
      const event = await eventDO.get();
      const guests = await eventDO.getEventGuests();

      // Transform guests to include host status and response status
      const guestsWithStatus = guests.map((guest) => ({
        id: guest.id,
        name: guest.name || "",
        availability: guest.availability || [],
        isHost: guest.id === event?.hostGuestId,
        hasResponded:
          guest.availability !== undefined && guest.availability !== null,
      }));

      const respondedGuests = guestsWithStatus.filter(
        (g) => g.hasResponded,
      ).length;

      return c.json({
        totalGuests: guestsWithStatus.length,
        respondedGuests: respondedGuests,
        guests: guestsWithStatus,
      });
    } catch (error) {
      return c.json({ error: "Failed to get availability" }, 400);
    }
  },
);

api.get(
  "/guests/:guestId",
  validator("param", (value, c) => {
    if (!isValidId(value.guestId)) {
      return c.text("Invalid guest ID", 400);
    }
    return value;
  }),
  async (c) => {
    const { guestId } = c.req.valid("param");

    try {
      const guestDO = getGuest(c.env, guestId);
      const guest = await guestDO.get();

      if (!guest) {
        return c.json({ error: "Guest not found" }, 404);
      }

      return c.json(guest);
    } catch (error) {
      console.error(`Failed to get guest ${guestId}:`, error);
      return c.json({ error: "Failed to get guest data" }, 500);
    }
  },
);

api.put(
  "/guests/:guestId/name",
  validator("param", (value, c) => {
    if (!isValidId(value.guestId)) {
      return c.text("Invalid guest ID", 400);
    }
    return value;
  }),
  validator("json", (value, c) => {
    const data = value as any;
    if (
      !data.name ||
      typeof data.name !== "string" ||
      data.name.trim().length === 0
    ) {
      return c.json({ error: "Name is required" }, 400);
    }
    return data;
  }),
  async (c) => {
    const { guestId } = c.req.valid("param");
    const { name } = c.req.valid("json");

    try {
      const guestDO = getGuest(c.env, guestId);
      const guestData = await guestDO.get();

      if (!guestData) {
        return c.json({ error: "Guest not found" }, 404);
      }

      const updatedGuest = await guestDO.update({ name: name.trim() });

      return c.json(updatedGuest);
    } catch (error) {
      console.error(`Failed to update name for guest ${guestId}:`, error);
      return c.json({ error: "Failed to update guest name" }, 500);
    }
  },
);

api.put(
  "/guests/:guestId/availability",
  validator("param", (value, c) => {
    if (!isValidId(value.guestId)) {
      return c.text("Invalid guest ID", 400);
    }
    return value;
  }),
  validator("json", (value, c) => {
    const data = value as any;
    if (!Array.isArray(data.availability)) {
      return c.json({ error: "Availability must be an array" }, 400);
    }
    return data;
  }),
  async (c) => {
    const { guestId } = c.req.valid("param");
    const { availability } = c.req.valid("json");

    try {
      const guestDO = getGuest(c.env, guestId);
      const guestData = await guestDO.get();

      if (!guestData) {
        return c.json({ error: "Guest not found" }, 404);
      }

      const updatedGuest = await guestDO.update({ availability });

      return c.json(updatedGuest);
    } catch (error) {
      console.error(
        `Failed to update availability for guest ${guestId}:`,
        error,
      );
      return c.json({ error: "Failed to update availability" }, 400);
    }
  },
);

api.get(
  "guests/:guestId/event",
  validator("param", (value, c) => {
    if (!isValidId(value.guestId)) {
      return c.text("Invalid guest ID", 400);
    }
    return value;
  }),
  async (c) => {
    const { guestId } = c.req.valid("param");
    const guestDO = getGuest(c.env, guestId);

    try {
      const eventId = await guestDO.getEventId();
      const eventDO = getEvent(c.env, eventId);
      const event = await eventDO.get();
      const guests = await eventDO.getEventGuests();

      // Transform guests to include host status and response status
      const guestsWithStatus = guests.map((guest) => ({
        id: guest.id,
        name: guest.name || "",
        availability: guest.availability || [],
        isHost: guest.id === event?.hostGuestId,
        hasResponded:
          guest.availability !== undefined && guest.availability !== null,
      }));

      const respondedGuests = guestsWithStatus.filter(
        (g) => g.hasResponded,
      ).length;

      // Return event info and detailed guest availability data
      return c.json({
        name: event!.name,
        description: event!.description,
        totalGuests: guestsWithStatus.length,
        respondedGuests: respondedGuests,
        guests: guestsWithStatus,
      });
    } catch (error) {
      return c.json({ error: "Failed to get availability" }, 400);
    }
  },
);

api.get(
  "/events/:eventId/guests",
  validator("param", (value, c) => {
    if (!isValidId(value.eventId)) {
      return c.text("Invalid event ID", 400);
    }
    return value;
  }),
  async (c) => {
    const { eventId } = c.req.valid("param");
    const eventDO = getEvent(c.env, eventId);

    try {
      const guests = await eventDO.getEventGuests();

      // Transform guests to include hasResponded status
      const guestsWithStatus = guests.map((guest) => ({
        ...guest,
        hasResponded:
          guest.availability !== undefined && guest.availability !== null,
      }));

      return c.json(guestsWithStatus);
    } catch (error) {
      console.error(`Failed to get guests for event ${eventId}:`, error);
      return c.json({ error: "Failed to get event guests" }, 500);
    }
  },
);

api.delete(
  "/events/:eventId/guests/:guestId",
  validator("param", (value, c) => {
    if (!isValidId(value.eventId)) {
      return c.text("Invalid event ID", 400);
    }
    if (!isValidId(value.guestId)) {
      return c.text("Invalid guest ID", 400);
    }
    return value;
  }),
  async (c) => {
    const { guestId } = c.req.valid("param");

    try {
      const guestDO = getGuest(c.env, guestId);
      const guestData = await guestDO.get();
      const eventId = await guestDO.getEventId();

      if (!guestData) {
        return c.json({ error: "Guest not found" }, 404);
      }

      const eventDO = getEvent(c.env, eventId);
      await eventDO.removeGuest(guestData.id);

      await guestDO.delete();

      return c.json({ message: "Guest deleted successfully" });
    } catch (error) {
      console.error(`Failed to delete guest ${guestId}:`, error);
      return c.json({ error: "Failed to delete guest" }, 500);
    }
  },
);

app.route("/api", api);

export { Event, Guest };
export default app;
