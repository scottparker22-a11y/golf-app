"use client";

import { useMemo, useState } from "react";
import type { Hole, HoleScore, Player } from "@/lib/types";
import { calculateIndividualLeaderboard, calculateSkins, skinsWonByPlayer } from "@/lib/scoring";

type TeamDef = { id: string; name: string; playerIds: string[] };

export default function Leaderboard({
  players,
  holes,
  holeScores,
  teams,
}: {
  players: Player[];
  holes: Hole[];
  holeScores: HoleScore[];
  teams: TeamDef[];
}) {
  const [view, setView] = useState<"team" | "individual">("team");

  const individual = useMemo(
    () => calculateIndividualLeaderboard(holeScores, players, holes),
    [holeScores, players, holes]
  );

  const skinsResults = useMemo(
    () => calculateSkins(holeScores, players, holes, { usesHandicap: false, carryover: true }, {}),
    [holeScores, players, holes]
  );
  const skinsByPlayer = useMemo(() => skinsWonByPlayer(skinsResults), [skinsResults]);

  const teamStandings = useMemo(() => {
    return teams
      .map(team => {
        const members = individual.filter(p => team.playerIds.includes(p.playerId));
        const total = members.reduce((sum, m) => sum + m.relativeToPar, 0);
        const holesPlayed = Math.min(...members.map(m => m.holesPlayed));
        const skinsCount = team.playerIds.reduce((sum, id) => sum + (skinsByPlayer[id] ?? 0), 0);
        return { ...team, total, holesPlayed, skinsCount };
      })
      .sort((a, b) => a.total - b.total);
  }, [teams, individual, skinsByPlayer]);

  const formatScore = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
  const scoreColor = (n: number) => (n < 0 ? "text-turf" : "text-chalk");

  return (
    <div>
      <div className="flex gap-1 mx-5 mt-4 p-1 bg-surface border border-[color:var(--border)] rounded-xl">
        <button
          onClick={() => setView("team")}
          className={`flex-1 text-sm font-semibold py-2 rounded-lg ${
            view === "team" ? "bg-surface-raised text-chalk" : "text-chalk-dim"
          }`}
        >
          Team
        </button>
        <button
          onClick={() => setView("individual")}
          className={`flex-1 text-sm font-semibold py-2 rounded-lg ${
            view === "individual" ? "bg-surface-raised text-chalk" : "text-chalk-dim"
          }`}
        >
          Individual
        </button>
      </div>

      {view === "team" ? (
        <div className="px-3 pt-4 pb-1">
          {teamStandings.map((team, i) => (
            <div
              key={team.id}
              className={`grid grid-cols-[34px_1fr_auto] items-center gap-3 p-3 rounded-xl mb-1.5 ${
                i === 0 ? "bg-surface-raised border border-[color:var(--border-strong)]" : ""
              }`}
            >
              <div className={`font-display font-extrabold text-xl text-center ${i === 0 ? "text-sand" : "text-chalk-dim"}`}>
                {i + 1}
              </div>
              <div>
                <div className="text-[15px] font-semibold">{team.name}</div>
                {team.skinsCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-flag/15 text-flag mt-1">
                    {team.skinsCount} skin{team.skinsCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div className="text-right">
                <div className={`font-mono font-semibold text-lg ${scoreColor(team.total)}`}>{formatScore(team.total)}</div>
                <div className="text-[11px] text-chalk-dim">thru {team.holesPlayed}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-3 pt-4 pb-1">
          <div className="flex items-start gap-2 mx-2 mb-3 p-2.5 bg-surface border border-[color:var(--border)] rounded-lg text-xs text-chalk-dim leading-relaxed">
            Gross totals from individually-recorded holes only. Scramble/alt-shot holes are
            excluded since only a team score exists for those.
          </div>
          {individual.map((p, i) => (
            <div
              key={p.playerId}
              className={`grid grid-cols-[34px_auto_1fr_auto] items-center gap-3 p-3 rounded-xl mb-1.5 ${
                i === 0 ? "bg-surface-raised border border-[color:var(--border-strong)]" : ""
              }`}
            >
              <div className={`font-display font-extrabold text-xl text-center ${i === 0 ? "text-sand" : "text-chalk-dim"}`}>
                {i + 1}
              </div>
              <div className="w-[30px] h-[30px] rounded-full bg-surface-raised text-chalk-dim text-xs font-bold flex items-center justify-center">
                {p.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div>
                <div className="text-[15px] font-semibold">{p.name}</div>
                {(skinsByPlayer[p.playerId] ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-flag/15 text-flag mt-1">
                    {skinsByPlayer[p.playerId]} skin{skinsByPlayer[p.playerId] === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div className="text-right">
                <div className={`font-mono font-semibold text-lg ${scoreColor(p.relativeToPar)}`}>
                  {formatScore(p.relativeToPar)}
                </div>
                <div className="text-[11px] text-chalk-dim">{p.holesPlayed} holes</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
