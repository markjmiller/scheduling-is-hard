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

  // Create or update guest data
  async updateGuest(guestId: string, eventId: string, updates: Partial<GuestData>): Promise<GuestData> {
    const now = new Date().toISOString();
    
    // Get existing guest data
    const existingGuest = await this.ctx.storage.get<GuestData>(`guest:${guestId}`);
    
    const guestData: GuestData = {
      id: guestId,
      eventId: eventId,
      name: updates.name || existingGuest?.name,
      availability: updates.availability !== undefined ? updates.availability : existingGuest?.availability,
      createdAt: existingGuest?.createdAt || now,
      updatedAt: now
    };

    // Store guest data
    await this.ctx.storage.put(`guest:${guestId}`, guestData);
    
    return guestData;
  }

  // Get guest data
  async getGuest(guestId: string): Promise<GuestData | null> {
    const guestData = await this.ctx.storage.get<GuestData>(`guest:${guestId}`);
    return guestData || null;
  }

  // Update guest availability
  async updateAvailability(guestId: string, availability: string[]): Promise<GuestData> {
    const existingGuest = await this.ctx.storage.get<GuestData>(`guest:${guestId}`);
    
    if (!existingGuest) {
      throw new Error('Guest not found');
    }

    const updatedGuest: GuestData = {
      ...existingGuest,
      availability,
      updatedAt: new Date().toISOString()
    };

    await this.ctx.storage.put(`guest:${guestId}`, updatedGuest);
    
    return updatedGuest;
  }

  // Update guest name
  async updateName(guestId: string, name: string): Promise<GuestData> {
    const existingGuest = await this.ctx.storage.get<GuestData>(`guest:${guestId}`);
    
    if (!existingGuest) {
      throw new Error('Guest not found');
    }

    const updatedGuest: GuestData = {
      ...existingGuest,
      name,
      updatedAt: new Date().toISOString()
    };

    await this.ctx.storage.put(`guest:${guestId}`, updatedGuest);
    
    return updatedGuest;
  }

  // Delete guest data
  async deleteGuest(guestId: string): Promise<void> {
    await this.ctx.storage.delete(`guest:${guestId}`);
  }
}
