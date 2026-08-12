import RyderCupBoard from "@/components/RyderCupBoard";
import TripNav from "@/components/TripNav";
import PageNav from "@/components/PageNav";

// Live Ryder Cup match center — team score, live/completed/upcoming
// matches. Reads the same live scores as the Leaderboard (see
// lib/liveRound.ts) plus the round's Ryder Cup game config
// (lib/rounds.ts fetchRyderCupGame). Only reachable if Ryder Cup
// Style was enabled during Trip Setup — see TripNav's conditional tab.
export default function RoundRyderCupPage({
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
        <div className="text-sm text-chalk-dim font-medium">Ryder Cup match center</div>
      </div>

      <TripNav tripId={params.tripId} roundId={params.roundId} />

      <RyderCupBoard roundId={params.roundId} />
    </main>
  );
}
