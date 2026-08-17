"use client";

// First step of the wizard — picks how this round fits into the trip.
// Individual Round / Tournament / Ryder Cup is a single choice per
// round (not independent toggles) — a round counts toward at most one
// of them. When SetupWizard detects a Tournament and/or a Ryder Cup
// already running for this trip (see lib/rounds.ts
// fetchActiveTournament/fetchActiveRyderCupTournament — a trip can
// have both going at once, rounds just each pick one), it defaults
// this round to joining whichever it finds (Tournament taking
// priority if both exist); either can still be opted out of here, or
// deleted outright.
//
// Ryder Cup team-splitting + match-building (components/setup/TeamsStep.tsx)
// lives on its own tab (see SetupWizard.tsx), shown only while
// roundType === "ryder_cup" — this tab only handles round count,
// join detection, and course order, same as the Tournament block.
import { useEffect, useState } from "react";
import {
  createCourse,
  fetchCourses,
  type ActiveRyderCupTournament,
  type ActiveTournament,
  type CourseSummary,
} from "@/lib/rounds";
import type { RoundType } from "./SetupWizard";

/**
 * The course planned for each round of a multi-round format, picked
 * up front instead of one at a time every time a new round starts.
 * Shared between the Tournament and Ryder Cup sections below — each
 * has its own totalRounds/courseOrder, but they share one course list
 * (and one "add a course" affordance) so adding a course from either
 * section immediately shows up in both.
 */
function CourseOrderPicker({
  totalRounds,
  courseOrder,
  setCourseOrderAt,
  courses,
  setCourses,
}: {
  totalRounds: number;
  courseOrder: (string | null)[];
  setCourseOrderAt: (index: number, courseId: string | null) => void;
  courses: CourseSummary[] | null;
  setCourses: (c: CourseSummary[]) => void;
}) {
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseLocation, setNewCourseLocation] = useState("");
  const [addingCourse, setAddingCourse] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddCourse = async () => {
    setAddingCourse(true);
    setAddError(null);
    try {
      const id = await createCourse(newCourseName, newCourseLocation);
      setCourses(await fetchCourses());
      setNewCourseName("");
      setNewCourseLocation("");
      setShowAddCourse(false);
      // Nothing picked for round 1 yet? Default straight to the one
      // just added, same courtesy CourseStep.tsx gives its own list.
      if (!courseOrder[0]) setCourseOrderAt(0, id);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Couldn't add the course");
    } finally {
      setAddingCourse(false);
    }
  };

  return (
    <div className="mt-3.5 pt-3.5 border-t border-[color:var(--border)]">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-1">Course order</div>
      <p className="text-[11px] text-chalk-dim leading-relaxed mb-2.5">
        Optional — pick which course each round is played on, in order. Round 1&apos;s pick becomes
        this round&apos;s course too; leave any round blank to just pick its course when that round
        starts.
      </p>

      {addError && (
        <div className="mb-2 p-2 bg-flag/10 border border-flag/30 rounded-lg text-[11px] text-flag">{addError}</div>
      )}

      {!courses ? (
        <p className="text-[12px] text-chalk-dim">Loading courses…</p>
      ) : (
        <div className="flex flex-col gap-1.5 mb-2.5">
          {Array.from({ length: totalRounds }, (_, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[11.5px] font-bold text-chalk-dim w-14 flex-shrink-0">Round {i + 1}</span>
              <select
                value={courseOrder[i] ?? ""}
                onChange={e => setCourseOrderAt(i, e.target.value || null)}
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
  );
}

/**
 * Confirm-then-delete affordance shared by the Tournament and Ryder
 * Cup "already running" banners below — a real destructive action
 * (removes the wrapper for the whole trip), so it's two taps, not one.
 */
function DeleteFormatButton({
  label,
  confirmText,
  onDelete,
}: {
  label: string;
  confirmText: string;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
      // No need to reset local state on success — the parent clears
      // activeTournament/activeRyderCup, which unmounts this banner
      // (and this button along with it) entirely.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete");
      setDeleting(false);
    }
  };

  return (
    <div className="mt-2.5 pt-2.5 border-t border-[color:var(--border)]">
      {error && (
        <div className="mb-2 p-2 bg-flag/10 border border-flag/30 rounded-lg text-[11px] text-flag">{error}</div>
      )}
      {confirming ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-chalk-dim leading-relaxed">{confirmText}</p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2 rounded-lg bg-flag text-white font-bold text-[11.5px] disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="flex-1 py-2 rounded-lg bg-surface-raised text-chalk-dim font-bold text-[11.5px]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className="text-[11px] font-bold text-flag underline">
          {label}
        </button>
      )}
    </div>
  );
}

const ROUND_TYPE_LABELS: Record<RoundType, string> = {
  individual: "Individual Round",
  tournament: "Tournament",
  ryder_cup: "Ryder Cup",
};

export default function FormatStep({
  roundType,
  setRoundType,
  activeTournament,
  onDeleteTournament,
  tournamentTotalRounds,
  setTournamentTotalRounds,
  usesHandicap,
  setUsesHandicap,
  tournamentCourseOrder,
  setTournamentCourseOrderAt,
  activeRyderCup,
  onDeleteRyderCup,
  ryderCupTotalRounds,
  setRyderCupTotalRounds,
  ryderCupCourseOrder,
  setRyderCupCourseOrderAt,
}: {
  roundType: RoundType;
  setRoundType: (t: RoundType) => void;
  activeTournament: ActiveTournament | null;
  onDeleteTournament: () => Promise<void>;
  tournamentTotalRounds: number;
  setTournamentTotalRounds: (n: number) => void;
  usesHandicap: boolean;
  setUsesHandicap: (v: boolean) => void;
  tournamentCourseOrder: (string | null)[];
  setTournamentCourseOrderAt: (index: number, courseId: string | null) => void;
  activeRyderCup: ActiveRyderCupTournament | null;
  onDeleteRyderCup: () => Promise<void>;
  ryderCupTotalRounds: number;
  setRyderCupTotalRounds: (n: number) => void;
  ryderCupCourseOrder: (string | null)[];
  setRyderCupCourseOrderAt: (index: number, courseId: string | null) => void;
}) {
  // Shared course list — both the Tournament and Ryder Cup "Course
  // order" sections read from this, so adding a course in one shows
  // up in the other immediately. Fetched unconditionally (cheap,
  // small list) rather than gated on which format's picked, since
  // that can change without remounting this step.
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses()
      .then(setCourses)
      .catch(e => setCourseError(e instanceof Error ? e.message : "Couldn't load courses"));
  }, []);

  return (
    <div className="px-5 pt-4">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        Pick how this round fits into the trip — an Individual Round, part of a multi-round
        Tournament, or a Ryder Cup session. Pick one; a trip can run a Tournament and a Ryder Cup at
        the same time, but each round only counts toward one of them.
      </p>

      {courseError && (
        <div className="mb-3 p-2.5 bg-flag/10 border border-flag/30 rounded-lg text-[12px] text-flag">
          {courseError}
        </div>
      )}

      <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-2">Round type</div>
      <div className="flex gap-2 mb-3">
        {(["individual", "tournament", "ryder_cup"] as const).map(t => (
          <button
            key={t}
            onClick={() => setRoundType(t)}
            className={`flex-1 text-[12.5px] font-bold py-2.5 rounded-xl border ${
              roundType === t
                ? "bg-turf text-fairway-950 border-turf"
                : "bg-surface text-chalk-dim border-[color:var(--border)]"
            }`}
          >
            {ROUND_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {roundType === "tournament" && (
        <div className="p-3.5 bg-surface border border-[color:var(--border)] rounded-xl">
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
              <DeleteFormatButton
                label="Delete this Tournament"
                confirmText="This removes the Tournament for the whole trip — its rounds keep their scores, they just stop counting toward it. This can't be undone."
                onDelete={onDeleteTournament}
              />
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

              <CourseOrderPicker
                totalRounds={tournamentTotalRounds}
                courseOrder={tournamentCourseOrder}
                setCourseOrderAt={setTournamentCourseOrderAt}
                courses={courses}
                setCourses={setCourses}
              />
            </>
          )}
        </div>
      )}

      {roundType === "ryder_cup" && (
        <div className="p-3.5 bg-surface border border-[color:var(--border)] rounded-xl">
          {activeRyderCup ? (
            <>
              <div className="text-[13.5px] font-semibold mb-1">
                Joining: Round {activeRyderCup.roundsPlayed + 1} of {activeRyderCup.totalRounds}
              </div>
              <p className="text-[11px] text-chalk-dim leading-relaxed mb-2.5">
                A Ryder Cup ({activeRyderCup.teamAName} vs {activeRyderCup.teamBName}) is already running
                for this trip — this round&apos;s matches will add to its overall score. Pick teams and
                matches on the Ryder Cup step.
              </p>
              <button
                onClick={() => setRoundType("individual")}
                className="text-[11px] font-bold text-chalk-dim underline"
              >
                Don&apos;t count this round toward it
              </button>
              <DeleteFormatButton
                label="Delete this Ryder Cup"
                confirmText="This removes the Ryder Cup for the whole trip — its rounds keep their scores, they just stop counting toward its Cup total. This can't be undone."
                onDelete={onDeleteRyderCup}
              />
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
              <p className="text-[11px] text-chalk-dim leading-relaxed mb-2.5">
                Team names, the team split, and matches are set up on the Ryder Cup step next.
              </p>

              <CourseOrderPicker
                totalRounds={ryderCupTotalRounds}
                courseOrder={ryderCupCourseOrder}
                setCourseOrderAt={setRyderCupCourseOrderAt}
                courses={courses}
                setCourses={setCourses}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
