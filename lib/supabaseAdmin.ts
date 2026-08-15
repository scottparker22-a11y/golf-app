// Server-only Supabase client — uses the service_role key, which
// bypasses RLS entirely. Only ever import this from a Route Handler
// or Server Component, NEVER from a "use client" file — the key must
// not end up in a browser bundle.
//
// This is what actually writes to the admin-gated tables
// (players/groups/group_players/rounds/games/courses/holes) after a
// route handler's requireAdmin() check passes (see lib/adminAuth.ts).
// Everything else in the app keeps using the anon client in
// lib/supabase.ts, which RLS now blocks from writing to those tables.

import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin() {
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — add it to .env.local (Supabase dashboard → Project Settings → API)."
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
