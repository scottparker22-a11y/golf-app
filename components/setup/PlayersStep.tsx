"use client";

import type { Player } from "@/lib/types";

export default function PlayersStep({
  players,
  setPlayers,
}: {
  players: Player[];
  setPlayers: (p: Player[]) => void;
}) {
  const update = (id: string, patch: Partial<Player>) =>
    setPlayers(players.map(p => (p.id === id ? { ...p, ...patch } : p)));

  const addPlayer = () =>
    setPlayers([...players, { id: crypto.randomUUID(), name: "", handicapIndex: 0 }]);

  return (
    <div className="px-5 pt-4">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        Add everyone on the trip once — name and handicap index. This list feeds every other step.
      </p>

      {players.map(p => (
        <div key={p.id} className="flex items-center gap-2.5 p-2.5 bg-surface border border-[color:var(--border)] rounded-xl mb-2">
          <div className="w-[34px] h-[34px] rounded-full bg-surface-raised text-chalk-dim text-xs font-bold flex items-center justify-center flex-shrink-0">
            {p.name.split(" ").filter(Boolean).map(n => n[0]).join("") || "?"}
          </div>
          <input
            className="bg-transparent text-sm font-semibold flex-1 min-w-0 outline-none"
            placeholder="Player name…"
            value={p.name}
            onChange={e => update(p.id, { name: e.target.value })}
          />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-chalk-dim font-semibold uppercase">Hcp</span>
            <input
              className="w-[52px] bg-surface-raised border border-[color:var(--border-strong)] rounded-md text-turf font-mono text-[13px] font-semibold text-center py-1.5"
              value={p.handicapIndex}
              onChange={e => update(p.id, { handicapIndex: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
      ))}

      <button
        onClick={addPlayer}
        className="w-full py-3 rounded-xl border border-dashed border-[color:var(--border-strong)] text-turf font-bold text-[13.5px]"
      >
        + Add another player
      </button>
    </div>
  );
}
