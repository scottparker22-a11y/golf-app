import { redirect } from "next/navigation";
import { DEMO_TRIP_ID } from "@/lib/rounds";
import { fetchCurrentRoundIdServer } from "@/lib/supabaseServer";

// Old un-round-scoped URL — sends visitors to the trip's current
// round so existing links (home page, setup wizard) keep working now
// that rounds are individually addressable (see the [roundId] routes
// and lib/rounds.ts). No in_progress/upcoming round to default to
// (e.g. the last round wrapped up and nothing new has started) sends
// visitors to Round History instead of guessing a past round.
// fetchCurrentRoundIdServer, not lib/rounds.ts's fetchCurrentRoundId —
// see that function's comment; this is a Server Component, so it
// needs the cookie-aware client to read with the visitor's own
// session instead of an anonymous one.
export default async function LeaderboardRedirectPage({ params }: { params: { tripId: string } }) {
  const roundId = await fetchCurrentRoundIdServer(DEMO_TRIP_ID);
  if (!roundId) redirect(`/trip/${params.tripId}/rounds`);
  redirect(`/trip/${params.tripId}/round/${roundId}/leaderboard`);
}
