import SkinsBoard from "@/components/SkinsBoard";
import TripNav from "@/components/TripNav";
import PageNav from "@/components/PageNav";

// Live skins board — hole-by-hole matrix, standings, and payouts.
// Reads the round's live scores the same way the Leaderboard does
// (lib/liveRound.ts), plus the Skins game config saved during Trip
// Setup (lib/rounds.ts fetchSkinsGame).
export default function RoundSkinsPage({
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
        <h1 className="font-display font-extrabold text-3xl leading-none mb-1">Trip {params.tripId}</h1>
        <div className="text-sm text-chalk-dim font-medium">Skins board</div>
      </div>

      <TripNav tripId={params.tripId} roundId={params.roundId} />

      <SkinsBoard roundId={params.roundId} />
    </main>
  );
}
