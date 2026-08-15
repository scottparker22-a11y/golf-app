import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
