"use client";

// One card per round the Cup is meant to have (ryder_cup_tournaments
// .total_rounds), whether or not that round exists yet — the whole
// point being that round 3's pairings can be set up (or round 1's
// revisited) independent of what's happened on any other round. A
// round with no `rounds` row yet routes to /ryder-cup/rounds/new to
// build and start it right there; an existing round routes to its own
// ryder-cup-setup page (components/RyderCupSetupPanel.tsx), which
// already locks pairings once that round is under way.
import { useEffect, useState } from "react";
import Link from "next/link";
import { DEMO_TRIP_ID, fetchRyderCupRounds, type RyderCupRoundSummary } from "@/lib/rounds";
import { RYDER_CUP_MATCH_POINT_VALUE, RYDER_CUP_ROUND_FORMAT_LABEL, RYDER_CUP_STABLEFORD_POINT_VALUE } from "@/lib/scoring";

const STATUS_LABEL: Record<string, string> = {
  upcoming: "Upcoming",
  in_progress: "In progress",
  completed: "Completed",
  archived: "Archived",
};

const STATUS_STYLE: Record<string, string> = {
  upcoming: "bg-sand/15 text-sand",
  in_progress: "bg-turf/15 text-turf",
  completed: "bg-surface-raised text-chalk-dim",
  archived: "bg-surface-raised text-chalk-dim",
};

export default function RyderCupRoundsScreen({ tripId }: { tripId: string }) {
  const [data, setData] = useState<{ teamAName: string; teamBName: string; rounds: RyderCupRoundSummary[] } | null | undefined>(
    undefined
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // DEMO_TRIP_ID, not the tripId prop — that's the cosmetic "demo"
    // URL slug, never a real trip_id to query by (see lib/rounds.ts).
    fetchRyderCupRounds(DEMO_TRIP_ID)
      .then(result =>
        setData(result ? { teamAName: result.tournament.teamAName, teamBName: result.tournament.teamBName, rounds: result.rounds } : null)
      )
      .catch(e => setError(e instanceof Error ? e.message : "Couldn't load the Ryder Cup's rounds"));
  }, []);

  if (error) {
    return (
      <div className="mx-5 mt-4 p-3 bg-flag/10 border border-flag/30 rounded-xl text-[12.5px] text-flag">{error}</div>
    );
  }
  if (data === undefined) {
    return <div className="px-5 pt-8 text-sm text-chalk-dim">Loading…</div>;
  }
  if (data === null) {
    return (
      <div className="mx-5 mt-4 p-4 bg-surface border border-[color:var(--border)] rounded-xl text-[13px] text-chalk-dim leading-relaxed">
        No Ryder Cup running for this trip yet — start one from Trip Setup → Format first.
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 pb-10">
      <p className="text-[12.5px] text-chalk-dim leading-relaxed mb-4">
        {data.teamAName} vs {data.teamBName}. Tap a round to set up or edit its format and pairings.
      </p>
      <div className="flex flex-col gap-2.5">
        {data.rounds.map(round => {
          const href = round.roundId
            ? `/trip/${tripId}/round/${round.roundId}/ryder-cup-setup`
            : `/trip/${tripId}/ryder-cup/rounds/new?roundNumber=${round.roundNumber}`;
          const pointsNote = round.format
            ? round.format === "stableford"
              ? `${RYDER_CUP_STABLEFORD_POINT_VALUE} pts to the winning team`
              : `${RYDER_CUP_MATCH_POINT_VALUE} pt per match`
            : null;
          return (
            <Link
              key={round.roundNumber}
              href={href}
              className="flex items-center justify-between p-3.5 bg-surface border border-[color:var(--border)] rounded-xl"
            >
              <div className="min-w-0">
                <div className="font-display font-extrabold text-[16px]">Round {round.roundNumber}</div>
                <div className="text-[11.5px] text-chalk-dim truncate">
                  {round.roundId === null
                    ? "Not created yet"
                    : round.format
                    ? `${RYDER_CUP_ROUND_FORMAT_LABEL[round.format]}${pointsNote ? ` · ${pointsNote}` : ""}`
                    : "Needs setup"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {round.status && (
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${STATUS_STYLE[round.status] ?? ""}`}>
                    {STATUS_LABEL[round.status] ?? round.status}
                  </span>
                )}
                <span
                  className={`text-[10.5px] font-bold ${
                    round.configured ? "text-turf" : "text-sand"
                  }`}
                >
                  {round.configured ? "Configured" : "Needs setup"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
