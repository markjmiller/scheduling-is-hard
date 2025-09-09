// Real API service for production
import type { components } from "../../../types/api";

type Event = components["schemas"]["Event"];
type CreateEventRequest = components["schemas"]["CreateEventRequest"];
type GuestLink = components["schemas"]["GuestLink"];
type BaseGuest = components["schemas"]["Guest"];

// Extended guest interface with availability for frontend use
interface Guest extends BaseGuest {
  availability?: string[];
}

interface GuestAvailabilityInfo {
  id: string;
  name: string;
  availability: string[];
  isHost: boolean;
  hasResponded: boolean;
}

interface EventAvailability {
  totalGuests: number;
  respondedGuests: number;
  guests: GuestAvailabilityInfo[];
}

// The new response from /guests/{guestId}/event with guest-level data
interface EventForGuest {
  name: string;
  description: string;
  totalGuests: number;
  respondedGuests: number;
  guests: GuestAvailabilityInfo[];
}

// API base URL
const API_BASE = "/api";

// Store the Turnstile token globally for API calls
let turnstileToken: string | null = null;

export class ApiService {
  // Set the Turnstile token for all subsequent API calls
  static setTurnstileToken(token: string) {
    turnstileToken = token;
  }

  // Get headers with Turnstile token
  private static getHeaders(
    additionalHeaders: Record<string, string> = {},
  ): Record<string, string> {
    const headers: Record<string, string> = {
      ...additionalHeaders,
    };

    if (turnstileToken) {
      headers["X-Turnstile-Token"] = turnstileToken;
    }

    return headers;
  }
  static async createEvent(eventData: CreateEventRequest): Promise<Event> {
    const response = await fetch(`${API_BASE}/events`, {
      method: "POST",
      headers: this.getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      throw new Error(`Failed to create event: ${response.statusText}`);
    }

    return response.json();
  }

  static async getEvent(eventId: string): Promise<Event> {
    const response = await fetch(`${API_BASE}/events/${eventId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get event: ${response.statusText}`);
    }

    return response.json();
  }

  static async updateEvent(
    eventId: string,
    updateData: { name?: string; description?: string },
  ): Promise<Event> {
    const response = await fetch(`${API_BASE}/events/${eventId}`, {
      method: "PUT",
      headers: this.getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      throw new Error(`Failed to update event: ${response.statusText}`);
    }

    return response.json();
  }

  // Generate guest link
  static async generateGuestLink(
    eventId: string,
    guestName?: string,
  ): Promise<GuestLink> {
    const response = await fetch(`${API_BASE}/events/${eventId}/guests`, {
      method: "POST",
      headers: this.getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ guestName }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate guest link: ${response.statusText}`);
    }

    return response.json();
  }

  static async getGuest(guestId: string): Promise<Guest> {
    const response = await fetch(`${API_BASE}/guests/${guestId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get guest: ${response.statusText}`);
    }

    return response.json();
  }

  // Get event availability heatmap
  static async getEventAvailability(
    eventId: string,
  ): Promise<EventAvailability> {
    const response = await fetch(`${API_BASE}/events/${eventId}/availability`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get event availability: ${response.statusText}`,
      );
    }

    return response.json();
  }

  // Get event availability heatmap
  static async getEventForGuest(guestId: string): Promise<EventForGuest> {
    const response = await fetch(`${API_BASE}/guests/${guestId}/event`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get event for guest: ${response.statusText}`);
    }

    return response.json();
  }

  // Update guest name (new guest-only endpoint)
  static async updateGuestName(guestId: string, name: string): Promise<Guest> {
    const response = await fetch(`${API_BASE}/guests/${guestId}/name`, {
      method: "PUT",
      headers: this.getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update guest name: ${response.statusText}`);
    }

    return response.json();
  }

  // Update guest availability (new guest-only endpoint)
  static async updateGuestAvailability(
    guestId: string,
    availability: string[],
  ): Promise<Guest> {
    const response = await fetch(`${API_BASE}/guests/${guestId}/availability`, {
      method: "PUT",
      headers: this.getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ availability }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to update guest availability: ${response.statusText}`,
      );
    }

    return response.json();
  }

  // Get event guests
  static async getEventGuests(eventId: string): Promise<Guest[]> {
    const response = await fetch(`${API_BASE}/events/${eventId}/guests`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get event guests: ${response.statusText}`);
    }

    return response.json();
  }

  // Delete guest
  static async deleteGuest(eventId: string, guestId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE}/events/${eventId}/guests/${guestId}`,
      {
        method: "DELETE",
        headers: this.getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to delete guest: ${response.statusText}`);
    }
  }
}
