import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-only Supabase client that reads the Supabase Auth session
// from cookies — for the couple of places that need to know "who is
// this" before the page even renders (e.g. the /setup route guard).
// No middleware.ts in this app (see lib/adminAuth.ts's comment on
// why), so there's no proactive token refresh on every navigation —
// a Server Component can read the current session but can't write a
// refreshed one back, since Next only allows setting cookies from a
// Server Action or Route Handler. That's an acceptable trade-off
// here: the client-side supabase-js instance (lib/supabase.ts)
// already auto-refreshes in the background for every page that
// actually uses it, so a stale Server Component read just means an
// occasional extra login prompt, never a silently-wrong permission
// decision (RLS + can_score()/is_admin() are the real enforcement,
// not this).
export function getServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Server Components can't set cookies — no-op rather than
        // throw. Route Handlers that need to persist a refreshed
        // session should use this same helper but wire up real
        // set/remove via the response's cookies.
        set() {},
        remove() {},
      },
    }
  );
}

/**
 * Server-side equivalents of lib/rounds.ts's fetchCurrentRoundId/
 * fetchActiveTournament, for the handful of Server Components that
 * need "what's the current round/tournament" before they can even
 * redirect (the old un-scoped /trip/[tripId]/leaderboard, /scorecard,
 * /tournament URLs) — see app/trip/[tripId]/leaderboard/page.tsx etc.
 * Those pages can't use lib/rounds.ts's versions: those go through
 * lib/supabase.ts's browser client, which server-side has no request
 * cookies attached and so reads as whatever the anon key currently
 * resolves to — as of this fix that role's reads on trips/rounds come
 * back empty (found live: anon curl against courses/players/rounds/
 * trips/hole_scores/games all return `[]` with a 200, i.e. an RLS
 * policy mismatch rather than a bad key — root cause not chased down
 * further here, flagged separately), so these pages were silently
 * redirecting to Round History instead of the real current round for
 * every visitor, logged in or not. getServerSupabase() reads the
 * session from cookies instead, so a logged-in visitor's own read
 * permissions apply, same as the client bundle gets for the identical
 * query — this fixes the common case (a logged-in user clicking
 * "Enter Score"/"Live Leaderboard" from the home page).
 */
export async function fetchCurrentRoundIdServer(tripId: string): Promise<string | null> {
  const supabase = getServerSupabase();
  const { data: trip } = await supabase.from("trips").select("current_round_id").eq("id", tripId).maybeSingle();
  if (trip?.current_round_id) return trip.current_round_id as string;

  const { data: rounds } = await supabase
    .from("rounds")
    .select("id, status")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  const active = (rounds ?? []).filter(r => r.status !== "archived" && r.status !== "completed");
  return active.find(r => r.status === "in_progress")?.id ?? active[0]?.id ?? null;
}

export async function fetchActiveTournamentServer(
  tripId: string
): Promise<{ id: string; totalRounds: number; roundsPlayed: number } | null> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("tournaments")
    .select("id, total_rounds")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const { count } = await supabase
    .from("rounds")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", data.id);
  return { id: data.id, totalRounds: data.total_rounds, roundsPlayed: count ?? 0 };
}

/** True if the current request's Supabase Auth session belongs to an active admin. Never throws. */
export async function isRealAdminSession(): Promise<boolean> {
  try {
    const supabase = getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    return !!data && data.role === "admin" && data.active;
  } catch {
    return false;
  }
}
