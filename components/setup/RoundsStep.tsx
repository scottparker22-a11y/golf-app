"use client";

export type RoundDraft = {
  id: string;
  date: string;
  teeTime: string;
  courseName: string;
  teeName: string;
};

export default function RoundsStep({
  rounds,
  setRounds,
}: {
  rounds: RoundDraft[];
  setRounds: (r: RoundDraft[]) => void;
}) {
  const update = (id: string, patch: Partial<RoundDraft>) =>
    setRounds(rounds.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const addRound = () =>
    setRounds([...rounds, { id: crypto.randomUUID(), date: "", teeTime: "", courseName: "", teeName: "" }]);

  return (
    <div className="px-5 pt-4">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        Add every round up front — course, date, tee time. Par and stroke index autofill per
        round once you pick the course and tee (requires GOLF_COURSE_API_KEY — see lib/courseData.ts).
      </p>

      {rounds.map((r, i) => (
        <div key={r.id} className="bg-surface border border-[color:var(--border)] rounded-xl p-3.5 mb-3">
          <div className="flex justify-between items-baseline mb-3">
            <div className="font-display font-extrabold text-base">Round {i + 1}</div>
          </div>

          <div className="flex gap-2 mb-2.5">
            <input
              type="date"
              className="flex-1 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2.5 py-2 text-[12.5px]"
              value={r.date}
              onChange={e => update(r.id, { date: e.target.value })}
            />
            <input
              type="time"
              className="flex-1 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2.5 py-2 text-[12.5px]"
              value={r.teeTime}
              onChange={e => update(r.id, { teeTime: e.target.value })}
            />
          </div>

          <input
            placeholder="Search course name…"
            className="w-full bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2.5 py-2.5 text-sm mb-2"
            value={r.courseName}
            onChange={e => update(r.id, { courseName: e.target.value })}
          />
          <input
            placeholder="Tee (e.g. Blue)"
            className="w-full bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2.5 py-2.5 text-sm"
            value={r.teeName}
            onChange={e => update(r.id, { teeName: e.target.value })}
          />
        </div>
      ))}

      <button
        onClick={addRound}
        className="w-full py-3 rounded-xl border border-dashed border-[color:var(--border-strong)] text-turf font-bold text-[13.5px]"
      >
        + Add another round
      </button>
    </div>
  );
}
