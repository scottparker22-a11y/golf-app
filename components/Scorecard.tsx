"use client";

import { useEffect, useMemo, useState } from "react";
import type { Hole, HoleScore, Player } from "@/lib/types";
import {
  approxCourseHandicap,
  calculateTwoManMatchPlay,
  formatTwoManMargin,
  strokesReceived,
  usesPairing,
  type TwoManMatchPlayResult,
} from "@/lib/scoring";
import { useLiveRound } from "@/lib/liveRound";

// Same color scale everywhere strokes-relative-to-par shows up on the
// Scorecard — the grid cells and ScoreStatSheet's Score stepper alike.
function relToParClass(strokes: number | undefined, par: number): string {
  if (strokes === undefined) return "text-chalk-dim";
  if (strokes <= par - 1) return "text-turf";
  if (strokes === par) return "text-chalk";
  if (strokes === par + 1) return "text-sand";
  return "text-flag";
}

export default function Scorecard({ roundId }: { roundId: string }) {
  const [mode, setMode] = useState<"players" | "teams">("players");
  // Which cell's entry sheet is open. When stats are on, this is the
  // ONLY way strokes get entered too (see ScoreStatSheet below) — not
  // just Fairway/GIR/Putts — since a plain number input pops the
  // on-screen keyboard, which then sits on top of (or fights with) the
  // stat sheet on mobile. See handleCellClick.
  const [expandedCell, setExpandedCell] = useState<{ groupId: string; playerId: string; holeNumber: number } | null>(
    null
  );

  // Live, shared with every other device scoring this same round.
  const { loading, error, players, holes, teams, holeScores, trackStats, setStroke, setHoleStat, clearStroke } =
    useLiveRound(roundId);

  const courseHandicaps = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of players) map[p.id] = approxCourseHandicap(p.handicapIndex);
    return map;
  }, [players]);

  // Groups set up with 2-man pairing (Best Ball, or Stroke Play opted
  // into "Teams of 2" — see FoursomesStep.tsx) get head-to-head match
  // play in Teams mode: whoever's best ball is lower wins the hole
  // (highlighted below), with a running Up/Down/Square status row —
  // same idea as the "We/They +/-" row on a paper scorecard. Gross
  // only, keyed by group id.
  const matchPlayByGroup = useMemo(() => {
    const map: Record<string, TwoManMatchPlayResult> = {};
    for (const team of teams) {
      if (!usesPairing(team)) continue;
      map[team.id] = calculateTwoManMatchPlay(holeScores, players, holes, team);
    }
    return map;
  }, [teams, holeScores, players, holes]);

  const scoreFor = (playerId: string, holeNumber: number) =>
    holeScores.find(s => s.playerId === playerId && s.holeNumber === holeNumber)?.strokes;

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

  // With stats on, every stroke box (empty or not) opens the combined
  // score + stat sheet instead of taking direct keyboard input — see
  // ScoreStatSheet. Without stats, cells stay plain number inputs.
  const handleCellClick = (groupId: string, playerId: string, holeNumber: number) => {
    if (!trackStats) return;
    setExpandedCell({ groupId, playerId, holeNumber });
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

  // Running fairway/GIR/putts totals for the whole round so far — only
  // shown once stats are on (columns tacked on after TOT, same visual
  // treatment as OUT/IN/TOT). Fairway Hit is skipped on par-3s in the
  // entry sheet, so it's excluded from that denominator too; "attempted"
  // for both counts only holes where a Yes/No has actually been
  // recorded, not every hole in the round, so the fraction reads
  // correctly mid-round rather than looking like a bunch of misses.
  const fairwayStats = (playerId: string) => {
    let hits = 0;
    let attempted = 0;
    for (const h of holes) {
      if (h.par === 3) continue;
      const fh = holeScores.find(s => s.playerId === playerId && s.holeNumber === h.number)?.fairwayHit;
      if (fh === true) hits++;
      if (fh === true || fh === false) attempted++;
    }
    return { hits, attempted };
  };

  const girStats = (playerId: string) => {
    let hits = 0;
    let attempted = 0;
    for (const h of holes) {
      const gir = holeScores.find(s => s.playerId === playerId && s.holeNumber === h.number)?.gir;
      if (gir === true) hits++;
      if (gir === true || gir === false) attempted++;
    }
    return { hits, attempted };
  };

  const puttsTotal = (playerId: string) => {
    let total = 0;
    let count = 0;
    for (const h of holes) {
      const putts = holeScores.find(s => s.playerId === playerId && s.holeNumber === h.number)?.putts;
      if (typeof putts === "number") {
        total += putts;
        count++;
      }
    }
    return count ? total : undefined;
  };

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
        <>
          <div className="flex gap-1 mb-2 p-1 bg-surface border border-[color:var(--border)] rounded-xl">
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
          {mode === "teams" && (
            <p className="text-[11.5px] text-chalk-dim leading-relaxed mb-4">
              Head-to-head, best ball per hole — the highlighted box is whoever's score won the
              hole. The Match row tracks who's up (E = even).
            </p>
          )}
        </>
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
                  {trackStats && (
                    <>
                      <th className={subtotalHeaderClass}>FH</th>
                      <th className={subtotalHeaderClass}>GIR</th>
                      <th className={subtotalHeaderClass}>PUTT</th>
                    </>
                  )}
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
                  {trackStats && (
                    <>
                      <th className={subtotalHeaderClass} />
                      <th className={subtotalHeaderClass} />
                      <th className={subtotalHeaderClass} />
                    </>
                  )}
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
                  {trackStats && (
                    <>
                      <th className={subtotalHeaderClass} />
                      <th className={subtotalHeaderClass} />
                      <th className={subtotalHeaderClass} />
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const renderPlayerRow = (playerId: string, winningHoles: Set<number>) => {
                    const p = players.find(pl => pl.id === playerId);
                    if (!p) return null;
                    const courseHandicap = courseHandicapFor(playerId);

                    const renderHoleCell = (h: Hole) => {
                      const strokes = scoreFor(playerId, h.number);
                      const getsStroke = strokesReceived(h, courseHandicap) > 0;
                      const wonHole = winningHoles.has(h.number);
                      const cellClass = `w-[36px] h-[32px] text-center bg-surface-raised border rounded-md font-mono font-semibold outline-none focus:border-turf ${relToParClass(
                        strokes,
                        h.par
                      )} ${
                        wonHole
                          ? "border-turf ring-2 ring-turf/50"
                          : getsStroke
                          ? "border-sand"
                          : "border-[color:var(--border-strong)]"
                      }`;
                      return (
                        <td key={h.number} className="p-0.5">
                          <div className="relative">
                            {trackStats ? (
                              // A native number input pops the on-screen
                              // keyboard, which then covers (or fights
                              // with) the stat sheet on mobile — so with
                              // stats on, the cell itself is just a
                              // button that opens the combined score +
                              // stat sheet (see ScoreStatSheet) instead
                              // of taking direct keyboard input.
                              <button
                                type="button"
                                onClick={() => handleCellClick(team.id, playerId, h.number)}
                                className={cellClass}
                              >
                                {strokes ?? ""}
                              </button>
                            ) : (
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={15}
                                value={strokes ?? ""}
                                onChange={e => handleChange(team.id, playerId, h.number, e.target.value)}
                                className={cellClass}
                              />
                            )}
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
                          <span className="text-chalk-dim font-mono text-[10px] ml-1">({courseHandicap})</span>
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
                        {trackStats &&
                          (() => {
                            const fh = fairwayStats(playerId);
                            const gir = girStats(playerId);
                            const putts = puttsTotal(playerId);
                            return (
                              <>
                                <td className={subtotalCellClass}>
                                  {fh.attempted ? `${fh.hits}/${fh.attempted}` : "–"}
                                </td>
                                <td className={subtotalCellClass}>
                                  {gir.attempted ? `${gir.hits}/${gir.attempted}` : "–"}
                                </td>
                                <td className={subtotalCellClass}>{putts ?? "–"}</td>
                              </>
                            );
                          })()}
                      </tr>
                    );
                  };

                  if (mode !== "teams" || !usesPairing(team)) {
                    return team.playerIds.map(playerId => renderPlayerRow(playerId, new Set()));
                  }

                  const match = matchPlayByGroup[team.id];
                  if (!match) return team.playerIds.map(playerId => renderPlayerRow(playerId, new Set()));

                  // Which holes each player actually won, for the input
                  // highlight — a hole can have zero (halved), one, or
                  // both of a pair's players highlighted (tied within
                  // the pair for that pair's best ball).
                  const winsByPlayer: Record<string, Set<number>> = {};
                  for (const id of team.playerIds) winsByPlayer[id] = new Set();
                  for (const hr of match.holeResults) {
                    for (const id of hr.winningPlayerIds) winsByPlayer[id]?.add(hr.hole);
                  }

                  // "Status at the turn/end" — the last decided hole's
                  // margin within that segment, same as how a paper
                  // scorecard's We/They row reads at OUT/IN.
                  const marginAt = (hs: Hole[]) => {
                    const decided = match.holeResults.filter(
                      hr => hr.decided && hs.some(h => h.number === hr.hole)
                    );
                    return decided.length ? decided[decided.length - 1].margin : null;
                  };

                  const renderMatchHoleCell = (h: Hole) => {
                    const hr = match.holeResults.find(r => r.hole === h.number);
                    return (
                      <td key={h.number} className="p-0.5">
                        <div
                          className={`w-[36px] h-[32px] flex items-center justify-center font-mono font-bold text-[11px] rounded-md ${
                            hr?.decided
                              ? hr.winner === "halved"
                                ? "text-chalk-dim"
                                : "text-turf"
                              : "text-chalk-dim"
                          }`}
                        >
                          {hr?.decided ? formatTwoManMargin(hr.margin as number) : "–"}
                        </div>
                      </td>
                    );
                  };

                  return (
                    <>
                      {match.pairing1.playerIds.map(id => renderPlayerRow(id, winsByPlayer[id] ?? new Set()))}
                      <tr aria-hidden className="h-2">
                        <td className="sticky left-0 z-10 bg-fairway-950 p-0 border-r border-[color:var(--border-strong)]" />
                        <td colSpan={100} className="bg-fairway-950 p-0" />
                      </tr>
                      {match.pairing2.playerIds.map(id => renderPlayerRow(id, winsByPlayer[id] ?? new Set()))}
                      <tr className="border-t border-[color:var(--border-strong)] bg-surface-raised/40">
                        <td className="sticky left-0 z-10 bg-surface-raised/40 px-2.5 py-1.5 font-bold text-[11px] uppercase tracking-wide text-chalk-dim whitespace-nowrap border-r border-[color:var(--border-strong)]">
                          Match
                        </td>
                        {frontHoles.map(renderMatchHoleCell)}
                        {hasBack && (
                          <td className={subtotalCellClass}>
                            {marginAt(frontHoles) !== null ? formatTwoManMargin(marginAt(frontHoles) as number) : "–"}
                          </td>
                        )}
                        {backHoles.map(renderMatchHoleCell)}
                        {hasBack && (
                          <td className={subtotalCellClass}>
                            {marginAt(backHoles) !== null ? formatTwoManMargin(marginAt(backHoles) as number) : "–"}
                          </td>
                        )}
                        <td className={subtotalCellClass}>
                          {marginAt(holes) !== null ? formatTwoManMargin(marginAt(holes) as number) : "–"}
                        </td>
                        {trackStats && (
                          <>
                            <td className={subtotalCellClass} />
                            <td className={subtotalCellClass} />
                            <td className={subtotalCellClass} />
                          </>
                        )}
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {expandedCell &&
        (() => {
          const hole = holes.find(h => h.number === expandedCell.holeNumber);
          const player = players.find(p => p.id === expandedCell.playerId);
          if (!hole || !player) return null;
          const score = holeScores.find(s => s.playerId === player.id && s.holeNumber === hole.number);
          const getsStroke = strokesReceived(hole, courseHandicapFor(player.id)) > 0;
          return (
            <ScoreStatSheet
              groupId={expandedCell.groupId}
              hole={hole}
              player={player}
              score={score}
              getsStroke={getsStroke}
              setStroke={setStroke}
              setHoleStat={setHoleStat}
              clearStroke={clearStroke}
              onClose={() => setExpandedCell(null)}
            />
          );
        })()}
    </div>
  );
}

// Combined score + stat entry, opened by tapping any stroke cell once
// stats are on (see handleCellClick above) — score itself is a +/−
// stepper here too, same as Putts, so nothing on this sheet ever pops
// the on-screen keyboard (which on mobile otherwise ends up covering,
// or fighting with, the sheet). Player/hole/par stay pinned at the
// top as a reminder of what's being entered. A hole with no stroke
// yet defaults straight to par the moment the sheet opens, so there's
// always a real, saved value to adjust from — same idea as Putts
// implicitly defaulting to 0.
function ScoreStatSheet({
  groupId,
  hole,
  player,
  score,
  getsStroke,
  setStroke,
  setHoleStat,
  clearStroke,
  onClose,
}: {
  groupId: string;
  hole: Hole;
  player: Player;
  score: HoleScore | undefined;
  /** Whether this player gets a handicap stroke on this hole — same dot as the grid cell. */
  getsStroke: boolean;
  setStroke: (groupId: string, playerId: string, holeNumber: number, strokes: number) => void;
  setHoleStat: (
    playerId: string,
    holeNumber: number,
    field: "fairwayHit" | "gir" | "putts",
    value: boolean | number | null
  ) => void;
  clearStroke: (playerId: string, holeNumber: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (score?.strokes === undefined) {
      setStroke(groupId, player.id, hole.number, hole.par);
    }
    // Only on open — deliberately not reacting to score changes after
    // that (this only ever needs to fire once, to seed a blank hole).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, hole.number, player.id]);

  const strokes = score?.strokes ?? hole.par;
  const putts = score?.putts ?? 0;

  const stepper = (
    value: number,
    onChange: (next: number) => void,
    min: number,
    valueClassName = "text-chalk"
  ) => (
    <div className="flex items-center justify-center gap-5">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-11 h-11 rounded-full bg-surface-raised border border-[color:var(--border-strong)] text-chalk text-xl font-bold flex items-center justify-center"
      >
        −
      </button>
      <div className={`font-mono text-2xl font-bold w-10 text-center ${valueClassName}`}>{value}</div>
      <button
        onClick={() => onChange(value + 1)}
        className="w-11 h-11 rounded-full bg-surface-raised border border-[color:var(--border-strong)] text-chalk text-xl font-bold flex items-center justify-center"
      >
        +
      </button>
    </div>
  );

  const yesNoRow = (field: "fairwayHit" | "gir", current: boolean | null | undefined) => (
    <div className="flex gap-2">
      <button
        onClick={() => setHoleStat(player.id, hole.number, field, true)}
        className={`flex-1 py-2.5 rounded-lg border font-bold text-sm ${
          current === true
            ? "bg-turf text-fairway-950 border-turf"
            : "bg-surface-raised border-[color:var(--border-strong)] text-chalk-dim"
        }`}
      >
        Yes
      </button>
      <button
        onClick={() => setHoleStat(player.id, hole.number, field, false)}
        className={`flex-1 py-2.5 rounded-lg border font-bold text-sm ${
          current === false
            ? "bg-flag text-white border-flag"
            : "bg-surface-raised border-[color:var(--border-strong)] text-chalk-dim"
        }`}
      >
        No
      </button>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 max-w-[460px] mx-auto bg-surface border-t border-[color:var(--border-strong)] rounded-t-2xl p-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim">
              Hole {hole.number} · Par {hole.par}
            </div>
            <div className="text-[16px] font-bold text-chalk">{player.name}</div>
          </div>
          <button onClick={onClose} className="text-turf text-[13px] font-bold px-3 py-2">
            Done
          </button>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim">Score</div>
              {getsStroke && (
                <span
                  title="Handicap stroke"
                  className="inline-block w-[6px] h-[6px] rounded-full bg-sand flex-shrink-0"
                />
              )}
            </div>
            <button
              onClick={() => {
                clearStroke(player.id, hole.number);
                onClose();
              }}
              className="text-[11px] font-bold text-chalk-dim underline"
            >
              Clear
            </button>
          </div>
          {stepper(
            strokes,
            next => setStroke(groupId, player.id, hole.number, Math.min(15, next)),
            1,
            relToParClass(strokes, hole.par)
          )}
        </div>

        {hole.par !== 3 && (
          <div className="mb-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-1.5">
              Fairway Hit
            </div>
            {yesNoRow("fairwayHit", score?.fairwayHit)}
          </div>
        )}

        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-1.5">
            Green in Regulation
          </div>
          {yesNoRow("gir", score?.gir)}
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-1.5">Putts</div>
          {stepper(putts, next => setHoleStat(player.id, hole.number, "putts", next), 0)}
        </div>
      </div>
    </>
  );
}
