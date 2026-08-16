import StatsBoard from "@/components/StatsBoard";
import TripNav from "@/components/TripNav";
import PageNav from "@/components/PageNav";

// End-of-round summary — Fairways Hit, GIR, Putts, rolled straight up
// from hole_scores (see lib/scoring.ts calculateRoundStats). Unlike
// every other board in this app, this one isn't live — TripNav only
// links here once the round is both track_stats-enabled and marked
// completed (see components/TripNav.tsx).
export default function RoundStatsPage({
  params,
}: {
  params: { tripId: string; roundId: string };
}) {
  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <PageNav />
      <div className="mow-stripes px-5 pt-7 pb-6 border-b border-[color:var(--border)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-chalk-dim mb-2.5">
          <span className="w-[7px] h-[7px] rounded-full bg-sand" />
          Final
        </div>
        <h1 className="font-display font-extrabold text-3xl leading-none mb-1">Stats</h1>
        <div className="text-sm text-chalk-dim font-medium">Fairways · GIR · Putts</div>
      </div>

      <TripNav tripId={params.tripId} roundId={params.roundId} />

      <StatsBoard roundId={params.roundId} />
    </main>
  );
}
