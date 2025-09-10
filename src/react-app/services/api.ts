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

// JWT management
const JWT_STORAGE_KEY = "scheduling_jwt";
const JWT_EXPIRY_KEY = "scheduling_jwt_expiry";

// JWT utilities
class JWTManager {
  static setJWT(jwt: string, expiresAt: string) {
    sessionStorage.setItem(JWT_STORAGE_KEY, jwt);
    sessionStorage.setItem(JWT_EXPIRY_KEY, expiresAt);
  }

  static getJWT(): string | null {
    const jwt = sessionStorage.getItem(JWT_STORAGE_KEY);
    const expiresAt = sessionStorage.getItem(JWT_EXPIRY_KEY);

    if (!jwt || !expiresAt) {
      return null;
    }

    // Check if token is expired or has invalid expiration date
    const expirationDate = new Date(expiresAt);
    if (isNaN(expirationDate.getTime()) || expirationDate <= new Date()) {
      this.clearJWT();
      return null;
    }

    return jwt;
  }

  static clearJWT() {
    sessionStorage.removeItem(JWT_STORAGE_KEY);
    sessionStorage.removeItem(JWT_EXPIRY_KEY);
  }

  static isJWTValid(): boolean {
    return this.getJWT() !== null;
  }

  static getExpiryDate(): Date | null {
    const expiresAt = sessionStorage.getItem(JWT_EXPIRY_KEY);
    return expiresAt ? new Date(expiresAt) : null;
  }
}

export class ApiService {
  // Verify Turnstile token and get JWT
  static async verifyTurnstile(
    turnstileToken: string,
  ): Promise<{ jwt: string; expiresAt: string }> {
    const response = await fetch(`${API_BASE}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnstileToken }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to verify Turnstile token: ${response.statusText}`,
      );
    }

    const result = await response.json();

    // Store JWT in session storage
    JWTManager.setJWT(result.jwt, result.expiresAt);

    return result;
  }

  // Get headers with JWT token
  private static getHeaders(
    additionalHeaders: Record<string, string> = {},
  ): Record<string, string> {
    const headers: Record<string, string> = {
      ...additionalHeaders,
    };

    const jwt = JWTManager.getJWT();
    if (jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
    }

    return headers;
  }

  // Check if user is authenticated
  static isAuthenticated(): boolean {
    return JWTManager.isJWTValid();
  }

  // Clear authentication
  static clearAuth() {
    JWTManager.clearJWT();
  }

  // Get JWT expiry date
  static getAuthExpiry(): Date | null {
    return JWTManager.getExpiryDate();
  }
  // Handle API responses and check for auth errors
  private static async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401) {
      // JWT expired or invalid, clear auth
      this.clearAuth();
      throw new Error("Authentication expired. Please refresh the page.");
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  static async createEvent(eventData: CreateEventRequest): Promise<Event> {
    const response = await fetch(`${API_BASE}/events`, {
      method: "POST",
      headers: this.getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(eventData),
    });

    return this.handleResponse<Event>(response);
  }

  static async getEvent(eventId: string): Promise<Event> {
    const response = await fetch(`${API_BASE}/events/${eventId}`, {
      headers: this.getHeaders(),
    });

    return this.handleResponse<Event>(response);
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

    return this.handleResponse<Event>(response);
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

    return this.handleResponse<GuestLink>(response);
  }

  static async getGuest(guestId: string): Promise<Guest> {
    const response = await fetch(`${API_BASE}/guests/${guestId}`, {
      headers: this.getHeaders(),
    });

    return this.handleResponse<Guest>(response);
  }

  // Get event availability heatmap
  static async getEventAvailability(
    eventId: string,
  ): Promise<EventAvailability> {
    const response = await fetch(`${API_BASE}/events/${eventId}/availability`, {
      headers: this.getHeaders(),
    });

    return this.handleResponse<EventAvailability>(response);
  }

  // Get event for guest
  static async getEventForGuest(guestId: string): Promise<EventForGuest> {
    const response = await fetch(`${API_BASE}/guests/${guestId}/event`, {
      headers: this.getHeaders(),
    });

    return this.handleResponse<EventForGuest>(response);
  }

  // Update guest name
  static async updateGuestName(guestId: string, name: string): Promise<Guest> {
    const response = await fetch(`${API_BASE}/guests/${guestId}/name`, {
      method: "PUT",
      headers: this.getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name }),
    });

    return this.handleResponse<Guest>(response);
  }

  // Update guest availability
  static async updateGuestAvailability(
    guestId: string,
    availability: string[],
  ): Promise<Guest> {
    const response = await fetch(`${API_BASE}/guests/${guestId}/availability`, {
      method: "PUT",
      headers: this.getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ availability }),
    });

    return this.handleResponse<Guest>(response);
  }

  // Get event guests
  static async getEventGuests(eventId: string): Promise<Guest[]> {
    const response = await fetch(`${API_BASE}/events/${eventId}/guests`, {
      headers: this.getHeaders(),
    });

    return this.handleResponse<Guest[]>(response);
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

    await this.handleResponse<void>(response);
  }
}
