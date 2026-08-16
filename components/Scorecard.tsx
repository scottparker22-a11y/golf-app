"use client";

import { useMemo, useState } from "react";
import type { Hole } from "@/lib/types";
import {
  approxCourseHandicap,
  calculateTwoManTeamStandings,
  strokesReceived,
  usesPairing,
} from "@/lib/scoring";
import { useLiveRound } from "@/lib/liveRound";

export default function Scorecard({ roundId }: { roundId: string }) {
  const [mode, setMode] = useState<"players" | "teams">("players");

  // Live, shared with every other device scoring this same round.
  const { loading, error, players, holes, teams, holeScores, setStroke, clearStroke } =
    useLiveRound(roundId);

  const courseHandicaps = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of players) map[p.id] = approxCourseHandicap(p.handicapIndex);
    return map;
  }, [players]);

  // Groups set up with 2-man pairing (Best Ball, or Stroke Play opted
  // into "Teams of 2" — see FoursomesStep.tsx). Same computation the
  // Leaderboard's Team view uses; here it also drives the Teams
  // toggle's per-hole cells via grossByHole.
  const twoManStandings = useMemo(
    () => calculateTwoManTeamStandings(holeScores, players, holes, teams.filter(usesPairing), courseHandicaps),
    [teams, holeScores, players, holes, courseHandicaps]
  );

  const scoreFor = (playerId: string, holeNumber: number) =>
    holeScores.find(s => s.playerId === playerId && s.holeNumber === holeNumber)?.strokes;

  const relToParClass = (strokes: number | undefined, par: number) => {
    if (strokes === undefined) return "text-chalk-dim";
    if (strokes <= par - 1) return "text-turf";
    if (strokes === par) return "text-chalk";
    if (strokes === par + 1) return "text-sand";
    return "text-flag";
  };

  // Handicap strokes per hole, per player — based on the same
  // approxCourseHandicap simplification used on the leaderboard, until
  // real course slope/rating data is wired up (see lib/scoring.ts).
  const courseHandicapFor = (playerId: string) => {
    const p = players.find(pl => pl.id === playerId);
    return p ? approxCourseHandicap(p.handicapIndex) : 0;
  };

  const handleChange = (groupId: string, playerId: string, holeNumber: number, raw: string) => {
    if (raw === "") {
      clearStroke(playerId, holeNumber);
      return;
    }
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < 1 || n > 15) return;
    setStroke(groupId, playerId, holeNumber, n);
  };

  // Front 9 / back 9 split for the OUT / IN / TOT subtotal columns.
  const frontHoles = holes.filter(h => h.number <= 9);
  const backHoles = holes.filter(h => h.number > 9);
  const hasBack = backHoles.length > 0;

  const sumPar = (hs: Hole[]) => hs.reduce((sum, h) => sum + h.par, 0);

  const sumStrokes = (playerId: string, hs: Hole[]) => {
    const entered = hs
      .map(h => scoreFor(playerId, h.number))
      .filter((s): s is number => s !== undefined);
    return entered.length ? entered.reduce((sum, s) => sum + s, 0) : undefined;
  };

  const subtotalHeaderClass =
    "px-1.5 py-2 text-center font-bold text-[11px] bg-surface-raised border-l border-[color:var(--border-strong)]";
  const subtotalCellClass =
    "px-1.5 py-1.5 text-center font-mono font-bold bg-surface-raised border-l border-[color:var(--border-strong)]";

  if (loading) {
    return <div className="px-5 pt-8 text-sm text-chalk-dim">Loading scorecard…</div>;
  }
  if (error) {
    return (
      <div className="mx-5 mt-4 p-3 bg-flag/10 border border-flag/30 rounded-xl text-[12.5px] text-flag">
        Couldn&apos;t load the round: {error}
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 pb-8">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-2">
        Tap a box and enter strokes for each hole. Saves as you go — everyone in the trip sees
        it update live on their own phone, no refresh needed.
      </p>
      <p className="text-[11.5px] text-chalk-dim leading-relaxed mb-4 flex items-center gap-1.5">
        <span className="inline-block w-[6px] h-[6px] rounded-full bg-sand" />
        marks a handicap stroke on that hole. The number next to each name is their course
        handicap (approximate — see note below).
      </p>

      {teams.some(usesPairing) && (
        <div className="flex gap-1 mb-4 p-1 bg-surface border border-[color:var(--border)] rounded-xl">
          <button
            onClick={() => setMode("players")}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg ${
              mode === "players" ? "bg-surface-raised text-chalk" : "text-chalk-dim"
            }`}
          >
            Players
          </button>
          <button
            onClick={() => setMode("teams")}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg ${
              mode === "teams" ? "bg-surface-raised text-chalk" : "text-chalk-dim"
            }`}
          >
            Teams
          </button>
        </div>
      )}

      {teams.map(team => (
        <div key={team.id} className="mb-5">
          <div className="text-[13px] font-bold text-chalk mb-2">{team.name}</div>
          <div className="bg-surface border border-[color:var(--border)] rounded-xl overflow-x-auto">
            <table className="border-collapse text-[12px] w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-surface text-left px-2.5 py-2 text-chalk-dim font-semibold text-[11px] uppercase min-w-[68px] border-r border-[color:var(--border-strong)] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.25)]">
                    Hole
                  </th>
                  {frontHoles.map(h => (
                    <th key={h.number} className="px-1 py-2 text-chalk-dim font-semibold text-center w-[38px]">
                      {h.number}
                    </th>
                  ))}
                  {hasBack && <th className={subtotalHeaderClass}>OUT</th>}
                  {backHoles.map(h => (
                    <th key={h.number} className="px-1 py-2 text-chalk-dim font-semibold text-center w-[38px]">
                      {h.number}
                    </th>
                  ))}
                  {hasBack && <th className={subtotalHeaderClass}>IN</th>}
                  <th className={subtotalHeaderClass}>TOT</th>
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 bg-surface text-left px-2.5 py-1.5 text-chalk-dim font-medium text-[11px] border-r border-[color:var(--border-strong)] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.25)]">
                    Par
                  </th>
                  {frontHoles.map(h => (
                    <th key={h.number} className="px-1 py-1.5 text-chalk-dim font-mono text-center">
                      {h.par}
                    </th>
                  ))}
                  {hasBack && (
                    <th className={subtotalHeaderClass + " font-mono"}>{sumPar(frontHoles)}</th>
                  )}
                  {backHoles.map(h => (
                    <th key={h.number} className="px-1 py-1.5 text-chalk-dim font-mono text-center">
                      {h.par}
                    </th>
                  ))}
                  {hasBack && (
                    <th className={subtotalHeaderClass + " font-mono"}>{sumPar(backHoles)}</th>
                  )}
                  <th className={subtotalHeaderClass + " font-mono"}>{sumPar(holes)}</th>
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 bg-surface text-left px-2.5 py-1.5 text-chalk-dim font-medium text-[11px] border-r border-[color:var(--border-strong)] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.25)]">
                    Hcp
                  </th>
                  {frontHoles.map(h => (
                    <th key={h.number} className="px-1 py-1.5 text-chalk-dim font-mono text-center text-[10px]">
                      {h.strokeIndex}
                    </th>
                  ))}
                  {hasBack && <th className={subtotalHeaderClass} />}
                  {backHoles.map(h => (
                    <th key={h.number} className="px-1 py-1.5 text-chalk-dim font-mono text-center text-[10px]">
                      {h.strokeIndex}
                    </th>
                  ))}
                  {hasBack && <th className={subtotalHeaderClass} />}
                  <th className={subtotalHeaderClass} />
                </tr>
              </thead>
              <tbody>
                {mode === "teams" && usesPairing(team)
                  ? twoManStandings
                      .filter(pair => pair.groupId === team.id)
                      .map(pair => {
                        const sumTeamStrokes = (hs: Hole[]) => {
                          const entered = hs
                            .map(h => pair.grossByHole[h.number])
                            .filter((s): s is number => s !== undefined);
                          return entered.length ? entered.reduce((sum, s) => sum + s, 0) : undefined;
                        };
                        const renderTeamHoleCell = (h: Hole) => (
                          <td key={h.number} className="p-0.5">
                            <div
                              className={`w-[36px] h-[32px] flex items-center justify-center bg-surface-raised/60 border border-[color:var(--border)] rounded-md font-mono font-semibold ${relToParClass(
                                pair.grossByHole[h.number],
                                h.par
                              )}`}
                            >
                              {pair.grossByHole[h.number] ?? "–"}
                            </div>
                          </td>
                        );
                        return (
                          <tr key={pair.teamKey} className="border-t border-[color:var(--border)]">
                            <td className="sticky left-0 z-10 bg-surface px-2.5 py-1.5 font-semibold text-[12px] whitespace-nowrap border-r border-[color:var(--border-strong)] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.25)]">
                              {pair.name}
                            </td>
                            {frontHoles.map(renderTeamHoleCell)}
                            {hasBack && (
                              <td className={subtotalCellClass}>{sumTeamStrokes(frontHoles) ?? "–"}</td>
                            )}
                            {backHoles.map(renderTeamHoleCell)}
                            {hasBack && (
                              <td className={subtotalCellClass}>{sumTeamStrokes(backHoles) ?? "–"}</td>
                            )}
                            <td className={subtotalCellClass}>{sumTeamStrokes(holes) ?? "–"}</td>
                          </tr>
                        );
                      })
                  : team.playerIds.map(playerId => {
                      const p = players.find(pl => pl.id === playerId);
                      if (!p) return null;
                      const courseHandicap = courseHandicapFor(playerId);

                      const renderHoleCell = (h: Hole) => {
                        const strokes = scoreFor(playerId, h.number);
                        const getsStroke = strokesReceived(h, courseHandicap) > 0;
                        return (
                          <td key={h.number} className="p-0.5">
                            <div className="relative">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={15}
                                value={strokes ?? ""}
                                onChange={e =>
                                  handleChange(team.id, playerId, h.number, e.target.value)
                                }
                                className={`w-[36px] h-[32px] text-center bg-surface-raised border rounded-md font-mono font-semibold outline-none focus:border-turf ${relToParClass(
                                  strokes,
                                  h.par
                                )} ${getsStroke ? "border-sand" : "border-[color:var(--border-strong)]"}`}
                              />
                              {getsStroke && (
                                <span
                                  title="Handicap stroke"
                                  className="absolute top-[2px] right-[2px] w-[5px] h-[5px] rounded-full bg-sand pointer-events-none"
                                />
                              )}
                            </div>
                          </td>
                        );
                      };

                      return (
                        <tr key={playerId} className="border-t border-[color:var(--border)]">
                          <td className="sticky left-0 z-10 bg-surface px-2.5 py-1.5 font-semibold text-[12px] whitespace-nowrap border-r border-[color:var(--border-strong)] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.25)]">
                            {p.name}
                            <span className="text-chalk-dim font-mono text-[10px] ml-1">
                              ({courseHandicap})
                            </span>
                          </td>
                          {frontHoles.map(renderHoleCell)}
                          {hasBack && (
                            <td className={subtotalCellClass}>{sumStrokes(playerId, frontHoles) ?? "–"}</td>
                          )}
                          {backHoles.map(renderHoleCell)}
                          {hasBack && (
                            <td className={subtotalCellClass}>{sumStrokes(playerId, backHoles) ?? "–"}</td>
                          )}
                          <td className={subtotalCellClass}>{sumStrokes(playerId, holes) ?? "–"}</td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
