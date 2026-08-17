import { redirect } from "next/navigation";
import { DEMO_TRIP_ID, fetchActiveTournament, fetchCurrentRoundId } from "@/lib/rounds";
import TournamentLeaderboard from "@/components/TournamentLeaderboard";
import TripNav from "@/components/TripNav";
import PageNav from "@/components/PageNav";

// Auto-resolves the trip's active multi-round Tournament (see
// lib/rounds.ts fetchActiveTournament) — same idea as the un-scoped
// /leaderboard redirect, just for the cross-round Tournament instead
// of one round. No active tournament (nothing ever opted into one via
// components/setup/FormatStep.tsx) sends visitors to Round History.
export default async function TournamentPage({ params }: { params: { tripId: string } }) {
  const tournament = await fetchActiveTournament(DEMO_TRIP_ID);
  if (!tournament) redirect(`/trip/${params.tripId}/rounds`);

  // TripNav needs a round to build its round-scoped tab links (Leaderboard,
  // Scorecard, Skins...) — the trip's current round, same as every other
  // trip-level page.
  const currentRoundId = await fetchCurrentRoundId(DEMO_TRIP_ID);

  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <PageNav />
      <div className="mow-stripes px-5 pt-7 pb-6 border-b border-[color:var(--border)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-chalk-dim mb-2.5">
          <span className="w-[7px] h-[7px] rounded-full bg-turf shadow-[0_0_0_3px_rgba(111,207,151,0.22)]" />
          Tournament
        </div>
        <h1 className="font-display font-extrabold text-3xl leading-none mb-1">Leaderboard</h1>
        <div className="text-sm text-chalk-dim font-medium">
          Round {tournament.roundsPlayed} of {tournament.totalRounds}
        </div>
      </div>

      {currentRoundId && <TripNav tripId={params.tripId} roundId={currentRoundId} />}

      <TournamentLeaderboard tripId={params.tripId} tournamentId={tournament.id} />
    </main>
  );
}
