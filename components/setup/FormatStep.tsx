"use client";

// First step of the wizard — picks how this round fits into the trip.
// A round can count toward a multi-round Tournament (Stroke Play,
// see lib/scoring.ts calculateTournamentLeaderboard), a Ryder Cup
// (match play, see components/RyderCupBoard.tsx), both, or neither —
// they're independent toggles. When SetupWizard detects either is
// already running for this trip (see lib/rounds.ts
// fetchActiveTournament/fetchActiveRyderCupTournament), it defaults
// this round to joining it; either can still be opted out of here.
// The Ryder Cup toggle itself used to live in TeamsStep.tsx — it
// moved here so both cross-round formats are picked in one place;
// TeamsStep still owns team names/matches, just reads `ryderCup.enabled`.
import { useEffect, useState } from "react";
import { createCourse, fetchCourses, type ActiveRyderCupTournament, type ActiveTournament, type CourseSummary } from "@/lib/rounds";
import type { RyderCupWizardConfig } from "./TeamsStep";

export default function FormatStep({
  roundType,
  setRoundType,
  activeTournament,
  tournamentTotalRounds,
  setTournamentTotalRounds,
  usesHandicap,
  setUsesHandicap,
  tournamentCourseOrder,
  setTournamentCourseOrderAt,
  ryderCup,
  setRyderCup,
  activeRyderCup,
  ryderCupTotalRounds,
  setRyderCupTotalRounds,
}: {
  roundType: "individual" | "tournament";
  setRoundType: (t: "individual" | "tournament") => void;
  activeTournament: ActiveTournament | null;
  tournamentTotalRounds: number;
  setTournamentTotalRounds: (n: number) => void;
  usesHandicap: boolean;
  setUsesHandicap: (v: boolean) => void;
  tournamentCourseOrder: (string | null)[];
  setTournamentCourseOrderAt: (index: number, courseId: string | null) => void;
  ryderCup: RyderCupWizardConfig;
  setRyderCup: (r: RyderCupWizardConfig) => void;
  activeRyderCup: ActiveRyderCupTournament | null;
  ryderCupTotalRounds: number;
  setRyderCupTotalRounds: (n: number) => void;
}) {
  // Only needed for the "Course order" picker below (a brand-new
  // Tournament's course per round) — fetched independently of
  // CourseStep.tsx's own copy since Format comes before Course in the
  // wizard and each step only mounts once its tab is opened.
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseLocation, setNewCourseLocation] = useState("");
  const [addingCourse, setAddingCourse] = useState(false);

  useEffect(() => {
    if (roundType !== "tournament" || activeTournament) return;
    fetchCourses()
      .then(setCourses)
      .catch(e => setCourseError(e instanceof Error ? e.message : "Couldn't load courses"));
  }, [roundType, activeTournament]);

  const handleAddCourse = async () => {
    setAddingCourse(true);
    setCourseError(null);
    try {
      const id = await createCourse(newCourseName, newCourseLocation);
      setCourses(await fetchCourses());
      setNewCourseName("");
      setNewCourseLocation("");
      setShowAddCourse(false);
      // Nothing picked for round 1 yet? Default straight to the one
      // just added, same courtesy CourseStep.tsx gives its own list.
      if (!tournamentCourseOrder[0]) setTournamentCourseOrderAt(0, id);
    } catch (e) {
      setCourseError(e instanceof Error ? e.message : "Couldn't add the course");
    } finally {
      setAddingCourse(false);
    }
  };
  return (
    <div className="px-5 pt-4">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        Pick how this round fits into the trip. It can count toward a multi-round Tournament, a Ryder
        Cup, both, or neither.
      </p>

      <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-2">Round type</div>
      <div className="flex gap-2 mb-3">
        {(["individual", "tournament"] as const).map(t => (
          <button
            key={t}
            onClick={() => setRoundType(t)}
            className={`flex-1 text-[13px] font-bold py-2.5 rounded-xl border ${
              roundType === t
                ? "bg-turf text-fairway-950 border-turf"
                : "bg-surface text-chalk-dim border-[color:var(--border)]"
            }`}
          >
            {t === "individual" ? "Individual Round" : "Tournament"}
          </button>
        ))}
      </div>

      {roundType === "tournament" && (
        <div className="mb-5 p-3.5 bg-surface border border-[color:var(--border)] rounded-xl">
          {activeTournament ? (
            <>
              <div className="text-[13.5px] font-semibold mb-1">
                Joining: Round {activeTournament.roundsPlayed + 1} of {activeTournament.totalRounds}
              </div>
              <p className="text-[11px] text-chalk-dim leading-relaxed mb-2.5">
                A Tournament is already running for this trip — this round&apos;s scores will add to its
                leaderboard.
              </p>
              <button
                onClick={() => setRoundType("individual")}
                className="text-[11px] font-bold text-chalk-dim underline"
              >
                Don&apos;t count this round toward it
              </button>
            </>
          ) : (
            <>
              <div className="text-[13.5px] font-semibold mb-2.5">Starting a new Tournament</div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim">
                  How many rounds?
                </span>
                <input
                  type="number"
                  min={1}
                  value={tournamentTotalRounds}
                  onChange={e => setTournamentTotalRounds(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2 py-1.5 text-sm font-mono"
                />
              </div>
              <p className="text-[11px] text-chalk-dim leading-relaxed mb-2.5">
                Just a display target (&quot;Round 2 of {tournamentTotalRounds}&quot;) — later rounds can still
                join even after this many have already been played.
              </p>
              <button
                onClick={() => setUsesHandicap(!usesHandicap)}
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border text-left ${
                  usesHandicap ? "bg-turf/15 border-turf" : "bg-surface-raised border-[color:var(--border)]"
                }`}
              >
                <span
                  className={`w-[16px] h-[16px] rounded-md border-2 flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                    usesHandicap ? "bg-turf border-turf text-fairway-950" : "border-chalk-dim"
                  }`}
                >
                  {usesHandicap ? "✓" : ""}
                </span>
                <span className="text-[12.5px] font-semibold">Use handicap (net) for the Tournament leaderboard</span>
              </button>

              <div className="mt-3.5 pt-3.5 border-t border-[color:var(--border)]">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-1">
                  Course order
                </div>
                <p className="text-[11px] text-chalk-dim leading-relaxed mb-2.5">
                  Optional — pick which course each round is played on, in order. Round 1&apos;s pick
                  becomes this round&apos;s course too; leave any round blank to just pick its course
                  when that round starts.
                </p>

                {courseError && (
                  <div className="mb-2 p-2 bg-flag/10 border border-flag/30 rounded-lg text-[11px] text-flag">
                    {courseError}
                  </div>
                )}

                {!courses ? (
                  <p className="text-[12px] text-chalk-dim">Loading courses…</p>
                ) : (
                  <div className="flex flex-col gap-1.5 mb-2.5">
                    {Array.from({ length: tournamentTotalRounds }, (_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[11.5px] font-bold text-chalk-dim w-14 flex-shrink-0">
                          Round {i + 1}
                        </span>
                        <select
                          value={tournamentCourseOrder[i] ?? ""}
                          onChange={e => setTournamentCourseOrderAt(i, e.target.value || null)}
                          className="flex-1 min-w-0 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2.5 py-2 text-[12.5px]"
                        >
                          <option value="">— pick later —</option>
                          {courses.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {showAddCourse ? (
                  <div className="bg-surface-raised border border-[color:var(--border)] rounded-xl p-3">
                    <input
                      placeholder="Course name"
                      value={newCourseName}
                      onChange={e => setNewCourseName(e.target.value)}
                      className="w-full bg-surface border border-[color:var(--border-strong)] rounded-lg px-2.5 py-2 text-[12.5px] mb-2"
                    />
                    <input
                      placeholder="Location (optional)"
                      value={newCourseLocation}
                      onChange={e => setNewCourseLocation(e.target.value)}
                      className="w-full bg-surface border border-[color:var(--border-strong)] rounded-lg px-2.5 py-2 text-[12.5px] mb-2.5"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddCourse}
                        disabled={addingCourse || !newCourseName.trim()}
                        className="flex-1 py-2 rounded-lg bg-turf text-fairway-950 font-bold text-[12px] disabled:opacity-60"
                      >
                        {addingCourse ? "Adding…" : "Add to queue"}
                      </button>
                      <button
                        onClick={() => setShowAddCourse(false)}
                        className="px-3.5 py-2 rounded-lg bg-surface text-chalk-dim font-bold text-[12px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddCourse(true)}
                    className="w-full py-2.5 rounded-lg border border-dashed border-[color:var(--border-strong)] text-turf font-bold text-[12.5px]"
                  >
                    + Add a new course
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-2">
        Ryder Cup — independent of the Tournament above
      </div>
      <button
        onClick={() => setRyderCup({ ...ryderCup, enabled: !ryderCup.enabled })}
        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left mb-3 ${
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
          <div className="text-[13.5px] font-semibold">Also play Ryder Cup</div>
          <div className="text-[11px] text-chalk-dim">
            Team match play, built from the same scores everyone enters on the Scorecard. Set up teams
            and matches on the Ryder Cup step.
          </div>
        </span>
      </button>

      {ryderCup.enabled && (
        <div className="p-3.5 bg-surface border border-[color:var(--border)] rounded-xl">
          {activeRyderCup ? (
            <>
              <div className="text-[13.5px] font-semibold mb-1">
                Joining: Round {activeRyderCup.roundsPlayed + 1} of {activeRyderCup.totalRounds}
              </div>
              <p className="text-[11px] text-chalk-dim leading-relaxed mb-2.5">
                A Ryder Cup ({activeRyderCup.teamAName} vs {activeRyderCup.teamBName}) is already running
                for this trip — this round&apos;s matches will add to its overall score.
              </p>
              <button
                onClick={() => setRyderCup({ ...ryderCup, enabled: false })}
                className="text-[11px] font-bold text-chalk-dim underline"
              >
                Don&apos;t count this round toward it
              </button>
            </>
          ) : (
            <>
              <div className="text-[13.5px] font-semibold mb-2.5">Starting a new Ryder Cup</div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim">
                  How many rounds?
                </span>
                <input
                  type="number"
                  min={1}
                  value={ryderCupTotalRounds}
                  onChange={e => setRyderCupTotalRounds(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2 py-1.5 text-sm font-mono"
                />
              </div>
              <p className="text-[11px] text-chalk-dim leading-relaxed mt-2.5">
                Team names and matches are set up on the Ryder Cup step next.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
