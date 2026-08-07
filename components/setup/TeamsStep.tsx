"use client";

import type { Player } from "@/lib/types";

export default function TeamsStep({
  players,
  assignment,
  setAssignment,
}: {
  players: Player[];
  assignment: Record<string, "A" | "B">;
  setAssignment: (a: Record<string, "A" | "B">) => void;
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

      <div className="flex gap-2.5">
        {(["A", "B"] as const).map(side => (
          <div key={side} className="flex-1 bg-surface border border-[color:var(--border)] rounded-xl p-3">
            <div className="flex justify-between items-center mb-2.5">
              <div className="font-display font-extrabold text-base">Team {side === "A" ? "USA" : "Europe"}</div>
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
    </div>
  );
}
