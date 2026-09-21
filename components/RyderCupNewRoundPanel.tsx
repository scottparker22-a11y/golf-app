"use client";

// Builds and starts a round that doesn't exist yet — reached from a
// "Not created yet" card on the Ryder Cup Rounds screen
// (components/RyderCupRoundsScreen.tsx). Deliberately lighter than the
// full Setup Wizard: just a course, this round's Ryder Cup format/
// scoring basis/pairings, and a Start button — Skins, stats, and a
// scorekeeper can still be added afterward from the round's own admin
// surfaces if wanted, same as any round.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEMO_TRIP_ID,
  fetchActiveRyderCupTournament,
  fetchTripRoster,
  startRyderCupRound,
  type ActiveRyderCupTournament,
} from "@/lib/rounds";
import type { Player } from "@/lib/types";
import type { RyderCupGameConfig, RyderCupMatchConfig, RyderCupRoundFormat, RyderCupScoringBasis } from "@/lib/scoring";
import CourseStep from "./setup/CourseStep";
import RyderCupFormatAndPairings from "./setup/RyderCupFormatAndPairings";

export default function RyderCupNewRoundPanel({ tripId, roundNumber }: { tripId: string; roundNumber: number }) {
  const router = useRouter();
  const [tournament, setTournament] = useState<ActiveRyderCupTournament | null | undefined>(undefined);
  const [roster, setRoster] = useState<Player[]>([]);
  const [assignment, setAssignment] = useState<Record<string, "A" | "B">>({});
  const [initError, setInitError] = useState<string | null>(null);

  const [courseId, setCourseId] = useState<string | null>(null);
  const [config, setConfig] = useState<RyderCupGameConfig>({
    teamAName: "USA",
    teamBName: "Europe",
    format: "singles",
    scoringBasis: "net",
    matches: [],
  });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cup, players] = await Promise.all([
          fetchActiveRyderCupTournament(DEMO_TRIP_ID),
          fetchTripRoster(DEMO_TRIP_ID),
        ]);
        setTournament(cup);
        setRoster(players);
        if (cup) {
          setAssignment(cup.teamAssignment);
          setConfig(prev => ({ ...prev, teamAName: cup.teamAName, teamBName: cup.teamBName }));
          const plannedCourse = cup.courseOrder[roundNumber - 1];
          if (plannedCourse) setCourseId(plannedCourse);
        }
      } catch (e) {
        setInitError(e instanceof Error ? e.message : "Couldn't load the Ryder Cup");
      }
    })();
  }, [roundNumber]);

  const teamA = roster.filter(p => assignment[p.id] === "A");
  const teamB = roster.filter(p => assignment[p.id] === "B");
  const unassigned = roster.filter(p => !assignment[p.id]);

  const setFormat = (format: RyderCupRoundFormat) =>
    setConfig(prev => ({ ...prev, format, matches: format === "stableford" ? [] : prev.matches }));
  const setScoringBasis = (scoringBasis: RyderCupScoringBasis) => setConfig(prev => ({ ...prev, scoringBasis }));
  const setMatches = (matches: RyderCupMatchConfig[]) => setConfig(prev => ({ ...prev, matches }));

  const canStart = !!courseId && (config.format === "stableford" || config.matches.length > 0);

  const handleStart = async () => {
    if (!tournament || !courseId) return;
    setStarting(true);
    setStartError(null);
    try {
      // Anyone new to the trip since the Cup's team split was locked
      // needs a side before this round's pairings can use them.
      const inRoster = roster.filter(p => assignment[p.id] === "A" || assignment[p.id] === "B");
      const { roundId } = await startRyderCupRound(DEMO_TRIP_ID, tournament.id, courseId, config, inRoster);
      router.push(`/trip/${tripId}/round/${roundId}/leaderboard`);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Couldn't start the round");
      setStarting(false);
    }
  };

  if (initError) {
    return (
      <div className="mx-5 mt-4 p-3 bg-flag/10 border border-flag/30 rounded-xl text-[12.5px] text-flag">
        {initError}
      </div>
    );
  }
  if (tournament === undefined) {
    return <div className="px-5 pt-8 text-sm text-chalk-dim">Loading…</div>;
  }
  if (!tournament) {
    return (
      <div className="mx-5 mt-4 p-4 bg-surface border border-[color:var(--border)] rounded-xl text-[13px] text-chalk-dim leading-relaxed">
        No Ryder Cup running for this trip — start one from Trip Setup → Format first.
      </div>
    );
  }

  return (
    <div className="pb-10">
      {startError && (
        <div className="mx-5 mt-4 p-3 bg-flag/10 border border-flag/30 rounded-xl text-[12.5px] text-flag">
          {startError}
        </div>
      )}

      <CourseStep courseId={courseId} setCourseId={setCourseId} />

      <div className="px-5">
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
                  → {config.teamAName}
                </button>
                <button
                  onClick={() => setAssignment(prev => ({ ...prev, [p.id]: "B" }))}
                  className="text-[11px] font-bold px-2 py-1 rounded-md bg-flag/15 text-flag"
                >
                  → {config.teamBName}
                </button>
              </div>
            ))}
            <p className="text-[10.5px] text-chalk-dim mt-1.5">
              Assigning here only affects this Cup&apos;s team split, not saved until you start the round below.
            </p>
          </div>
        )}

        <RyderCupFormatAndPairings
          format={config.format}
          setFormat={setFormat}
          scoringBasis={config.scoringBasis}
          setScoringBasis={setScoringBasis}
          matches={config.matches}
          setMatches={setMatches}
          teamAPlayers={teamA}
          teamBPlayers={teamB}
          teamAName={config.teamAName}
          teamBName={config.teamBName}
        />
      </div>

      <div className="px-5 mt-5">
        <button
          onClick={handleStart}
          disabled={starting || !canStart}
          className="w-full py-3.5 rounded-xl bg-turf text-fairway-950 font-bold text-[15px] disabled:opacity-60"
        >
          {starting ? "Starting…" : `Start Round ${roundNumber}`}
        </button>
        {!canStart && (
          <p className="text-[11.5px] text-chalk-dim text-center mt-2">
            Pick a course and build at least one pairing above first.
          </p>
        )}
      </div>
    </div>
  );
}
