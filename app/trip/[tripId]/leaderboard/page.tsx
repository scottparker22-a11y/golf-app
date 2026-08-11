import Leaderboard from "@/components/Leaderboard";
import GameChips from "@/components/GameChips";
import TripNav from "@/components/TripNav";

// Live data — players, holes, teams, and hole_scores all come from
// Supabase via the Leaderboard component's useLiveRound() hook (see
// lib/liveRound.ts), including realtime updates as scores are entered
// on any device. Every tripId currently points at the same seeded
// demo round (supabase/seed.sql) until a real "create a trip" flow
// exists.
export default function LeaderboardPage({ params }: { params: { tripId: string } }) {
  const skinsPot = 180;

  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <div className="mow-stripes px-5 pt-7 pb-6 border-b border-[color:var(--border)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-chalk-dim mb-2.5">
          <span className="w-[7px] h-[7px] rounded-full bg-turf shadow-[0_0_0_3px_rgba(111,207,151,0.22)]" />
          Live · Round 1
        </div>
        <h1 className="font-display font-extrabold text-3xl leading-none mb-1">Trip {params.tripId}</h1>
        <div className="text-sm text-chalk-dim font-medium">Round in progress</div>
      </div>

      <TripNav tripId={params.tripId} />

      <Leaderboard tripId={params.tripId} />

      <GameChips skinsPot={skinsPot} />
    </main>
  );
}
