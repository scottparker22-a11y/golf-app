"use client";

// Optional per-round stats tracking — Fairways Hit, Greens in
// Regulation, and Putts — off by default. Sets rounds.track_stats on
// finish (see components/setup/SetupWizard.tsx handleFinish). When
// on, the Scorecard picks up 3 quick inputs per hole (tap a stroke
// cell to open them — see components/Scorecard.tsx) and a Stats tab
// appears once the round is marked completed (see components/TripNav.tsx,
// components/StatsBoard.tsx, lib/scoring.ts calculateRoundStats).
export default function RoundsStep({
  trackStats,
  setTrackStats,
}: {
  trackStats: boolean;
  setTrackStats: (v: boolean) => void;
}) {
  return (
    <div className="px-5 pt-4">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        Optional — track a few extra stats for this round. Leave off to keep the Scorecard just
        strokes.
      </p>

      <button
        onClick={() => setTrackStats(!trackStats)}
        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left ${
          trackStats ? "bg-turf/15 border-turf" : "bg-surface border-[color:var(--border)]"
        }`}
      >
        <span
          className={`w-[18px] h-[18px] rounded-md border-2 flex-shrink-0 flex items-center justify-center text-[11px] font-bold ${
            trackStats ? "bg-turf border-turf text-fairway-950" : "border-chalk-dim"
          }`}
        >
          {trackStats ? "✓" : ""}
        </span>
        <span>
          <div className="text-[13.5px] font-semibold">Track stats (Fairways, GIR, Putts)</div>
          <div className="text-[11px] text-chalk-dim">
            Adds a quick tap-to-expand entry on each stroke box for whoever's scoring, and an
            end-of-round summary once the round wraps up.
          </div>
        </span>
      </button>
    </div>
  );
}
