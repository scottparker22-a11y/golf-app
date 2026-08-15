import { redirect } from "next/navigation";
import { DEMO_TRIP_ID, fetchCurrentRoundId } from "@/lib/rounds";

// Old un-round-scoped URL — sends visitors to the trip's current
// round so existing links (home page, setup wizard) keep working now
// that rounds are individually addressable (see the [roundId] routes
// and lib/rounds.ts). No in_progress/upcoming round to default to
// (e.g. the last round wrapped up and nothing new has started) sends
// visitors to Round History instead of guessing a past round.
export default async function ScorecardRedirectPage({ params }: { params: { tripId: string } }) {
  const roundId = await fetchCurrentRoundId(DEMO_TRIP_ID);
  if (!roundId) redirect(`/trip/${params.tripId}/rounds`);
  redirect(`/trip/${params.tripId}/round/${roundId}/scorecard`);
}
