import Leaderboard from "@/components/Leaderboard";
import GameChips from "@/components/GameChips";
import { demoHoles, demoPlayers, demoHoleScores, demoTeams } from "@/lib/demoData";

// TODO: replace demo data with real Supabase queries once your
// project is deployed, e.g.:
//   const { data: holeScores } = await supabase
//     .from("hole_scores")
//     .select("*")
//     .in("group_id", groupIdsForThisRound);
// For live updates, wrap this page's data-fetching in a client
// component that calls subscribeToHoleScores() from lib/supabase.ts.
export default function LeaderboardPage({ params }: { params: { tripId: string } }) {
  const teams = Object.entries(demoTeams).map(([id, t]) => ({ id, ...t }));
  const skinsPot = 180;

  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <div className="mow-stripes px-5 pt-7 pb-6 border-b border-[color:var(--border)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-chalk-dim mb-2.5">
          <span className="w-[7px] h-[7px] rounded-full bg-turf shadow-[0_0_0_3px_rgba(111,207,151,0.22)]" />
          Live · Round 1
        </div>
        <h1 className="font-display font-extrabold text-3xl leading-none mb-1">Trip {params.tripId}</h1>
        <div className="text-sm text-chalk-dim font-medium">Front 9 in progress</div>
      </div>

      <Leaderboard
        players={demoPlayers}
        holes={demoHoles}
        holeScores={demoHoleScores}
        teams={teams}
      />

      <GameChips skinsPot={skinsPot} />
    </main>
  );
}
