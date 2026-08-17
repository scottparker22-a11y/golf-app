"use client";

import { useEffect } from "react";
import type { GolfFormat, Player } from "@/lib/types";
import { usesPairing } from "@/lib/scoring";
import type { RyderCupMatchConfig } from "@/lib/scoring";
import type { RoundType } from "./SetupWizard";

export type Group = {
  id: string;
  playerIds: string[];
  format: GolfFormat;
  // Only meaningful when format === "stroke_play" — everyone still
  // posts their own individual score either way; this only decides
  // whether the foursome also gets split into 2-player sub-teams for
  // team-score purposes.
  strokePlayTeams: "none" | "pairs";
  // playerId -> "1" | "2", which of the two teammate pairs they're on
  // within this foursome. Independent of any trip-wide Ryder Cup teams —
  // this is for picking partners on rounds/games that aren't Ryder Cup.
  pairings: Record<string, "1" | "2">;
};

const FORMATS: { value: GolfFormat; label: string }[] = [
  { value: "stroke_play", label: "Stroke Play" },
  { value: "best_ball", label: "Best Ball" },
  { value: "scramble", label: "Scramble" },
  { value: "alt_shot", label: "Alt Shot" },
];

function defaultPairings(ids: string[]): Record<string, "1" | "2"> {
  const pairings: Record<string, "1" | "2"> = {};
  ids.forEach((id, i) => {
    pairings[id] = i % 2 === 0 ? "1" : "2";
  });
  return pairings;
}

// One physical group per Ryder Cup match — a Four-Ball match's 4
// players (2 per side) become one Best Ball foursome with the same
// A/B split already decided on the Ryder Cup tab; a Singles match's 2
// players become their own twosome, plain Stroke Play (nothing to
// team up — it's 1 vs 1). Matches still missing a player on either
// side are skipped; there's no group to build from an incomplete one.
function groupsFromRyderCupMatches(matches: RyderCupMatchConfig[]): Group[] {
  return matches
    .filter(m => m.teamAPlayerIds.length > 0 && m.teamBPlayerIds.length > 0)
    .map(m => {
      const isFourBall = m.format === "four_ball";
      const pairings: Record<string, "1" | "2"> = {};
      if (isFourBall) {
        m.teamAPlayerIds.forEach(id => (pairings[id] = "1"));
        m.teamBPlayerIds.forEach(id => (pairings[id] = "2"));
      }
      return {
        id: crypto.randomUUID(),
        playerIds: [...m.teamAPlayerIds, ...m.teamBPlayerIds],
        format: isFourBall ? "best_ball" : "stroke_play",
        strokePlayTeams: "none",
        pairings,
      };
    });
}

export default function FoursomesStep({
  players,
  groups,
  setGroups,
  roundType,
  ryderCupMatches,
}: {
  players: Player[];
  groups: Group[];
  setGroups: (g: Group[]) => void;
  /** See lib/scoring.ts's Ryder Cup types — used to auto-pull groups below when this round is Ryder Cup. */
  roundType: RoundType;
  ryderCupMatches: RyderCupMatchConfig[];
}) {
  const isRyderCup = roundType === "ryder_cup";
  const completeRyderCupMatches = ryderCupMatches.filter(
    m => m.teamAPlayerIds.length > 0 && m.teamBPlayerIds.length > 0
  );

  // Auto-pull the moment there's something to pull and nothing's been
  // built here yet — same "fill in a sensible default, don't clobber
  // what's already there" rule the rest of the wizard follows (see
  // SetupWizard.tsx's course-order/course-id auto-fills). The "Pull
  // groups from Ryder Cup matches" button below covers re-syncing
  // after matches change later.
  useEffect(() => {
    if (isRyderCup && groups.length === 0 && completeRyderCupMatches.length > 0) {
      setGroups(groupsFromRyderCupMatches(completeRyderCupMatches));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRyderCup, completeRyderCupMatches.length, groups.length]);

  const autoFill = () => {
    const sorted = [...players].sort((a, b) => a.handicapIndex - b.handicapIndex);
    const size = 4;
    const next: Group[] = [];
    for (let i = 0; i < sorted.length; i += size) {
      const playerIds = sorted.slice(i, i + size).map(p => p.id);
      next.push({
        id: crypto.randomUUID(),
        playerIds,
        format: "stroke_play",
        strokePlayTeams: "none",
        pairings: defaultPairings(playerIds),
      });
    }
    setGroups(next);
  };

  const pullFromRyderCup = () => {
    setGroups(groupsFromRyderCupMatches(completeRyderCupMatches));
  };

  const avgHcp = (ids: string[]) => {
    const list = players.filter(p => ids.includes(p.id));
    return list.length ? (list.reduce((s, p) => s + p.handicapIndex, 0) / list.length).toFixed(1) : "—";
  };

  const movePlayerToGroup = (playerId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = groups.map(g => ({ ...g, playerIds: [...g.playerIds], pairings: { ...g.pairings } }));
    next[fromIndex].playerIds = next[fromIndex].playerIds.filter(id => id !== playerId);
    delete next[fromIndex].pairings[playerId];
    next[toIndex].playerIds = [...next[toIndex].playerIds, playerId];
    next[toIndex].pairings[playerId] = "1";
    setGroups(next);
  };

  const MoveSelect = ({ playerId, groupIndex }: { playerId: string; groupIndex: number }) =>
    groups.length > 1 ? (
      <select
        value={groupIndex}
        onChange={e => movePlayerToGroup(playerId, groupIndex, Number(e.target.value))}
        onClick={e => e.stopPropagation()}
        aria-label="Move to a different foursome"
        className="bg-surface-raised border border-[color:var(--border-strong)] rounded-md text-[10.5px] font-semibold text-chalk-dim px-1.5 py-1 flex-shrink-0"
      >
        {groups.map((_, i) => (
          <option key={i} value={i}>
            {i === groupIndex ? `Group ${i + 1}` : `→ Group ${i + 1}`}
          </option>
        ))}
      </select>
    ) : null;

  return (
    <div className="px-5 pt-4">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        {isRyderCup
          ? "Groups for the round — pulled straight from your Ryder Cup matches by default, since those already decide who's playing together. Auto-fill (by handicap) or manual edits still work if you'd rather build them yourself."
          : "Groups for the round — auto-fill spreads handicaps evenly, or build them manually. Use the group dropdown next to a player to move them to a different foursome."}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {isRyderCup && completeRyderCupMatches.length > 0 && (
          <button
            onClick={pullFromRyderCup}
            className="inline-flex items-center gap-1.5 bg-turf/15 border border-turf text-turf text-[12.5px] font-bold px-3 py-2 rounded-lg"
          >
            ⛳ Pull groups from Ryder Cup matches
          </button>
        )}
        <button
          onClick={autoFill}
          className="inline-flex items-center gap-1.5 bg-surface-raised border border-[color:var(--border-strong)] text-chalk text-[12.5px] font-bold px-3 py-2 rounded-lg"
        >
          ⤨ Auto-fill foursomes
        </button>
      </div>

      {groups.map((group, gi) => (
        <div key={group.id} className="bg-surface border border-[color:var(--border)] rounded-xl p-3.5 mb-3">
          <div className="flex justify-between items-center mb-2.5">
            <div className="font-display font-extrabold text-[17px]">Group {gi + 1}</div>
            <div className="text-[11px] text-chalk-dim font-mono">avg {avgHcp(group.playerIds)}</div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto mb-3 pb-0.5">
            {FORMATS.map(f => (
              <button
                key={f.value}
                onClick={() => {
                  const next = [...groups];
                  next[gi] = { ...group, format: f.value };
                  setGroups(next);
                }}
                className={`flex-shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-full border whitespace-nowrap ${
                  group.format === f.value
                    ? "bg-turf text-fairway-950 border-turf"
                    : "bg-surface-raised text-chalk-dim border-[color:var(--border-strong)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {group.format === "stroke_play" && (
            <div className="flex gap-1.5 mb-3">
              {(
                [
                  { value: "none" as const, label: "No Teams" },
                  { value: "pairs" as const, label: "Teams of 2" },
                ]
              ).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    const next = [...groups];
                    next[gi] = { ...group, strokePlayTeams: opt.value };
                    setGroups(next);
                  }}
                  className={`flex-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${
                    group.strokePlayTeams === opt.value
                      ? "bg-sand/15 border-sand text-sand"
                      : "bg-surface-raised text-chalk-dim border-[color:var(--border-strong)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {usesPairing(group) ? (
            <>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-2">
                Teammates for this foursome
              </div>
              <div className="flex gap-2">
                {(["1", "2"] as const).map(pair => (
                  <div key={pair} className="flex-1 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg p-2">
                    <div className="text-[10.5px] font-bold text-chalk-dim mb-1.5">Pair {pair}</div>
                    {group.playerIds
                      .filter(id => (group.pairings?.[id] ?? "1") === pair)
                      .map(id => {
                        const p = players.find(pl => pl.id === id);
                        if (!p) return null;
                        return (
                          <div key={id} className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            <div className="text-[12px] font-semibold flex-1 truncate min-w-0">{p.name}</div>
                            <button
                              onClick={() => {
                                const next = [...groups];
                                next[gi] = {
                                  ...group,
                                  pairings: {
                                    ...group.pairings,
                                    [id]: pair === "1" ? "2" : "1",
                                  },
                                };
                                setGroups(next);
                              }}
                              className="text-[10px] text-turf font-bold flex-shrink-0"
                            >
                              swap
                            </button>
                            <MoveSelect playerId={id} groupIndex={gi} />
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </>
          ) : (
            group.playerIds.map(id => {
              const p = players.find(pl => pl.id === id);
              if (!p) return null;
              return (
                <div key={id} className="flex items-center gap-2 bg-surface-raised rounded-lg px-2.5 py-1.5 mb-1.5">
                  <div className="text-[12.5px] font-semibold flex-1 min-w-0 truncate">{p.name}</div>
                  <div className="text-[11px] text-chalk-dim font-mono flex-shrink-0">{p.handicapIndex}</div>
                  <MoveSelect playerId={id} groupIndex={gi} />
                </div>
              );
            })
          )}
        </div>
      ))}
    </div>
  );
}
