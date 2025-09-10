import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { validator } from "hono/validator";
import { signJWT } from "../utils/jwt";
import type { components } from "../../../types/api";

// Mock the validateTurnstile function
vi.mock("../utils/validate-turnstile", () => ({
  validateTurnstile: vi.fn(),
}));

// Mock getConnInfo
vi.mock("hono/cloudflare-workers", () => ({
  getConnInfo: vi.fn(() => ({
    remote: { address: "127.0.0.1" },
  })),
}));

// Mock import.meta.env
vi.mock("import.meta.env", () => ({
  VITE_JWT_SECRET_KEY: "test-secret-for-auth-endpoint",
}));

describe("Auth Verify Endpoint", () => {
  const testSecret = "test-secret-for-auth-endpoint";
  let app: Hono;
  let mockValidateTurnstile: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked function
    const { validateTurnstile } = await import("../utils/validate-turnstile");
    mockValidateTurnstile = validateTurnstile as any;

    // Create test app with auth endpoint
    app = new Hono();

    app.post(
      "/auth/verify",
      validator("json", (value, c) => {
        const data = value as components["schemas"]["VerifyTurnstileRequest"];
        if (!data.turnstileToken) {
          return c.json(
            {
              error: "INVALID_REQUEST",
              message: "Turnstile token is required",
            },
            400,
          );
        }
        return data;
      }),
      async (c) => {
        const { turnstileToken } = c.req.valid("json");

        const { validateTurnstile } = await import(
          "../utils/validate-turnstile"
        );
        const { getConnInfo } = await import("hono/cloudflare-workers");
        const isValid = await validateTurnstile(
          turnstileToken,
          getConnInfo(c).remote.address,
        );

        if (!isValid) {
          return c.json(
            {
              error: "UNAUTHORIZED",
              message: "Invalid Turnstile token",
            },
            401,
          );
        }

        const jwtSecret = testSecret;
        if (!jwtSecret) {
          return c.json(
            {
              error: "SERVER_ERROR",
              message: "JWT secret not configured",
            },
            500,
          );
        }

        const { token, expiresAt } = signJWT(jwtSecret);

        return c.json({
          jwt: token,
          expiresAt: expiresAt.toISOString(),
        });
      },
    );
  });

  describe("POST /auth/verify", () => {
    it("should return JWT for valid Turnstile token", async () => {
      mockValidateTurnstile.mockResolvedValue(true);

      const req = new Request("http://localhost/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          turnstileToken: "valid-turnstile-token",
        }),
      });

      const res = await app.request(req);
      const data = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("jwt");
      expect(data).toHaveProperty("expiresAt");
      expect(typeof data.jwt).toBe("string");
      expect(typeof data.expiresAt).toBe("string");

      // Verify the JWT is valid
      const { verifyJWT } = await import("../utils/jwt");
      const payload = verifyJWT(data.jwt, testSecret);
      expect(payload).not.toBeNull();

      // Verify expiresAt is a valid ISO date
      const expiresDate = new Date(data.expiresAt);
      expect(expiresDate.getTime()).toBeGreaterThan(Date.now());
    });

    it("should return 401 for invalid Turnstile token", async () => {
      mockValidateTurnstile.mockResolvedValue(false);

      const req = new Request("http://localhost/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          turnstileToken: "invalid-turnstile-token",
        }),
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data).toEqual({
        error: "UNAUTHORIZED",
        message: "Invalid Turnstile token",
      });
    });

    it("should return 400 for missing turnstileToken", async () => {
      const req = new Request("http://localhost/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data).toEqual({
        error: "INVALID_REQUEST",
        message: "Turnstile token is required",
      });
    });

    it("should return 400 for empty turnstileToken", async () => {
      const req = new Request("http://localhost/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          turnstileToken: "",
        }),
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data).toEqual({
        error: "INVALID_REQUEST",
        message: "Turnstile token is required",
      });
    });

    it("should return 400 for invalid JSON", async () => {
      const req = new Request("http://localhost/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid-json",
      });

      const res = await app.request(req);

      expect(res.status).toBe(400);
    });

    it("should call validateTurnstile with correct parameters", async () => {
      mockValidateTurnstile.mockResolvedValue(true);

      const req = new Request("http://localhost/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          turnstileToken: "test-token-123",
        }),
      });

      await app.request(req);

      expect(mockValidateTurnstile).toHaveBeenCalledWith(
        "test-token-123",
        "127.0.0.1",
      );
    });

    it("should handle validateTurnstile errors gracefully", async () => {
      mockValidateTurnstile.mockRejectedValue(new Error("Network error"));

      const req = new Request("http://localhost/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          turnstileToken: "test-token",
        }),
      });

      const res = await app.request(req);

      // Should return 500 since the error is thrown during validation
      expect(res.status).toBe(500);
    });

    it("should generate different JWTs for multiple valid requests", async () => {
      mockValidateTurnstile.mockResolvedValue(true);

      const req1 = new Request("http://localhost/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          turnstileToken: "token1",
        }),
      });

      const req2 = new Request("http://localhost/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          turnstileToken: "token2",
        }),
      });

      const res1 = await app.request(req1);
      const res2 = await app.request(req2);

      const data1 = (await res1.json()) as any;
      const data2 = (await res2.json()) as any;

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(data1.jwt).not.toBe(data2.jwt);
    });
  });

  describe("Error Scenarios", () => {
    it("should handle missing Content-Type header", async () => {
      mockValidateTurnstile.mockResolvedValue(true);

      const req = new Request("http://localhost/auth/verify", {
        method: "POST",
        body: JSON.stringify({
          turnstileToken: "valid-token",
        }),
      });

      const res = await app.request(req);

      // Should return 400 as Hono validator requires proper JSON parsing
      expect(res.status).toBe(400);
    });

    it("should reject non-POST methods", async () => {
      const req = new Request("http://localhost/auth/verify", {
        method: "GET",
      });

      const res = await app.request(req);

      expect(res.status).toBe(404); // Hono returns 404 for unmatched routes
    });
  });
});
