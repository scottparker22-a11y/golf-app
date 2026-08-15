import Leaderboard from "@/components/Leaderboard";
import GameChips from "@/components/GameChips";
import TripNav from "@/components/TripNav";
import PageNav from "@/components/PageNav";
import AdminButton from "@/components/admin/AdminButton";

// Live data — players, holes, teams, and hole_scores all come from
// Supabase via the Leaderboard component's useLiveRound() hook (see
// lib/liveRound.ts), including realtime updates as scores are entered
// on any device. Past rounds render the same way, just without new
// scores coming in — see supabase/schema.sql's `rounds` table and
// lib/rounds.ts for the round-history logic.
export default function RoundLeaderboardPage({
  params,
}: {
  params: { tripId: string; roundId: string };
}) {
  const skinsPot = 180;

  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <PageNav />
      <div className="mow-stripes px-5 pt-7 pb-6 border-b border-[color:var(--border)]">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-chalk-dim">
            <span className="w-[7px] h-[7px] rounded-full bg-turf shadow-[0_0_0_3px_rgba(111,207,151,0.22)]" />
            Live
          </div>
          <AdminButton tripId={params.tripId} />
        </div>
        <h1 className="font-display font-extrabold text-3xl leading-none mb-1">Trip {params.tripId}</h1>
        <div className="text-sm text-chalk-dim font-medium">Round in progress</div>
      </div>

      <TripNav tripId={params.tripId} roundId={params.roundId} />

      <Leaderboard roundId={params.roundId} />

      <GameChips skinsPot={skinsPot} />
    </main>
  );
}
