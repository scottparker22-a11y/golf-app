import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// createBrowserClient (not plain @supabase/supabase-js createClient)
// is load-bearing, not cosmetic: it mirrors the session into cookies
// as well as localStorage. lib/supabaseServer.ts's isRealAdminSession()
// — which every /api/admin/* route and the /setup, /ryder-cup-setup,
// /scorekeepers page guards call — reads the session from cookies via
// @supabase/ssr's createServerClient. With the plain client, the
// browser only ever wrote to localStorage, so the server could never
// see a "logged in" browser's session at all: every real admin action
// failed with "Admin access required" even for an actual admin,
// despite the client-side UI (Admin ✓, useIsAdmin) looking correct
// since that used this same (self-consistent but server-invisible)
// client. Cookie-based sharing is what makes the two sides agree.
//
// Supabase's client makes its requests through the global fetch — in a
// Next.js Server Component, that's Next's own patched fetch, which
// caches responses indefinitely by default (the App Router "Data
// Cache") unless told otherwise. Without this, a Server Component
// page (e.g. the un-scoped /trip/[tripId]/leaderboard redirect) can
// keep serving whatever a round's status was the first time it was
// ever fetched, ignoring every change since — including across dev
// server restarts, since the cache is persisted to .next/cache. This
// app is live-scoring; every read should reflect the current DB
// state, so caching is disabled outright rather than tuned.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  },
});

// Subscribe a callback to live hole_scores changes for a round.
// Call this from a client component's useEffect; it returns an
// unsubscribe function to call on cleanup.
export function subscribeToHoleScores(roundGroupIds: string[], onChange: () => void) {
  const channel = supabase
    .channel("hole_scores_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "hole_scores" },
      (payload) => {
        const groupId = (payload.new as any)?.group_id ?? (payload.old as any)?.group_id;
        if (roundGroupIds.includes(groupId)) onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
