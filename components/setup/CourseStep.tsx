"use client";

import { useEffect, useState } from "react";
import { createCourse, deleteCourse, fetchCourses, type CourseSummary } from "@/lib/rounds";

export default function CourseStep({
  courseId,
  setCourseId,
}: {
  courseId: string | null;
  setCourseId: (id: string | null) => void;
}) {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchCourses()
      .then(list => {
        setCourses(list);
        // Nothing picked yet? Default to the first course in the queue.
        if (!courseId && list.length > 0) setCourseId(list[0].id);
      })
      .catch(e => setError(e instanceof Error ? e.message : "Couldn't load courses"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddCourse = async () => {
    setAdding(true);
    setError(null);
    try {
      const id = await createCourse(newName, newLocation);
      const list = await fetchCourses();
      setCourses(list);
      setCourseId(id);
      setNewName("");
      setNewLocation("");
      setShowAddForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add the course");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCourse = async (course: CourseSummary) => {
    setConfirmDeleteId(null);
    setDeletingId(course.id);
    setError(null);
    try {
      await deleteCourse(course.id);
      const list = await fetchCourses();
      setCourses(list);
      if (courseId === course.id) setCourseId(list[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the course");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="px-5 pt-4">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        Pick the course for this round — courses you've added before are ready to reuse.
      </p>

      {error && (
        <div className="mb-3 p-2.5 bg-flag/10 border border-flag/30 rounded-lg text-[12px] text-flag">
          {error}
        </div>
      )}

      {!courses ? (
        <p className="text-[13px] text-chalk-dim">Loading courses…</p>
      ) : (
        <>
          {courses.map(c => (
            <div
              key={c.id}
              className={`flex items-center gap-1 rounded-xl border mb-2 ${
                courseId === c.id
                  ? "bg-turf/15 border-turf"
                  : "bg-surface border-[color:var(--border)]"
              }`}
            >
              <button
                onClick={() => setCourseId(c.id)}
                className="flex-1 min-w-0 flex items-center justify-between text-left px-3.5 py-3"
              >
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold truncate">{c.name}</div>
                  {c.location && <div className="text-[11.5px] text-chalk-dim truncate">{c.location}</div>}
                </div>
                {courseId === c.id && <span className="text-turf font-bold text-sm flex-shrink-0 ml-2">✓</span>}
              </button>
              {confirmDeleteId === c.id ? (
                <div className="flex items-center flex-shrink-0 pr-1.5 gap-1">
                  <button
                    onClick={() => handleDeleteCourse(c)}
                    disabled={deletingId === c.id}
                    className="px-2.5 py-1.5 rounded-md bg-flag text-white text-[11px] font-bold disabled:opacity-60"
                  >
                    {deletingId === c.id ? "…" : "Confirm"}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-2.5 py-1.5 rounded-md bg-surface-raised text-chalk-dim text-[11px] font-bold"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(c.id)}
                  aria-label={`Delete ${c.name}`}
                  className="px-3 py-3 flex-shrink-0 text-[12px] font-bold text-chalk-dim hover:text-flag"
                >
                  Delete
                </button>
              )}
            </div>
          ))}

          {courses.length === 0 && (
            <p className="text-[13px] text-chalk-dim text-center py-4">
              No courses yet — add the first one below.
            </p>
          )}
        </>
      )}

      {showAddForm ? (
        <div className="bg-surface border border-[color:var(--border)] rounded-xl p-3.5 mt-2">
          <input
            placeholder="Course name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2.5 py-2.5 text-sm mb-2"
          />
          <input
            placeholder="Location (optional)"
            value={newLocation}
            onChange={e => setNewLocation(e.target.value)}
            className="w-full bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2.5 py-2.5 text-sm mb-2.5"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddCourse}
              disabled={adding || !newName.trim()}
              className="flex-1 py-2.5 rounded-lg bg-turf text-fairway-950 font-bold text-[13px] disabled:opacity-60"
            >
              {adding ? "Adding…" : "Add to queue"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2.5 rounded-lg bg-surface-raised text-chalk-dim font-bold text-[13px]"
            >
              Cancel
            </button>
          </div>
          <p className="text-[10.5px] text-chalk-dim leading-relaxed mt-2">
            Par and stroke index start as a standard layout — course/tee autofill isn't wired up
            yet (see lib/courseData.ts).
          </p>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-3 rounded-xl border border-dashed border-[color:var(--border-strong)] text-turf font-bold text-[13.5px]"
        >
          + Add a new course
        </button>
      )}
    </div>
  );
}
