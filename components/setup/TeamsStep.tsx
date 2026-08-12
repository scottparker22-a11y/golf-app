"use client";

import type { Player } from "@/lib/types";
import type {
  RyderCupGameConfig,
  RyderCupMatchConfig,
  RyderCupMatchFormat,
  RyderCupScoringBasis,
} from "@/lib/scoring";

export type RyderCupWizardConfig = RyderCupGameConfig & { enabled: boolean };

export const DEFAULT_RYDER_CUP_CONFIG: RyderCupWizardConfig = {
  enabled: false,
  teamAName: "USA",
  teamBName: "Europe",
  defaultPointValue: 1,
  matches: [],
};

const PLAYERS_PER_SIDE: Record<RyderCupMatchFormat, number> = { singles: 1, four_ball: 2 };

function blankMatch(matchNumber: number): RyderCupMatchConfig {
  return {
    id: crypto.randomUUID(),
    matchNumber,
    format: "singles",
    scoringBasis: "net",
    teamAPlayerIds: [],
    teamBPlayerIds: [],
    teeTime: null,
    pointValue: null,
    override: null,
  };
}

export default function TeamsStep({
  players,
  assignment,
  setAssignment,
  ryderCup,
  setRyderCup,
}: {
  players: Player[];
  assignment: Record<string, "A" | "B">;
  setAssignment: (a: Record<string, "A" | "B">) => void;
  ryderCup: RyderCupWizardConfig;
  setRyderCup: (r: RyderCupWizardConfig) => void;
}) {
  const autoBalance = () => {
    const sorted = [...players].sort((a, b) => a.handicapIndex - b.handicapIndex);
    const next: Record<string, "A" | "B"> = {};
    sorted.forEach((p, i) => {
      next[p.id] = i % 2 === 0 ? "A" : "B";
    });
    setAssignment(next);
  };

  const teamA = players.filter(p => assignment[p.id] === "A");
  const teamB = players.filter(p => assignment[p.id] === "B");
  const avg = (list: Player[]) =>
    list.length ? (list.reduce((s, p) => s + p.handicapIndex, 0) / list.length).toFixed(1) : "—";

  const updateMatch = (matchId: string, patch: Partial<RyderCupMatchConfig>) => {
    setRyderCup({
      ...ryderCup,
      matches: ryderCup.matches.map(m => (m.id === matchId ? { ...m, ...patch } : m)),
    });
  };

  const addMatch = () => {
    setRyderCup({ ...ryderCup, matches: [...ryderCup.matches, blankMatch(ryderCup.matches.length + 1)] });
  };

  const removeMatch = (matchId: string) => {
    setRyderCup({
      ...ryderCup,
      matches: ryderCup.matches
        .filter(m => m.id !== matchId)
        .map((m, i) => ({ ...m, matchNumber: i + 1 })),
    });
  };

  const toggleMatchPlayer = (matchId: string, side: "A" | "B", playerId: string) => {
    const match = ryderCup.matches.find(m => m.id === matchId);
    if (!match) return;
    const key = side === "A" ? "teamAPlayerIds" : "teamBPlayerIds";
    const current = match[key];
    const max = PLAYERS_PER_SIDE[match.format];
    const next = current.includes(playerId)
      ? current.filter(id => id !== playerId)
      : current.length < max
      ? [...current, playerId]
      : current;
    updateMatch(matchId, { [key]: next } as Partial<RyderCupMatchConfig>);
  };

  return (
    <div className="px-5 pt-4">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        Split the roster into two Ryder Cup teams. Auto-balance sorts by handicap for a fair split.
      </p>

      <button
        onClick={autoBalance}
        className="inline-flex items-center gap-1.5 bg-surface-raised border border-[color:var(--border-strong)] text-chalk text-[12.5px] font-bold px-3 py-2 rounded-lg mb-4"
      >
        ⚖ Auto-balance by handicap
      </button>

      <div className="flex gap-2.5 mb-5">
        {(["A", "B"] as const).map(side => (
          <div key={side} className="flex-1 bg-surface border border-[color:var(--border)] rounded-xl p-3">
            <div className="flex justify-between items-center mb-2.5">
              <input
                value={side === "A" ? ryderCup.teamAName : ryderCup.teamBName}
                onChange={e =>
                  setRyderCup(
                    side === "A" ? { ...ryderCup, teamAName: e.target.value } : { ...ryderCup, teamBName: e.target.value }
                  )
                }
                className="font-display font-extrabold text-base bg-transparent border-b border-dashed border-[color:var(--border-strong)] focus:border-turf outline-none min-w-0 w-[90px]"
              />
              <div className="text-[10.5px] text-chalk-dim font-mono">avg {avg(side === "A" ? teamA : teamB)}</div>
            </div>
            {(side === "A" ? teamA : teamB).map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-surface-raised rounded-lg px-2.5 py-1.5 mb-1.5">
                <div className="text-[12.5px] font-semibold flex-1">{p.name || "Unnamed"}</div>
                <div className="text-[11px] text-chalk-dim font-mono">{p.handicapIndex}</div>
                <button
                  onClick={() => setAssignment({ ...assignment, [p.id]: side === "A" ? "B" : "A" })}
                  className="text-[10px] text-turf font-bold"
                >
                  move
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <button
        onClick={() => setRyderCup({ ...ryderCup, enabled: !ryderCup.enabled })}
        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left mb-4 ${
          ryderCup.enabled ? "bg-turf/15 border-turf" : "bg-surface border-[color:var(--border)]"
        }`}
      >
        <span
          className={`w-[18px] h-[18px] rounded-md border-2 flex-shrink-0 flex items-center justify-center text-[11px] font-bold ${
            ryderCup.enabled ? "bg-turf border-turf text-fairway-950" : "border-chalk-dim"
          }`}
        >
          {ryderCup.enabled ? "✓" : ""}
        </span>
        <span>
          <div className="text-[13.5px] font-semibold">Enable Ryder Cup Style for this round</div>
          <div className="text-[11px] text-chalk-dim">
            Adds a live team match-play leaderboard, built from the same scores everyone enters on the
            Scorecard — nothing extra to enter.
          </div>
        </span>
      </button>

      {ryderCup.enabled && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim">
              Points per match, by default
            </span>
            <input
              type="number"
              min={0.5}
              step="0.5"
              value={ryderCup.defaultPointValue}
              onChange={e => setRyderCup({ ...ryderCup, defaultPointValue: parseFloat(e.target.value) || 0 })}
              className="w-16 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2 py-1.5 text-sm font-mono"
            />
          </div>

          <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-2">Matches</div>

          {ryderCup.matches.length === 0 && (
            <p className="text-[12.5px] text-chalk-dim mb-3">No matches yet — add one below.</p>
          )}

          <div className="flex flex-col gap-2.5 mb-3">
            {ryderCup.matches.map(match => {
              const max = PLAYERS_PER_SIDE[match.format];
              return (
                <div key={match.id} className="bg-surface border border-[color:var(--border)] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="font-display font-extrabold text-[15px]">Match {match.matchNumber}</div>
                    <button onClick={() => removeMatch(match.id)} className="text-[11px] font-bold text-flag">
                      Remove
                    </button>
                  </div>

                  <div className="flex gap-1.5 mb-2.5">
                    {(["singles", "four_ball"] as RyderCupMatchFormat[]).map(f => (
                      <button
                        key={f}
                        onClick={() =>
                          updateMatch(match.id, { format: f, teamAPlayerIds: [], teamBPlayerIds: [] })
                        }
                        className={`flex-1 text-[12px] font-bold py-1.5 rounded-lg border ${
                          match.format === f
                            ? "bg-turf text-fairway-950 border-turf"
                            : "bg-surface-raised text-chalk-dim border-[color:var(--border)]"
                        }`}
                      >
                        {f === "singles" ? "Singles" : "Four-Ball"}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-1.5 mb-2.5">
                    {(["gross", "net"] as RyderCupScoringBasis[]).map(b => (
                      <button
                        key={b}
                        onClick={() => updateMatch(match.id, { scoringBasis: b })}
                        className={`flex-1 text-[12px] font-bold py-1.5 rounded-lg border ${
                          match.scoringBasis === b
                            ? "bg-turf text-fairway-950 border-turf"
                            : "bg-surface-raised text-chalk-dim border-[color:var(--border)]"
                        }`}
                      >
                        Scoring: {b === "gross" ? "Gross" : "Net"}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2.5">
                    {(["A", "B"] as const).map(side => {
                      const roster = side === "A" ? teamA : teamB;
                      const selected = side === "A" ? match.teamAPlayerIds : match.teamBPlayerIds;
                      return (
                        <div key={side} className="flex-1">
                          <div className="text-[10px] font-bold text-chalk-dim mb-1">
                            {side === "A" ? ryderCup.teamAName : ryderCup.teamBName} ({selected.length}/{max})
                          </div>
                          <div className="flex flex-col gap-1">
                            {roster.length === 0 && (
                              <div className="text-[11px] text-chalk-dim italic">No players on this team</div>
                            )}
                            {roster.map(p => (
                              <button
                                key={p.id}
                                onClick={() => toggleMatchPlayer(match.id, side, p.id)}
                                className={`text-[11.5px] font-semibold text-left px-2 py-1.5 rounded-lg border ${
                                  selected.includes(p.id)
                                    ? "bg-turf/15 border-turf text-turf"
                                    : "bg-surface-raised border-[color:var(--border)] text-chalk-dim"
                                }`}
                              >
                                {p.name || "Unnamed"}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2.5 mt-2.5">
                    <input
                      value={match.teeTime ?? ""}
                      onChange={e => updateMatch(match.id, { teeTime: e.target.value || null })}
                      placeholder="Tee time (optional)"
                      className="flex-1 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2.5 py-1.5 text-[12px]"
                    />
                    <input
                      type="number"
                      min={0.5}
                      step="0.5"
                      value={match.pointValue ?? ""}
                      onChange={e =>
                        updateMatch(match.id, { pointValue: e.target.value === "" ? null : parseFloat(e.target.value) })
                      }
                      placeholder={`${ryderCup.defaultPointValue} pt`}
                      className="w-[70px] bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2.5 py-1.5 text-[12px] font-mono"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={addMatch}
            className="w-full py-2.5 rounded-xl border border-dashed border-[color:var(--border-strong)] text-[12.5px] font-bold text-chalk-dim"
          >
            + Add match
          </button>
        </>
      )}
    </div>
  );
}
