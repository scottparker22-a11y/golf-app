import { redirect } from "next/navigation";
import { DEMO_TRIP_ID, fetchCurrentRoundId } from "@/lib/rounds";

// Old un-round-scoped URL — sends visitors to the trip's current
// round so existing links (home page, setup wizard) keep working now
// that rounds are individually addressable (see the [roundId] routes
// and lib/rounds.ts).
export default async function LeaderboardRedirectPage({ params }: { params: { tripId: string } }) {
  const roundId = await fetchCurrentRoundId(DEMO_TRIP_ID);
  redirect(`/trip/${params.tripId}/round/${roundId}/leaderboard`);
}
