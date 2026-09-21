"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { Player } from "@/lib/types";
import type { RyderCupGameConfig, RyderCupMatchConfig, RyderCupRoundFormat, RyderCupScoringBasis } from "@/lib/scoring";
import RyderCupFormatAndPairings from "./RyderCupFormatAndPairings";

export type RyderCupWizardConfig = RyderCupGameConfig & { enabled: boolean };

export const DEFAULT_RYDER_CUP_CONFIG: RyderCupWizardConfig = {
  enabled: false,
  teamAName: "USA",
  teamBName: "Europe",
  format: "singles",
  scoringBasis: "net",
  matches: [],
};

// Its own tab in the wizard (see SetupWizard.tsx), shown only while
// roundType === "ryder_cup" — Format.tsx just handles round
// count/join-detection/course order; this is where teams and
// this round's format/pairings actually get built. Every later round
// revisits/edits just the format+pairings part on its own screen (see
// components/RyderCupRoundEditor.tsx) without redoing the team split.
export default function TeamsStep({
  players,
  assignment,
  setAssignment,
  ryderCup,
  setRyderCup,
  locked,
}: {
  players: Player[];
  assignment: Record<string, "A" | "B">;
  // Dispatch, not a plain setter — several handlers below (toggling a
  // match player, moving someone between teams) need the functional
  // updater form so rapid clicks in the same event-batch each build on
  // the previous one instead of racing against a stale closure and
  // silently dropping earlier selections.
  setAssignment: Dispatch<SetStateAction<Record<string, "A" | "B">>>;
  ryderCup: RyderCupWizardConfig;
  setRyderCup: Dispatch<SetStateAction<RyderCupWizardConfig>>;
  /**
   * True when this round is joining a Ryder Cup that already has a
   * saved team split (see lib/rounds.ts ActiveRyderCupTournament) —
   * hides auto-balance/move so the same players stay on the same
   * side all tournament, per the user's request, instead of quietly
   * drifting round to round. Can still be unlocked here if a real
   * mid-tournament change is needed.
   */
  locked: boolean;
}) {
  const [forceUnlocked, setForceUnlocked] = useState(false);
  const effectiveLocked = locked && !forceUnlocked;

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
  // Players with no team yet — either brand new to the trip, or (only
  // possible when locked) added to the roster after the Cup's
  // original split. Always editable, lock or no lock, since there's
  // no "same as before" to preserve for someone with no history.
  const unassigned = players.filter(p => !assignment[p.id]);
  const avg = (list: Player[]) =>
    list.length ? (list.reduce((s, p) => s + p.handicapIndex, 0) / list.length).toFixed(1) : "—";

  const setFormat = (format: RyderCupRoundFormat) =>
    setRyderCup(prev => ({ ...prev, format, matches: format === "stableford" ? [] : prev.matches }));
  const setScoringBasis = (scoringBasis: RyderCupScoringBasis) => setRyderCup(prev => ({ ...prev, scoringBasis }));
  const setMatches = (matches: RyderCupMatchConfig[]) => setRyderCup(prev => ({ ...prev, matches }));

  return (
    <div className="px-5 pt-4">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        {effectiveLocked
          ? "Teams for this Ryder Cup were set on round 1 and carry over automatically — the same players stay on the same side all tournament."
          : "Split the roster into two Ryder Cup teams. Auto-balance sorts by handicap for a fair split."}
      </p>

      {effectiveLocked ? (
        <div className="flex items-center gap-2 mb-4 p-3 bg-sand/10 border border-sand/30 rounded-xl">
          <span className="text-sand text-sm flex-shrink-0">🔒</span>
          <span className="text-[12px] text-chalk-dim flex-1">Teams are locked for this Cup.</span>
          <button
            onClick={() => setForceUnlocked(true)}
            className="text-[11px] font-bold text-turf underline flex-shrink-0"
          >
            Unlock to edit anyway
          </button>
        </div>
      ) : (
        <button
          onClick={autoBalance}
          className="inline-flex items-center gap-1.5 bg-surface-raised border border-[color:var(--border-strong)] text-chalk text-[12.5px] font-bold px-3 py-2 rounded-lg mb-4"
        >
          ⚖ Auto-balance by handicap
        </button>
      )}

      <div className="flex gap-2.5 mb-3">
        {(["A", "B"] as const).map(side => (
          <div key={side} className="flex-1 bg-surface border border-[color:var(--border)] rounded-xl p-3">
            <div className="flex justify-between items-center mb-2.5">
              <input
                value={side === "A" ? ryderCup.teamAName : ryderCup.teamBName}
                onChange={e => {
                  const value = e.target.value;
                  setRyderCup(prev => (side === "A" ? { ...prev, teamAName: value } : { ...prev, teamBName: value }));
                }}
                disabled={effectiveLocked}
                className="font-display font-extrabold text-base bg-transparent border-b border-dashed border-[color:var(--border-strong)] focus:border-turf outline-none min-w-0 w-[90px] disabled:opacity-70"
              />
              <div className="text-[10.5px] text-chalk-dim font-mono">avg {avg(side === "A" ? teamA : teamB)}</div>
            </div>
            {(side === "A" ? teamA : teamB).map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-surface-raised rounded-lg px-2.5 py-1.5 mb-1.5">
                <div className="text-[12.5px] font-semibold flex-1">{p.name || "Unnamed"}</div>
                <div className="text-[11px] text-chalk-dim font-mono">{p.handicapIndex}</div>
                {!effectiveLocked && (
                  <button
                    onClick={() => setAssignment(prev => ({ ...prev, [p.id]: side === "A" ? "B" : "A" }))}
                    className="text-[10px] text-turf font-bold"
                  >
                    move
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {unassigned.length > 0 && (
        <div className="mb-5 p-3 bg-surface border border-dashed border-[color:var(--border-strong)] rounded-xl">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-2">
            Unassigned — new to this Cup
          </div>
          {unassigned.map(p => (
            <div key={p.id} className="flex items-center gap-2 bg-surface-raised rounded-lg px-2.5 py-1.5 mb-1.5">
              <div className="text-[12.5px] font-semibold flex-1">{p.name || "Unnamed"}</div>
              <button
                onClick={() => setAssignment(prev => ({ ...prev, [p.id]: "A" }))}
                className="text-[11px] font-bold px-2 py-1 rounded-md bg-turf/15 text-turf"
              >
                → {ryderCup.teamAName}
              </button>
              <button
                onClick={() => setAssignment(prev => ({ ...prev, [p.id]: "B" }))}
                className="text-[11px] font-bold px-2 py-1 rounded-md bg-flag/15 text-flag"
              >
                → {ryderCup.teamBName}
              </button>
            </div>
          ))}
        </div>
      )}

      <RyderCupFormatAndPairings
        format={ryderCup.format}
        setFormat={setFormat}
        scoringBasis={ryderCup.scoringBasis}
        setScoringBasis={setScoringBasis}
        matches={ryderCup.matches}
        setMatches={setMatches}
        teamAPlayers={teamA}
        teamBPlayers={teamB}
        teamAName={ryderCup.teamAName}
        teamBName={ryderCup.teamBName}
      />
    </div>
  );
}
