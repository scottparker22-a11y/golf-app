import { redirect } from "next/navigation";

// Old standalone Ryder Cup page — the match center is now a view
// inside Leaderboard.tsx (see components/RyderCupBoard.tsx, embedded
// there instead of living on its own route) alongside Individual and
// Team. This just keeps any old links/bookmarks working.
export default function RoundRyderCupRedirect({
  params,
}: {
  params: { tripId: string; roundId: string };
}) {
  redirect(`/trip/${params.tripId}/round/${params.roundId}/leaderboard`);
}
