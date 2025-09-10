import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ApiService } from "../api";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock sessionStorage for Node.js environment
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock sessionStorage globally
Object.defineProperty(global, "sessionStorage", {
  value: mockSessionStorage,
  writable: true,
});

describe("ApiService Authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("JWT Storage and Retrieval", () => {
    it("should store JWT and expiration correctly via verifyTurnstile", async () => {
      const mockJWT =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const mockExpiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ).toISOString();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jwt: mockJWT,
          expiresAt: mockExpiresAt,
        }),
      });

      await ApiService.verifyTurnstile("test-token");

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        "scheduling_jwt",
        mockJWT,
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        "scheduling_jwt_expiry",
        mockExpiresAt,
      );
    });

    it("should check authentication status correctly", () => {
      const mockJWT = "test-jwt-token";
      const futureDate = new Date(Date.now() + 1000).toISOString();
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === "scheduling_jwt") return mockJWT;
        if (key === "scheduling_jwt_expiry") return futureDate;
        return null;
      });

      const isAuthenticated = ApiService.isAuthenticated();
      expect(isAuthenticated).toBe(true);
    });

    it("should return false for expired JWT", () => {
      const mockJWT = "expired-jwt-token";
      const pastDate = new Date(Date.now() - 1000).toISOString();
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === "scheduling_jwt") return mockJWT;
        if (key === "scheduling_jwt_expiry") return pastDate;
        return null;
      });

      const isAuthenticated = ApiService.isAuthenticated();
      expect(isAuthenticated).toBe(false);
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        "scheduling_jwt",
      );
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        "scheduling_jwt_expiry",
      );
    });

    it("should return false when no JWT is stored", () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      const isAuthenticated = ApiService.isAuthenticated();
      expect(isAuthenticated).toBe(false);
    });
  });

  describe("Clear Authentication", () => {
    it("should clear JWT and expiration from storage", () => {
      ApiService.clearAuth();

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        "scheduling_jwt",
      );
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        "scheduling_jwt_expiry",
      );
    });
  });

  describe("Turnstile Verification", () => {
    it("should successfully exchange Turnstile token for JWT", async () => {
      const mockTurnstileToken = "mock-turnstile-token";
      const mockJWT = "mock-jwt-response";
      const mockExpiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ).toISOString();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jwt: mockJWT,
          expiresAt: mockExpiresAt,
        }),
      });

      await ApiService.verifyTurnstile(mockTurnstileToken);

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ turnstileToken: mockTurnstileToken }),
      });

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        "scheduling_jwt",
        mockJWT,
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        "scheduling_jwt_expiry",
        mockExpiresAt,
      );
    });

    it("should throw error when Turnstile verification fails", async () => {
      const mockTurnstileToken = "invalid-turnstile-token";

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      await expect(
        ApiService.verifyTurnstile(mockTurnstileToken),
      ).rejects.toThrow("Failed to verify Turnstile token: Bad Request");
    });

    it("should throw generic error when response has no error message", async () => {
      const mockTurnstileToken = "invalid-turnstile-token";

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(
        ApiService.verifyTurnstile(mockTurnstileToken),
      ).rejects.toThrow(
        "Failed to verify Turnstile token: Internal Server Error",
      );
    });
  });

  describe("API Requests with JWT", () => {
    it("should include Authorization header when JWT exists", async () => {
      const mockJWT = "valid-jwt-token";
      const futureDate = new Date(Date.now() + 1000).toISOString();
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === "scheduling_jwt") return mockJWT;
        if (key === "scheduling_jwt_expiry") return futureDate;
        return null;
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await ApiService.createEvent({
        name: "Test Event",
        description: "Test Description",
        hostName: "Test Host",
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mockJWT}`,
        },
        body: expect.any(String),
      });
    });

    it("should handle 401 response by clearing auth", async () => {
      const mockJWT = "expired-jwt-token";
      const futureDate = new Date(Date.now() + 1000).toISOString();
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === "scheduling_jwt") return mockJWT;
        if (key === "scheduling_jwt_expiry") return futureDate;
        return null;
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      await expect(
        ApiService.createEvent({
          name: "Test Event",
          description: "Test Description",
          hostName: "Test Host",
        }),
      ).rejects.toThrow("Authentication expired. Please refresh the page.");

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        "scheduling_jwt",
      );
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        "scheduling_jwt_expiry",
      );
    });

    it("should make request without Authorization header when no JWT exists", async () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await ApiService.createEvent({
        name: "Test Event",
        description: "Test Description",
        hostName: "Test Host",
      });

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers).not.toHaveProperty("Authorization");
    });
  });

  describe("JWT Expiration Edge Cases", () => {
    it("should handle JWT expiration during API call", async () => {
      // Set up JWT that expires immediately
      const pastDate = new Date(Date.now() - 1000).toISOString(); // Already expired
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === "scheduling_jwt") return "expired-jwt";
        if (key === "scheduling_jwt_expiry") return pastDate;
        return null;
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await ApiService.createEvent({
        name: "Test Event",
        description: "Test Description",
        hostName: "Test Host",
      });

      // Should not include Authorization header since JWT expired
      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers).not.toHaveProperty("Authorization");
    });

    it("should handle malformed expiration timestamp", () => {
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === "scheduling_jwt") return "valid-jwt";
        if (key === "scheduling_jwt_expiry") return "invalid-timestamp";
        return null;
      });

      const isAuthenticated = ApiService.isAuthenticated();
      // Invalid Date objects are treated as expired, so authentication should fail
      expect(isAuthenticated).toBe(false);
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        "scheduling_jwt",
      );
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith(
        "scheduling_jwt_expiry",
      );
    });
  });
});
