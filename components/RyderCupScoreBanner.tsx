import type { RyderCupTeamScore } from "@/lib/scoring";

// Extracted from RyderCupBoard.tsx (which still renders it, at the
// top of its own page) so the same team-score banner can also sit
// above Leaderboard.tsx and TournamentLeaderboard.tsx — the overall
// Cup score is the number people care about most on a multi-day Cup,
// so it belongs above the individual/tournament leaderboard rather
// than buried inside the round-scoped Ryder Cup tab. Purely
// presentational and unmargined — callers control placement/spacing
// (RyderCupBoard.tsx nests it inside an already-padded container;
// Leaderboard.tsx/TournamentLeaderboard.tsx sit it directly under
// TripNav, so they add their own mx-5 mt-4). See lib/rounds.ts
// fetchRyderCupTeamScoreForTrip for where teamScore comes from
// (aggregated across every round of an active multi-round Ryder Cup,
// or a single round's game as a fallback).
export default function RyderCupScoreBanner({
  teamAName,
  teamBName,
  teamScore,
}: {
  teamAName: string;
  teamBName: string;
  teamScore: RyderCupTeamScore;
}) {
  return (
    <div className="bg-surface-raised border border-[color:var(--border-strong)] rounded-2xl p-4 text-center">
      <div className="text-[11px] font-bold uppercase tracking-wide text-chalk-dim mb-2">Ryder Cup</div>
      <div className="flex items-center justify-center gap-4">
        <div className="flex-1">
          <div className="font-display font-extrabold text-lg leading-tight truncate">{teamAName}</div>
          <div className="font-mono font-extrabold text-3xl text-turf">{teamScore.pointsA}</div>
        </div>
        <div className="text-chalk-dim text-xs font-semibold">vs</div>
        <div className="flex-1">
          <div className="font-display font-extrabold text-lg leading-tight truncate">{teamBName}</div>
          <div className="font-mono font-extrabold text-3xl text-flag">{teamScore.pointsB}</div>
        </div>
      </div>
      <div className="text-[12px] text-chalk-dim mt-2.5">
        {teamScore.pointsRemaining} point{teamScore.pointsRemaining === 1 ? "" : "s"} remaining
      </div>
      {teamScore.clinchedSide ? (
        <div className="text-[12.5px] font-bold text-turf mt-1.5">
          {teamScore.clinchedSide === "tied"
            ? "Cup halved"
            : `${teamScore.clinchedSide === "A" ? teamAName : teamBName} wins the Cup!`}
        </div>
      ) : (
        <div className="text-[11.5px] text-chalk-dim mt-1.5">
          {teamAName} needs {teamScore.neededToWinA} to win · {teamBName} needs {teamScore.neededToWinB} to win
        </div>
      )}
    </div>
  );
}
