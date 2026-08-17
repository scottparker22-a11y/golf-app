"use client";

// Multi-round Stroke Play leaderboard — POS | PLAYER | SCORE (sortable)
// | one column per round played so far | TOT, matching a standard
// tour leaderboard. Data comes from lib/tournament.ts's fetch-once
// useTournamentData(tournamentId), which sums lib/scoring.ts
// calculateTournamentLeaderboard across every round linked to this
// tournament — unlike Leaderboard.tsx this isn't realtime, since it's
// a cross-round summary rather than the primary live-scoring surface.

import { useEffect, useState } from "react";
import { useTournamentData } from "@/lib/tournament";
import { fetchRyderCupTeamScoreForTrip, type RyderCupTripScore } from "@/lib/rounds";
import RyderCupScoreBanner from "./RyderCupScoreBanner";

function formatScore(n: number): string {
  return n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`;
}

const scoreColor = (n: number) => (n < 0 ? "text-turf" : n > 0 ? "text-chalk" : "text-chalk-dim");

export default function TournamentLeaderboard({
  tripId,
  tournamentId,
}: {
  tripId: string;
  tournamentId: string;
}) {
  const { loading, error, standings, roundsMeta, totalRounds, usesHandicap } = useTournamentData(tournamentId);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Trip-wide Ryder Cup score, same fetch-once pattern as
  // Leaderboard.tsx — shown above the table for the same reason: it's
  // the number people check first on a multi-round trip.
  const [ryderCupTripScore, setRyderCupTripScore] = useState<RyderCupTripScore | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchRyderCupTeamScoreForTrip(tripId)
      .then(score => {
        if (!cancelled) setRyderCupTripScore(score);
      })
      .catch(() => {
        // Non-fatal — the tournament table still renders below.
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  if (loading) {
    return <div className="px-5 pt-8 text-sm text-chalk-dim">Loading tournament…</div>;
  }
  if (error) {
    return (
      <div className="mx-5 mt-4 p-3 bg-flag/10 border border-flag/30 rounded-xl text-[12.5px] text-flag">
        {error}
      </div>
    );
  }

  const sorted = sortDir === "asc" ? standings : [...standings].reverse();
  const columnCount = 3 + roundsMeta.length + 1;

  return (
    <div>
      {ryderCupTripScore && (
        <div className="mx-5 mt-4">
          <RyderCupScoreBanner
            teamAName={ryderCupTripScore.teamAName}
            teamBName={ryderCupTripScore.teamBName}
            teamScore={ryderCupTripScore.teamScore}
          />
        </div>
      )}

      <div className="px-5 pt-4">
        <p className="text-[12.5px] text-chalk-dim leading-relaxed">
          {roundsMeta.length} of {totalRounds} round{totalRounds === 1 ? "" : "s"} played so far —
          cumulative {usesHandicap ? "net" : "gross"} strokes, individually-recorded holes only.
        </p>
      </div>

      <div className="mx-3 mt-3 mb-6 bg-surface border border-[color:var(--border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-[color:var(--border)]">
                <th className="text-center px-2 py-2.5 text-chalk-dim font-semibold text-[10.5px] uppercase whitespace-nowrap">
                  Pos
                </th>
                <th className="text-left px-2.5 py-2.5 text-chalk-dim font-semibold text-[10.5px] uppercase whitespace-nowrap">
                  Player
                </th>
                <th className="px-2 py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => setSortDir(d => (d === "asc" ? "desc" : "asc"))}
                    className="inline-flex items-center gap-1 text-chalk-dim font-semibold text-[10.5px] uppercase"
                  >
                    Score {sortDir === "asc" ? "▲" : "▼"}
                  </button>
                </th>
                {roundsMeta.map((r, i) => (
                  <th
                    key={r.roundId}
                    className="text-right px-2 py-2.5 text-chalk-dim font-semibold text-[10.5px] uppercase whitespace-nowrap"
                  >
                    R{i + 1}
                  </th>
                ))}
                <th className="text-right px-2.5 py-2.5 text-chalk-dim font-semibold text-[10.5px] uppercase whitespace-nowrap">
                  Tot
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr key={p.playerId} className="border-t border-[color:var(--border)]">
                  <td className="text-center px-2 py-2.5 font-mono font-bold text-chalk-dim">{p.positionLabel}</td>
                  <td className="px-2.5 py-2.5 font-semibold whitespace-nowrap">{p.name}</td>
                  <td className={`text-right px-2 py-2.5 font-mono font-bold ${scoreColor(p.relativeToPar)}`}>
                    {formatScore(p.relativeToPar)}
                  </td>
                  {p.rounds.map(r => (
                    <td key={r.roundId} className="text-right px-2 py-2.5 font-mono text-chalk-dim">
                      {r.strokes ?? "—"}
                    </td>
                  ))}
                  <td className="text-right px-2.5 py-2.5 font-mono font-semibold">{p.totalStrokes}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="text-center px-2.5 py-6 text-chalk-dim text-[12.5px]">
                    No scores posted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
