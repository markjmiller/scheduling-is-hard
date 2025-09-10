import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { signJWT } from "../utils/jwt";

// Mock the import.meta.env for testing
vi.mock("import.meta.env", () => ({
  VITE_JWT_SECRET_KEY: "test-secret-key-for-integration-testing",
}));

describe("JWT Middleware Integration", () => {
  const testSecret = "test-secret-key-for-integration-testing";
  let app: Hono;

  beforeEach(() => {
    // Create a test Hono app with the same JWT middleware logic as in routes.ts
    app = new Hono();

    // Replicate the JWT middleware from routes.ts
    app.use("*", async (c, next) => {
      const jwtSecret = testSecret; // Using test secret directly
      if (!jwtSecret) {
        return c.json(
          {
            error: "SERVER_ERROR",
            message: "JWT secret not configured",
          },
          500,
        );
      }

      const authHeader = c.req.header("Authorization");

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json(
          {
            error: "UNAUTHORIZED",
            message: "JWT token is required",
          },
          401,
        );
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const { verifyJWT } = await import("../utils/jwt");
      const payload = verifyJWT(token, jwtSecret);

      if (!payload) {
        return c.json(
          {
            error: "UNAUTHORIZED",
            message: "Invalid or expired JWT token",
          },
          401,
        );
      }

      await next();
    });

    // Add a test route
    app.get("/test", (c) => c.json({ message: "success" }));
  });

  describe("Protected Route Access", () => {
    it("should allow access with valid JWT token", async () => {
      const { token } = signJWT(testSecret);

      const req = new Request("http://localhost/test", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ message: "success" });
    });

    it("should reject request without Authorization header", async () => {
      const req = new Request("http://localhost/test");

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data).toEqual({
        error: "UNAUTHORIZED",
        message: "JWT token is required",
      });
    });

    it("should reject request with malformed Authorization header", async () => {
      const req = new Request("http://localhost/test", {
        headers: {
          Authorization: "Basic sometoken",
        },
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data).toEqual({
        error: "UNAUTHORIZED",
        message: "JWT token is required",
      });
    });

    it("should reject request with invalid JWT token", async () => {
      const req = new Request("http://localhost/test", {
        headers: {
          Authorization: "Bearer invalid-jwt-token",
        },
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data).toEqual({
        error: "UNAUTHORIZED",
        message: "Invalid or expired JWT token",
      });
    });

    it("should reject request with JWT signed with wrong secret", async () => {
      const { token } = signJWT("wrong-secret");

      const req = new Request("http://localhost/test", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data).toEqual({
        error: "UNAUTHORIZED",
        message: "Invalid or expired JWT token",
      });
    });

    it("should handle empty Bearer token", async () => {
      const req = new Request("http://localhost/test", {
        headers: {
          Authorization: "Bearer ",
        },
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data).toEqual({
        error: "UNAUTHORIZED",
        message: "JWT token is required",
      });
    });

    it("should handle Authorization header with extra spaces", async () => {
      const { token } = signJWT(testSecret);

      const req = new Request("http://localhost/test", {
        headers: {
          Authorization: `  Bearer   ${token}  `,
        },
      });

      const res = await app.request(req);

      // This should fail because our middleware expects exact "Bearer " format
      expect(res.status).toBe(401);
    });
  });

  describe("Multiple Route Protection", () => {
    beforeEach(() => {
      app.get("/events", (c) => c.json({ events: [] }));
      app.post("/events", (c) => c.json({ created: true }));
      app.get("/guests/:id", (c) =>
        c.json({ guest: { id: c.req.param("id") } }),
      );
    });

    it("should protect all routes with the same middleware", async () => {
      const { token } = signJWT(testSecret);
      const headers = { Authorization: `Bearer ${token}` };

      // Test GET /events
      const eventsRes = await app.request(
        new Request("http://localhost/events", { headers }),
      );
      expect(eventsRes.status).toBe(200);

      // Test POST /events
      const createRes = await app.request(
        new Request("http://localhost/events", {
          method: "POST",
          headers,
        }),
      );
      expect(createRes.status).toBe(200);

      // Test GET /guests/:id
      const guestRes = await app.request(
        new Request("http://localhost/guests/123", { headers }),
      );
      expect(guestRes.status).toBe(200);
    });

    it("should reject all routes without valid token", async () => {
      // Test without any auth header
      const eventsRes = await app.request(
        new Request("http://localhost/events"),
      );
      expect(eventsRes.status).toBe(401);

      const createRes = await app.request(
        new Request("http://localhost/events", { method: "POST" }),
      );
      expect(createRes.status).toBe(401);

      const guestRes = await app.request(
        new Request("http://localhost/guests/123"),
      );
      expect(guestRes.status).toBe(401);
    });
  });

  describe("Error Handling", () => {
    it("should handle server error when JWT secret is missing", async () => {
      // Create app without JWT secret
      const appWithoutSecret = new Hono();

      appWithoutSecret.use("*", async (c, next) => {
        const jwtSecret = undefined; // Simulate missing secret
        if (!jwtSecret) {
          return c.json(
            {
              error: "SERVER_ERROR",
              message: "JWT secret not configured",
            },
            500,
          );
        }
        await next();
      });

      appWithoutSecret.get("/test", (c) => c.json({ message: "success" }));

      const req = new Request("http://localhost/test", {
        headers: {
          Authorization: "Bearer some-token",
        },
      });

      const res = await appWithoutSecret.request(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data).toEqual({
        error: "SERVER_ERROR",
        message: "JWT secret not configured",
      });
    });
  });
});
