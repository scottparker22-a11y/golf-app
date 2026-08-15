// Server-only — a deliberately simple defense-in-depth throttle on
// /api/admin/login. A 4-digit PIN is only 10,000 combinations, so
// without *some* limit a script could brute-force it in seconds even
// though it's bcrypt-hashed at rest.
//
// v1 simplification: in-memory, per server process — resets on
// redeploy/restart and doesn't share state across multiple instances.
// Fine for a buddy-trip app on one small deployment; swap for a
// durable store (Redis, a Postgres table) if that ever stops being true.

import "server-only";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, { count: number; resetAt: number }>();

/** Returns true if this key (usually an IP) is currently allowed to try. */
export function checkLoginRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return true;
  }
  return entry.count < MAX_ATTEMPTS;
}

/** Call after a failed PIN attempt to count it against the limit. */
export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

/** Call after a successful login to clear any accumulated attempts. */
export function clearLoginRateLimit(key: string): void {
  attempts.delete(key);
}

export function rateLimitKeyFor(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
