"use client";

// The part of a Ryder Cup round's setup shared between round 1 (built
// inline in the Setup Wizard's Ryder Cup tab, see TeamsStep.tsx) and
// every later round (built standalone on its own screen, see
// components/RyderCupRoundEditor.tsx): pick a format, pick a scoring
// basis, see the fixed points it's worth, then build pairings for it.
import type { Player } from "@/lib/types";
import {
  RYDER_CUP_MATCH_POINT_VALUE,
  RYDER_CUP_ROUND_FORMAT_LABEL,
  RYDER_CUP_STABLEFORD_POINT_VALUE,
  type RyderCupMatchConfig,
  type RyderCupRoundFormat,
  type RyderCupScoringBasis,
} from "@/lib/scoring";
import RyderCupPairingsEditor from "./RyderCupPairingsEditor";

const ROUND_FORMATS: RyderCupRoundFormat[] = ["singles", "four_ball", "stableford"];

export default function RyderCupFormatAndPairings({
  format,
  setFormat,
  scoringBasis,
  setScoringBasis,
  matches,
  setMatches,
  teamAPlayers,
  teamBPlayers,
  teamAName,
  teamBName,
  formatDisabled,
  pairingsDisabled,
}: {
  format: RyderCupRoundFormat;
  setFormat: (f: RyderCupRoundFormat) => void;
  scoringBasis: RyderCupScoringBasis;
  setScoringBasis: (b: RyderCupScoringBasis) => void;
  matches: RyderCupMatchConfig[];
  setMatches: (m: RyderCupMatchConfig[]) => void;
  teamAPlayers: Player[];
  teamBPlayers: Player[];
  teamAName: string;
  teamBName: string;
  /** Locks the format/scoring-basis pickers — a round underway can still unlock this as a deliberate override. */
  formatDisabled?: boolean;
  /** Locks the pairings editor — no override escape once a round's underway, unlike formatDisabled. */
  pairingsDisabled?: boolean;
}) {
  const pointsNote =
    format === "stableford"
      ? `Worth ${RYDER_CUP_STABLEFORD_POINT_VALUE} points to the winning team (${RYDER_CUP_STABLEFORD_POINT_VALUE / 2}/${RYDER_CUP_STABLEFORD_POINT_VALUE / 2} if tied) — fixed by format, not editable.`
      : `Worth ${RYDER_CUP_MATCH_POINT_VALUE} point per match win (0.5/0.5 if halved) — fixed by format, not editable.`;

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-2">Format</div>
      <div className="flex gap-1.5 mb-2">
        {ROUND_FORMATS.map(f => (
          <button
            key={f}
            disabled={formatDisabled}
            onClick={() => setFormat(f)}
            className={`flex-1 text-[12px] font-bold py-1.5 rounded-lg border disabled:opacity-60 ${
              format === f
                ? "bg-turf text-fairway-950 border-turf"
                : "bg-surface-raised text-chalk-dim border-[color:var(--border)]"
            }`}
          >
            {RYDER_CUP_ROUND_FORMAT_LABEL[f]}
          </button>
        ))}
      </div>
      <p className="text-[11.5px] text-chalk-dim leading-relaxed mb-4">{pointsNote}</p>

      <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-2">Scoring basis</div>
      <div className="flex gap-1.5 mb-4">
        {(["net", "gross"] as RyderCupScoringBasis[]).map(b => (
          <button
            key={b}
            disabled={formatDisabled}
            onClick={() => setScoringBasis(b)}
            className={`flex-1 text-[12px] font-bold py-1.5 rounded-lg border disabled:opacity-60 ${
              scoringBasis === b
                ? "bg-turf text-fairway-950 border-turf"
                : "bg-surface-raised text-chalk-dim border-[color:var(--border)]"
            }`}
          >
            {b === "net" ? "Net" : "Gross"}
          </button>
        ))}
      </div>

      {format === "stableford" ? (
        <p className="text-[12.5px] text-chalk-dim leading-relaxed p-3 bg-surface border border-[color:var(--border)] rounded-xl">
          Every player&apos;s Stableford points count toward their team&apos;s total automatically —
          no pairings to build here. This round&apos;s regular foursomes (for pace of play) are set up
          on the Foursomes step, unrelated to team scoring.
        </p>
      ) : (
        <RyderCupPairingsEditor
          format={format}
          teamAPlayers={teamAPlayers}
          teamBPlayers={teamBPlayers}
          teamAName={teamAName}
          teamBName={teamBName}
          matches={matches}
          setMatches={setMatches}
          disabled={pairingsDisabled}
        />
      )}
    </div>
  );
}
