import { DurableObject } from "cloudflare:workers";
import type { components } from "../../types/api";

type EventType = components["schemas"]["Event"];
type CreateEventRequest = components["schemas"]["CreateEventRequest"];
type GuestLink = components["schemas"]["GuestLink"];
type GuestData = components["schemas"]["Guest"] & {
  createdAt: string;
  updatedAt: string;
  availability?: string[];
};

interface EventData {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  hostGuestId?: string;
}

export class Event extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  private async getId(): Promise<string> {
    const id = await this.ctx.storage.get<string>('id');
    if (!id) {
      throw new Error('ID not set');
    }
    return id;
  }

  // Generate random 8-character alphanumeric ID
  private generateId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async init(eventId: string, request: CreateEventRequest): Promise<EventType & { hostGuestId: string }> {
    await this.ctx.storage.put('id', eventId);
    
    const now = new Date().toISOString();
    
    const hostGuestId = this.generateId();
    
    const eventData: EventData = {
      id: eventId,
      name: request.name,
      description: request.description,
      createdAt: now,
      updatedAt: now,
      hostGuestId: hostGuestId
    };

    await this.ctx.storage.put('eventData', eventData);
    
    const hostGuestDO = this.env.GUEST.get(this.env.GUEST.idFromName(hostGuestId));
    await hostGuestDO.init(hostGuestId, eventId);
    await hostGuestDO.update({
      name: request.hostName
    });
    
    const hostGuestData: GuestData = {
      id: hostGuestId,
      name: request.hostName,
      createdAt: now,
      updatedAt: now,
      // availability is undefined initially (host hasn't responded yet)
    };
    
    await this.ctx.storage.put('guests', { [hostGuestId]: hostGuestData });

    return {
      id: eventId,
      name: eventData.name,
      description: eventData.description,
      url: `/event/${eventId}`,
      createdAt: eventData.createdAt,
      updatedAt: eventData.updatedAt,
      hostGuestId: hostGuestId
    } as EventType & { hostGuestId: string };
  }

  async get(): Promise<EventType | null> {
    const eventData = await this.ctx.storage.get<EventData>('eventData');
    
    if (!eventData) {
      return null;
    }

    return {
      id: eventData.id,
      name: eventData.name,
      description: eventData.description,
      url: `/event/${await this.getId()}`,
      createdAt: eventData.createdAt,
      updatedAt: eventData.updatedAt,
      hostGuestId: eventData.hostGuestId
    } as EventType & { hostGuestId?: string };
  }

  async update(request: { name?: string; description?: string }): Promise<EventType | null> {
    const eventData = await this.ctx.storage.get<EventData>('eventData');
    
    if (!eventData) {
      return null;
    }

    const updatedEventData: EventData = {
      ...eventData,
      updatedAt: new Date().toISOString()
    };

    if (request.name !== undefined) {
      updatedEventData.name = request.name;
    }

    if (request.description !== undefined) {
      updatedEventData.description = request.description;
    }

    await this.ctx.storage.put('eventData', updatedEventData);

    return {
      id: updatedEventData.id,
      name: updatedEventData.name,
      description: updatedEventData.description,
      url: `/event/${await this.getId()}`,
      createdAt: updatedEventData.createdAt,
      updatedAt: updatedEventData.updatedAt,
      hostGuestId: updatedEventData.hostGuestId
    } as EventType;
  }

  async generateGuestLink(guestName?: string): Promise<GuestLink> {
    const eventData = await this.ctx.storage.get<EventData>('eventData');
    
    if (!eventData) {
      throw new Error('Event not found');
    }

    const eventId = await this.getId();
    const guestId = this.generateId();
    const now = new Date().toISOString();
    
    const guestData: GuestData = {
      id: guestId,
      name: guestName,
      availability: undefined,
      createdAt: now,
      updatedAt: now
    };

    // Only store guest ID in Event storage (not full guest data)
    const guestList = await this.ctx.storage.get<Record<string, boolean>>('guests') || {};
    guestList[guestId] = true;
    await this.ctx.storage.put('guests', guestList);

    // Store full guest data in Guest DO
    const guestDOId = this.env.GUEST.idFromName(guestId);
    const guestDO = this.env.GUEST.get(guestDOId);
    await guestDO.init(guestId, eventId);
    await guestDO.update(guestData);

    return {
      guestId: guestId,
      url: `/event/${eventId}/guest/${guestId}`
    };
  }

  // Get all guests for an event
  async getEventGuests(): Promise<GuestData[]> {
    const guestList = await this.ctx.storage.get<Record<string, boolean>>('guests') || {};
    const guestIds = Object.keys(guestList);
    
    const guests: GuestData[] = [];
    for (const guestId of guestIds) {
      const guestDOId = this.env.GUEST.idFromName(guestId);
      const guestDO = this.env.GUEST.get(guestDOId);
      const guestData = await guestDO.get();
      if (guestData) {
        guests.push(guestData);
      }
    }
    
    return guests;
  }

  // Remove guest from event
  async removeGuest(guestId: string): Promise<void> {
    const guestList = await this.ctx.storage.get<Record<string, boolean>>('guests') || {};
    
    if (guestList[guestId]) {
      delete guestList[guestId];
      await this.ctx.storage.put('guests', guestList);
    }
  }
}
