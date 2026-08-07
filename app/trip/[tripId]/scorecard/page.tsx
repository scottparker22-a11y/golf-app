import Scorecard from "@/components/Scorecard";
import TripNav from "@/components/TripNav";
import { demoHoles, demoPlayers, demoHoleScores, demoTeams } from "@/lib/demoData";

// TODO: same as the leaderboard page — swap demo data for real
// Supabase queries once your project is deployed and the setup
// wizard is wired to save real players/teams/rounds.
export default function ScorecardPage({ params }: { params: { tripId: string } }) {
  const teams = Object.entries(demoTeams).map(([id, t]) => ({ id, ...t }));

  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <div className="mow-stripes px-5 pt-7 pb-6 border-b border-[color:var(--border)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-chalk-dim mb-2.5">
          <span className="w-[7px] h-[7px] rounded-full bg-turf shadow-[0_0_0_3px_rgba(111,207,151,0.22)]" />
          Live · Round 1
        </div>
        <h1 className="font-display font-extrabold text-3xl leading-none mb-1">Trip {params.tripId}</h1>
        <div className="text-sm text-chalk-dim font-medium">Enter strokes per hole</div>
      </div>

      <TripNav tripId={params.tripId} />

      <Scorecard
        tripId={params.tripId}
        players={demoPlayers}
        holes={demoHoles}
        teams={teams}
        initialHoleScores={demoHoleScores}
      />
    </main>
  );
}
