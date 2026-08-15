// Server-only — the single source of truth for "is this browser an
// admin for this trip." Everything downstream (API routes, the
// /setup route guard) calls getAdminFlag()/requireAdmin() rather than
// checking the PIN cookie itself, so swapping this for real Supabase
// Auth later is a one-file change: keep the same getAdminFlag(tripId)
// signature, change what sets it (a verified user session instead of
// a signed PIN cookie) — RLS, the API routes, the route guard, and
// the Admin button never need to change.
//
// No middleware.ts, no Edge runtime — this only ever runs from Route
// Handlers and Server Components (Node runtime), so plain Node
// `crypto` works everywhere without portability concerns.

import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";

// Structural type instead of importing Next's internal cookies() return
// type — matches both next/headers' ReadonlyRequestCookies and a plain
// RequestCookies without depending on an unexported path.
type CookieReader = { get(name: string): { value: string } | undefined };

export const ADMIN_COOKIE_NAME = "golf_admin_session";
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set — add it to .env.local.");
  }
  return secret;
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

/** Signs a 30-day admin session token for the given trip. */
export function signAdminToken(tripId: string, maxAgeSeconds = THIRTY_DAYS_SECONDS): string {
  const payload = JSON.stringify({ tripId, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds });
  const payloadB64 = base64url(Buffer.from(payload, "utf8"));
  const sig = createHmac("sha256", getSecret()).update(payloadB64).digest();
  return `${payloadB64}.${base64url(sig)}`;
}

/** Verifies a token was signed by us, isn't expired, and matches this trip. */
export function verifyAdminToken(token: string | undefined | null, tripId: string): boolean {
  if (!token) return false;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return false;

  const expectedSig = createHmac("sha256", getSecret()).update(payloadB64).digest();
  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(sigB64, "base64url");
  } catch {
    return false;
  }
  if (providedSig.length !== expectedSig.length || !timingSafeEqual(providedSig, expectedSig)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (payload.tripId !== tripId) return false;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Cookie options shared by every place that sets/clears the admin cookie. */
export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: THIRTY_DAYS_SECONDS,
};

/**
 * The reusable admin flag for Server Components (e.g. the /setup
 * route guard) — reads the cookie via next/headers' cookies().
 */
export function getAdminFlag(cookieStore: CookieReader, tripId: string): boolean {
  return verifyAdminToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value, tripId);
}

/**
 * Same flag, for Route Handlers — reads the cookie off the incoming
 * NextRequest. Returns a ready-to-return 401 response when not admin,
 * or null when the caller should proceed.
 */
export function requireAdmin(request: NextRequest, tripId: string): NextResponse | null {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token, tripId)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  }
  return null;
}
