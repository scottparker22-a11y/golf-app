"use client";

import { useEffect, useState } from "react";
import { createCourse, fetchCourses, type CourseSummary } from "@/lib/rounds";

export default function CourseStep({
  courseId,
  setCourseId,
}: {
  courseId: string | null;
  setCourseId: (id: string) => void;
}) {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
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
            <button
              key={c.id}
              onClick={() => setCourseId(c.id)}
              className={`w-full flex items-center justify-between text-left px-3.5 py-3 rounded-xl border mb-2 ${
                courseId === c.id
                  ? "bg-turf/15 border-turf"
                  : "bg-surface border-[color:var(--border)]"
              }`}
            >
              <div>
                <div className="text-[14px] font-semibold">{c.name}</div>
                {c.location && <div className="text-[11.5px] text-chalk-dim">{c.location}</div>}
              </div>
              {courseId === c.id && <span className="text-turf font-bold text-sm">✓</span>}
            </button>
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
