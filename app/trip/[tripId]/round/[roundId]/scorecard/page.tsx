import Scorecard from "@/components/Scorecard";
import TripNav from "@/components/TripNav";
import PageNav from "@/components/PageNav";

// Live data — players, holes, teams, and hole_scores all come from
// Supabase via the Scorecard component's useLiveRound() hook (see
// lib/liveRound.ts), so strokes entered here sync to every device
// live. Past rounds still open here for review — see lib/rounds.ts
// for the round-history logic.
export default function RoundScorecardPage({
  params,
}: {
  params: { tripId: string; roundId: string };
}) {
  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <PageNav />
      <div className="mow-stripes px-5 pt-7 pb-6 border-b border-[color:var(--border)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-chalk-dim mb-2.5">
          <span className="w-[7px] h-[7px] rounded-full bg-turf shadow-[0_0_0_3px_rgba(111,207,151,0.22)]" />
          Live
        </div>
        <h1 className="font-display font-extrabold text-3xl leading-none mb-1">Scorecard</h1>
        <div className="text-sm text-chalk-dim font-medium">Enter strokes per hole</div>
      </div>

      <TripNav tripId={params.tripId} roundId={params.roundId} />

      <Scorecard roundId={params.roundId} />
    </main>
  );
}
