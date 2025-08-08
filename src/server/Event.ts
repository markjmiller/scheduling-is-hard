import { DurableObject } from "cloudflare:workers";
import type { components } from "../../types/api";

type EventType = components["schemas"]["Event"];
type CreateEventRequest = components["schemas"]["CreateEventRequest"];
type GuestLink = components["schemas"]["GuestLink"];

interface EventData {
  id: string;
  name: string;
  description: string;
  expectedAttendees: number | "unknown";
  createdAt: string;
  updatedAt: string;
  hostGuestId?: string;
}

interface GuestData {
  id: string;
  eventId: string;
  name?: string;
  availability?: string[];
  createdAt: string;
  updatedAt: string;
}

interface EventAvailability {
  heatmap: Record<string, number>;
  totalGuests: number;
  respondedGuests: number;
}

export class Event extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  // Alarm handler - polls Guest DOs and updates aggregate availability
  async alarm(): Promise<void> {
    try {
      // Get all events this DO manages
      const eventKeys = await this.ctx.storage.list({ prefix: 'event:', limit: 100 });
      
      for (const [key, _eventData] of eventKeys) {
        if (key.endsWith(':guests') || key.endsWith(':availability_cache')) continue;
        
        const eventId = key.replace('event:', '');
        await this.updateAggregateAvailability(eventId);
      }
      
      // Set next alarm for 5 seconds
      await this.ctx.storage.setAlarm(Date.now() + 5000);
    } catch (error) {
      console.error('Event DO alarm error:', error);
      // Retry in 60 seconds on error
      await this.ctx.storage.setAlarm(Date.now() + 60000);
    }
  }

  // Update aggregate availability by polling all Guest DOs
  async updateAggregateAvailability(eventId: string): Promise<void> {
    const guestList = await this.ctx.storage.get<Record<string, boolean>>(`event:${eventId}:guests`) || {};
    const guestIds = Object.keys(guestList);
    
    if (guestIds.length === 0) {
      return;
    }

    const heatmap: Record<string, number> = {};
    let totalGuests = guestIds.length;
    let respondedGuests = 0;

    // Poll each Guest DO for availability
    for (const guestId of guestIds) {
      try {
        const guestDO = this.env.GUEST.get(this.env.GUEST.idFromName(guestId));
        const guestData = await guestDO.getGuest(guestId);
        
        if (guestData?.availability !== undefined) {
          respondedGuests++;
          
          // Process availability array (either dates or empty array for "not available")
          if (Array.isArray(guestData.availability)) {
            for (const date of guestData.availability) {
              heatmap[date] = (heatmap[date] || 0) + 1;
            }
          }
        }
      } catch (error) {
        console.error(`Error polling Guest DO ${guestId}:`, error);
      }
    }

    // Convert counts to normalized 0-1 scale for heatmap
    const normalizedHeatmap: Record<string, number> = {};
    for (const [date, count] of Object.entries(heatmap)) {
      normalizedHeatmap[date] = respondedGuests > 0 ? count / respondedGuests : 0;
    }

    // Update cache
    await this.ctx.storage.put(`event:${eventId}:availability_cache`, {
      heatmap: normalizedHeatmap,
      totalGuests,
      respondedGuests,
      lastUpdated: new Date().toISOString()
    });
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

  // Create a new event
  async createEvent(eventId: string, request: CreateEventRequest): Promise<EventType & { hostGuestId: string }> {
    const now = new Date().toISOString();
    
    // Create host guest ID
    const hostGuestId = this.generateId();
    
    const eventData: EventData = {
      id: eventId,
      name: request.name,
      description: request.description,
      expectedAttendees: request.expectedAttendees || "unknown",
      createdAt: now,
      updatedAt: now,
      hostGuestId: hostGuestId
    };

    // Store event data
    await this.ctx.storage.put(`event:${eventId}`, eventData);
    
    // Initialize guests list with host guest ID
    await this.ctx.storage.put(`event:${eventId}:guests`, { [hostGuestId]: true });
    
    // ✅ CRITICAL FIX: Create Guest DO for the host
    console.log(`🏠 [EVENT] Creating Guest DO for host: ${hostGuestId}`);
    const hostGuestDO = this.env.GUEST.get(this.env.GUEST.idFromName(hostGuestId));
    await hostGuestDO.updateGuest(hostGuestId, eventId, {
      name: "Host" // Default host name
    });
    console.log(`✅ [EVENT] Host Guest DO created successfully: ${hostGuestId}`);
    
    // Initialize empty aggregate availability cache
    await this.ctx.storage.put(`event:${eventId}:availability_cache`, {
      heatmap: {},
      totalGuests: 0,
      respondedGuests: 0,
      lastUpdated: now
    });
    
    // Set up alarm to poll Guest DOs for availability updates every 30 seconds
    await this.ctx.storage.setAlarm(Date.now() + 10000);

    return {
      id: eventId,
      name: eventData.name,
      description: eventData.description,
      expectedAttendees: eventData.expectedAttendees,
      url: `/event/${eventId}`,
      createdAt: eventData.createdAt,
      updatedAt: eventData.updatedAt,
      hostGuestId: hostGuestId
    } as EventType & { hostGuestId: string };
  }

  // Get event details
  async getEvent(eventId: string): Promise<EventType | null> {
    const eventData = await this.ctx.storage.get<EventData>(`event:${eventId}`);
    
    if (!eventData) {
      return null;
    }

    return {
      id: eventData.id,
      name: eventData.name,
      description: eventData.description,
      expectedAttendees: eventData.expectedAttendees,
      url: `/event/${eventId}`,
      createdAt: eventData.createdAt,
      updatedAt: eventData.updatedAt,
      hostGuestId: eventData.hostGuestId
    } as EventType & { hostGuestId?: string };
  }

  // Generate a guest link for an event
  async generateGuestLink(eventId: string, guestName?: string): Promise<GuestLink> {
    const eventData = await this.ctx.storage.get<EventData>(`event:${eventId}`);
    
    if (!eventData) {
      throw new Error('Event not found');
    }

    const guestId = this.generateId();
    const now = new Date().toISOString();
    
    const guestData: GuestData = {
      id: guestId,
      eventId: eventId,
      name: guestName,
      availability: undefined,
      createdAt: now,
      updatedAt: now
    };

    // Get current guests and add new guest
    const guests = await this.ctx.storage.get<Record<string, GuestData>>(`event:${eventId}:guests`) || {};
    guests[guestId] = guestData;
    await this.ctx.storage.put(`event:${eventId}:guests`, guests);

    return {
      guestId: guestId,
      url: `/event/${eventId}/guest/${guestId}`
    };
  }

  // Get guest details
  async getGuest(eventId: string, guestId: string): Promise<GuestData | null> {
    const guests = await this.ctx.storage.get<Record<string, GuestData>>(`event:${eventId}:guests`);
    
    if (!guests || !guests[guestId]) {
      return null;
    }

    return guests[guestId];
  }

  // Update guest name
  async updateGuestName(eventId: string, guestId: string, name: string): Promise<void> {
    const guests = await this.ctx.storage.get<Record<string, GuestData>>(`event:${eventId}:guests`);
    
    if (!guests || !guests[guestId]) {
      throw new Error('Guest not found');
    }

    guests[guestId].name = name;
    guests[guestId].updatedAt = new Date().toISOString();
    
    await this.ctx.storage.put(`event:${eventId}:guests`, guests);
  }

  // Update guest availability
  async updateGuestAvailability(eventId: string, guestId: string, availability: string[]): Promise<void> {
    const guests = await this.ctx.storage.get<Record<string, GuestData>>(`event:${eventId}:guests`);
    
    if (!guests || !guests[guestId]) {
      throw new Error('Guest not found');
    }

    guests[guestId].availability = availability;
    guests[guestId].updatedAt = new Date().toISOString();
    
    await this.ctx.storage.put(`event:${eventId}:guests`, guests);
  }

  // Get cached availability heatmap from alarm system
  async getEventAvailability(eventId: string): Promise<EventAvailability> {
    const eventData = await this.ctx.storage.get<EventData>(`event:${eventId}`);
    
    if (!eventData) {
      throw new Error('Event not found');
    }

    // Get cached availability data from alarm system
    const cachedAvailability = await this.ctx.storage.get<{
      heatmap: Record<string, number>;
      totalGuests: number;
      respondedGuests: number;
      lastUpdated: string;
    }>(`event:${eventId}:availability_cache`);

    if (cachedAvailability) {
      // Return cached data from real-time alarm system
      return {
        heatmap: cachedAvailability.heatmap,
        totalGuests: cachedAvailability.totalGuests,
        respondedGuests: cachedAvailability.respondedGuests
      };
    }

    // Fallback: If no cached data exists yet, trigger immediate update
    await this.updateAggregateAvailability(eventId);
    
    // Get the newly created cache
    const freshCache = await this.ctx.storage.get<{
      heatmap: Record<string, number>;
      totalGuests: number;
      respondedGuests: number;
      lastUpdated: string;
    }>(`event:${eventId}:availability_cache`);

    return {
      heatmap: freshCache?.heatmap || {},
      totalGuests: freshCache?.totalGuests || 0,
      respondedGuests: freshCache?.respondedGuests || 0
    };
  }

  // Get all guests for an event
  async getEventGuests(eventId: string): Promise<GuestData[]> {
    const guests = await this.ctx.storage.get<Record<string, GuestData>>(`event:${eventId}:guests`) || {};
    return Object.values(guests);
  }
}
