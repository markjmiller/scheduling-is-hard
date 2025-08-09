import { DurableObject } from "cloudflare:workers";
import type { components } from "../../types/api";

type GuestData = components["schemas"]["Guest"] & {
  createdAt: string;
  updatedAt: string;
  availability?: string[];
};

export class Guest extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async init(guestId: string, eventId: string): Promise<void> {
    await this.ctx.storage.put("id", guestId);
    await this.ctx.storage.put("eventId", eventId);
  }

  private async getId(): Promise<string> {
    const id = await this.ctx.storage.get<string>("id");
    if (!id) {
      throw new Error("ID not set");
    }
    return id;
  }

  public async getEventId(): Promise<string> {
    const eventId = await this.ctx.storage.get<string>("eventId");
    if (!eventId) {
      throw new Error("Event ID not set");
    }
    return eventId;
  }

  async update(updates: Partial<GuestData>): Promise<GuestData> {
    const now = new Date().toISOString();

    const existingGuest = await this.ctx.storage.get<GuestData>("guestData");

    const guestData: GuestData = {
      id: await this.getId(),
      name: updates.name || existingGuest?.name,
      availability:
        updates.availability !== undefined
          ? updates.availability
          : existingGuest?.availability,
      createdAt: existingGuest?.createdAt || now,
      updatedAt: now,
    };

    await this.ctx.storage.put("guestData", guestData);

    return guestData;
  }

  async get(): Promise<GuestData | null> {
    const guestData = await this.ctx.storage.get<GuestData>("guestData");
    return guestData || null;
  }

  async updateAvailability(availability: string[]): Promise<GuestData> {
    const existingGuest = await this.ctx.storage.get<GuestData>("guestData");

    if (!existingGuest) {
      throw new Error("Guest not found");
    }

    const updatedGuest: GuestData = {
      ...existingGuest,
      availability,
      updatedAt: new Date().toISOString(),
    };

    await this.ctx.storage.put("guestData", updatedGuest);

    return updatedGuest;
  }

  async updateName(name: string): Promise<GuestData> {
    const existingGuest = await this.ctx.storage.get<GuestData>("guestData");

    if (!existingGuest) {
      throw new Error("Guest not found");
    }

    const updatedGuest: GuestData = {
      ...existingGuest,
      name,
      updatedAt: new Date().toISOString(),
    };

    await this.ctx.storage.put("guestData", updatedGuest);

    return updatedGuest;
  }

  async delete(): Promise<void> {
    await this.ctx.storage.delete("guestData");
  }
}
