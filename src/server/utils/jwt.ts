import jwt from "jsonwebtoken";
import type { Context, Next } from "hono";

export interface JWTPayload {
  iat: number;
  exp: number;
}

/**
 * Sign a JWT token with 24-hour expiration
 */
export function signJWT(secret: string): { token: string; expiresAt: Date } {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 24 * 60 * 60; // 24 hours in seconds
  const exp = now + expiresIn;

  const payload: JWTPayload = {
    iat: now,
    exp: exp,
  };

  // Add jti (JWT ID) to ensure uniqueness even with same timestamp
  const token = jwt.sign(payload, secret, {
    algorithm: "HS256",
    jwtid: Math.random().toString(36).substring(2, 15),
  });
  const expiresAt = new Date(exp * 1000);

  return { token, expiresAt };
}

/**
 * Verify a JWT token
 */
export function verifyJWT(token: string, secret: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * JWT authentication middleware for Hono
 */
export function jwtMiddleware(secret: string) {
  return async (c: Context, next: Next) => {
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

    const token = authHeader.replace("Bearer ", "");
    const payload = verifyJWT(token, secret);

    if (!payload) {
      return c.json(
        {
          error: "UNAUTHORIZED",
          message: "Invalid or expired JWT token",
        },
        401,
      );
    }

    // Token is valid, continue to the next handler
    await next();
  };
}
