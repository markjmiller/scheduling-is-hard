import { describe, it, expect, beforeEach, vi } from "vitest";
import { signJWT, verifyJWT, jwtMiddleware } from "../jwt";
import jwt from "jsonwebtoken";

describe("JWT Utilities", () => {
  const testSecret = "test-secret-key-for-testing";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("signJWT", () => {
    it("should generate a valid JWT token with 24-hour expiration", () => {
      const result = signJWT(testSecret);

      expect(result).toHaveProperty("token");
      expect(result).toHaveProperty("expiresAt");
      expect(typeof result.token).toBe("string");
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify the token can be decoded
      const decoded = jwt.verify(result.token, testSecret) as any;
      expect(decoded).toHaveProperty("iat");
      expect(decoded).toHaveProperty("exp");

      // Check expiration is approximately 24 hours from now
      const now = Math.floor(Date.now() / 1000);
      const expectedExp = now + 24 * 60 * 60;
      expect(decoded.exp).toBeCloseTo(expectedExp, -2); // Within ~100 seconds
    });

    it("should generate different tokens on subsequent calls", () => {
      const result1 = signJWT(testSecret);
      // Add small delay to ensure different iat timestamps
      const start = Date.now();
      while (Date.now() - start < 1) {} // 1ms delay
      const result2 = signJWT(testSecret);

      expect(result1.token).not.toBe(result2.token);
    });

    it("should set expiresAt to correct date", () => {
      const result = signJWT(testSecret);
      const now = new Date();
      const expectedExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Allow for some variance in timing (within 5 seconds)
      const timeDiff = Math.abs(
        result.expiresAt.getTime() - expectedExpiry.getTime(),
      );
      expect(timeDiff).toBeLessThan(5000);
    });
  });

  describe("verifyJWT", () => {
    it("should verify a valid JWT token", () => {
      const { token } = signJWT(testSecret);
      const result = verifyJWT(token, testSecret);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty("iat");
      expect(result).toHaveProperty("exp");
      expect(typeof result!.iat).toBe("number");
      expect(typeof result!.exp).toBe("number");
    });

    it("should return null for invalid token", () => {
      const result = verifyJWT("invalid-token", testSecret);
      expect(result).toBeNull();
    });

    it("should return null for token with wrong secret", () => {
      const { token } = signJWT(testSecret);
      const result = verifyJWT(token, "wrong-secret");
      expect(result).toBeNull();
    });

    it("should return null for expired token", () => {
      // Create an expired token manually
      const expiredPayload = {
        iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        exp: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago (expired)
      };
      const expiredToken = jwt.sign(expiredPayload, testSecret);

      const result = verifyJWT(expiredToken, testSecret);
      expect(result).toBeNull();
    });

    it("should return null for malformed token", () => {
      const result = verifyJWT("not.a.jwt", testSecret);
      expect(result).toBeNull();
    });
  });

  describe("jwtMiddleware", () => {
    const mockContext = {
      req: {
        header: vi.fn(),
      },
      json: vi.fn(),
    };
    const mockNext = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should call next() for valid JWT token", async () => {
      const { token } = signJWT(testSecret);
      mockContext.req.header.mockReturnValue(`Bearer ${token}`);

      const middleware = jwtMiddleware(testSecret);
      await middleware(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockContext.json).not.toHaveBeenCalled();
    });

    it("should return 401 when no Authorization header", async () => {
      mockContext.req.header.mockReturnValue(undefined);

      const middleware = jwtMiddleware(testSecret);
      await middleware(mockContext as any, mockNext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: "UNAUTHORIZED",
          message: "JWT token is required",
        },
        401,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 when Authorization header does not start with Bearer", async () => {
      mockContext.req.header.mockReturnValue("Basic sometoken");

      const middleware = jwtMiddleware(testSecret);
      await middleware(mockContext as any, mockNext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: "UNAUTHORIZED",
          message: "JWT token is required",
        },
        401,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 for invalid JWT token", async () => {
      mockContext.req.header.mockReturnValue("Bearer invalid-token");

      const middleware = jwtMiddleware(testSecret);
      await middleware(mockContext as any, mockNext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: "UNAUTHORIZED",
          message: "Invalid or expired JWT token",
        },
        401,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 for expired JWT token", async () => {
      // Create an expired token
      const expiredPayload = {
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp: Math.floor(Date.now() / 1000) - 1800,
      };
      const expiredToken = jwt.sign(expiredPayload, testSecret);
      mockContext.req.header.mockReturnValue(`Bearer ${expiredToken}`);

      const middleware = jwtMiddleware(testSecret);
      await middleware(mockContext as any, mockNext);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: "UNAUTHORIZED",
          message: "Invalid or expired JWT token",
        },
        401,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should extract token correctly from Bearer header", async () => {
      const { token } = signJWT(testSecret);
      mockContext.req.header.mockReturnValue(`Bearer ${token}`);

      const middleware = jwtMiddleware(testSecret);
      await middleware(mockContext as any, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
    });
  });
});
