// Server-only — the single source of truth for "is this request an
// admin." Retired the old shared-PIN cookie scheme (a single HMAC
// token anyone could be handed, with no idea which person held it)
// now that every admin has their own real Supabase Auth login and a
// database-driven `profiles.role` — see lib/supabaseServer.ts's
// isRealAdminSession() for the actual check (profiles.role = 'admin'
// for the request's logged-in user). Every /api/admin/* Route Handler
// calls requireAdmin() before writing anything; the /setup and
// ryder-cup-setup page guards call isRealAdminSession() directly for
// the same check server-side before even rendering.
//
// No middleware.ts, no Edge runtime — this only ever runs from Route
// Handlers (Node runtime), so a real Supabase session read here is
// fine without needing to also refresh/persist a cookie.

import "server-only";
import { NextResponse } from "next/server";
import { isRealAdminSession } from "./supabaseServer";

/**
 * Returns a ready-to-return 401 response when the request isn't a
 * real, active admin, or null when the caller should proceed.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isRealAdminSession()) return null;
  return NextResponse.json({ error: "Admin access required." }, { status: 401 });
}
