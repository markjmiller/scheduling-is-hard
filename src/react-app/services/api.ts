// Stubbed API service for frontend development
import type { components } from "../../../types/api";

type Event = components["schemas"]["Event"];
type CreateEventRequest = components["schemas"]["CreateEventRequest"];
type GuestLink = components["schemas"]["GuestLink"];
type BaseGuest = components["schemas"]["Guest"];

// Extended guest interface with availability for frontend use
interface Guest extends BaseGuest {
  availability?: string[];
}

interface EventAvailability {
  heatmap: Record<string, number>;
  totalGuests: number;
  respondedGuests: number;
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

// Simulate API delay
function delay(ms: number = 500): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class ApiService {

  // Stubbed: Create a new event
  static async createEvent(eventData: CreateEventRequest): Promise<Event> {
    await delay();
    
    const event: Event = {
      id: generateId(),
      name: eventData.name,
      description: eventData.description,
      expectedAttendees: eventData.expectedAttendees,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('🔄 [STUBBED] Creating event:', event);
    return event;
  }

  // Stubbed: Get event details
  static async getEvent(eventId: string): Promise<Event> {
    await delay();
    
    const event: Event = {
      id: eventId,
      name: "Sample Event",
      description: "This is a stubbed event for UI development",
      expectedAttendees: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('🔄 [STUBBED] Getting event:', event);
    return event;
  }

  // Stubbed: Generate guest link
  static async generateGuestLink(eventId: string, guestName?: string): Promise<GuestLink> {
    await delay();
    
    const guestId = generateId();
    const guestLink: GuestLink = {
      guestId,
      url: `/event/${eventId}/guest/${guestId}`,
    };

    console.log('🔄 [STUBBED] Generating guest link:', guestLink, guestName ? `for ${guestName}` : '');
    return guestLink;
  }

  // Stubbed: Get guest details
  static async getGuest(eventId: string, guestId: string): Promise<Guest> {
    await delay();
    
    const guest: Guest = {
      id: guestId,
      eventId: eventId,
      name: Math.random() > 0.5 ? 'Sample Guest' : '', // Sometimes no name provided
      availability: Math.random() > 0.5 ? ['2024-08-08', '2024-08-09', '2024-08-10'] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('🔄 [STUBBED] Getting guest:', guest);
    return guest;
  }

  // Stubbed: Get event availability heatmap
  static async getEventAvailability(eventId: string): Promise<EventAvailability> {
    await delay();
    
    // Generate sample heatmap data for the next 30 days
    const heatmap: Record<string, number> = {};
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      // Random availability between 0 and 1
      heatmap[dateStr] = Math.random();
    }

    const availability: EventAvailability = {
      heatmap,
      totalGuests: 5,
      respondedGuests: 3,
    };

    console.log('🔄 [STUBBED] Getting event availability:', availability);
    return availability;
  }

  // Stubbed: Update guest name
  static async updateGuestName(eventId: string, guestId: string, name: string): Promise<void> {
    await delay();
    console.log('🔄 [STUBBED] Updating guest name:', { eventId, guestId, name });
  }

  // Stubbed: Update guest availability
  static async updateGuestAvailability(eventId: string, guestId: string, availability: string[]): Promise<void> {
    await delay();
    console.log('🔄 [STUBBED] Updating guest availability:', { eventId, guestId, availability });
  }

  // Future: Real API calls would go here
  // static async realCreateEvent(eventData: CreateEventRequest): Promise<Event> {
  //   const response = await fetch(`${this.baseUrl}/events`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(eventData),
  //   });
  //   
  //   if (!response.ok) {
  //     throw new Error(`Failed to create event: ${response.statusText}`);
  //   }
  //   
  //   return response.json();
  // }
}
