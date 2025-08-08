import { Hono } from 'hono';
import { prettyJSON } from "hono/pretty-json";
import { validator } from "hono/validator";
import type { components } from "../../types/api";
import { Event } from "./Event";
import { Guest } from "./Guest";

function isValidId(value: string): boolean {
  return value.match(/^[0-9a-zA-Z]{8}$/g) !== null;
}

// Generate random 8-character alphanumeric ID
function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

declare module "hono" {
  interface ContextVariableMap {
    event: DurableObjectStub<Event>;
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

// Helper function to get Event Durable Object for specific eventId
function getEvent(env: Cloudflare.Env, eventId: string) {
  const id = env.EVENT.idFromName(eventId);
  return env.EVENT.get(id);
}

function getGuest(env: Cloudflare.Env, guestId: string) {
  const id = env.GUEST.idFromName(guestId);
  return env.GUEST.get(id);
}

// Event endpoints
api.post('/events', 
  validator('json', (value, c) => {
    const data = value as components['schemas']['CreateEventRequest'];
    if (!data.name || !data.description) {
      return c.text('Invalid event data', 400);
    }
    return data;
  }),
  async (c) => {
    const eventData = c.req.valid('json');
    
    // Generate eventId first, then get the specific Event DO
    const eventId = generateId();
    const eventDO = getEvent(c.env, eventId);
    
    const event = await eventDO.createEvent(eventId, eventData);
    return c.json(event);
  }
);

api.get('/events/:eventId', 
  validator('param', (value, c) => {
    if (!isValidId(value.eventId)) {
      return c.text('Invalid event ID', 400);
    }
    return value;
  }),
  async (c) => {
    const { eventId } = c.req.valid('param');
    const eventDO = getEvent(c.env, eventId);
    
    const event = await eventDO.getEvent(eventId);
    
    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }
    
    return c.json(event);
  }
);

// Guest link generation
api.post('/events/:eventId/guests',
  validator('param', (value, c) => {
    if (!isValidId(value.eventId)) {
      return c.text('Invalid event ID', 400);
    }
    return value;
  }),
  validator('json', (value) => {
    const data = value as { guestName?: string };
    return data;
  }),
  async (c) => {
    const { eventId } = c.req.valid('param');
    const { guestName } = c.req.valid('json');
    const eventDO = getEvent(c.env, eventId);
    
    try {
      // Generate guest link via Event DO
      const guestLink = await eventDO.generateGuestLink(eventId, guestName);
      return c.json(guestLink);
    } catch (error) {
      return c.json({ error: 'Failed to generate guest link' }, 400);
    }
  }
);

// Get guest details
api.get('/events/:eventId/guests/:guestId',
  validator('param', (value, c) => {
    if (!isValidId(value.eventId) || !isValidId(value.guestId)) {
      return c.text('Invalid ID format', 400);
    }
    return value;
  }),
  async (c) => {
    const { guestId } = c.req.valid('param');
    
    try {
      const guestDO = getGuest(c.env, guestId);
      const guest = await guestDO.getGuest(guestId);
      
      if (!guest) {
        return c.json({ error: 'Guest not found' }, 404);
      }
      
      return c.json(guest);
    } catch (error) {
      console.error(`Failed to get guest ${guestId}:`, error);
      return c.json({ error: 'Failed to get guest' }, 400);
    }
  }
);

// Update guest name
api.put('/events/:eventId/guests/:guestId/name',
  validator('param', (value, c) => {
    if (!isValidId(value.eventId) || !isValidId(value.guestId)) {
      return c.text('Invalid ID format', 400);
    }
    return value;
  }),
  validator('json', (value, c) => {
    const data = value as { name: string };
    if (!data.name || !data.name.trim()) {
      return c.text('Name is required', 400);
    }
    return data;
  }),
  async (c) => {
    const { eventId, guestId } = c.req.valid('param');
    const { name } = c.req.valid('json');
    const eventDO = getEvent(c.env, eventId);
    
    try {
      await eventDO.updateGuestName(eventId, guestId, name.trim());
      return c.json({ success: true });
    } catch (error) {
      return c.json({ error: 'Failed to update guest name' }, 400);
    }
  }
);

// Update guest availability
api.put('/events/:eventId/guests/:guestId/availability',
  validator('param', (value, c) => {
    if (!isValidId(value.eventId) || !isValidId(value.guestId)) {
      return c.text('Invalid ID format', 400);
    }
    return value;
  }),
  validator('json', (value, c) => {
    const data = value as { availability: string[] };
    if (!Array.isArray(data.availability)) {
      return c.text('Availability must be an array', 400);
    }
    return data;
  }),
  async (c) => {
    const { guestId } = c.req.valid('param');
    const { availability } = c.req.valid('json');
    
    const guestDO = getGuest(c.env, guestId);
    
    try {
      await guestDO.updateAvailability(guestId, availability);
      return c.json({ success: true });
    } catch (error) {
      console.error(`Failed to update availability for guest ${guestId}:`, error);
      return c.json({ error: 'Failed to update availability' }, 400);
    }
  }
);

// Get event availability heatmap
api.get('/events/:eventId/availability',
  validator('param', (value, c) => {
    if (!isValidId(value.eventId)) {
      return c.text('Invalid event ID', 400);
    }
    return value;
  }),
  async (c) => {
    const { eventId } = c.req.valid('param');
    const eventDO = getEvent(c.env, eventId);
    
    try {
      const availability = await eventDO.getEventAvailability(eventId);
      return c.json(availability);
    } catch (error) {
      return c.json({ error: 'Failed to get availability' }, 400);
    }
  }
);

app.route("/api", api);

export { Event, Guest };
export default app;
