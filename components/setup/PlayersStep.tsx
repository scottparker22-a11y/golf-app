"use client";

import { useState } from "react";
import type { Player } from "@/lib/types";

export default function PlayersStep({
  players,
  setPlayers,
  roster,
}: {
  players: Player[];
  setPlayers: (p: Player[]) => void;
  /** The trip's standing roster from previous rounds — pick from it instead of retyping. */
  roster: Player[];
}) {
  const [bulkNames, setBulkNames] = useState("");
  const rosterIds = new Set(roster.map(r => r.id));
  const addedIds = new Set(players.map(p => p.id));
  const availableRoster = roster.filter(r => !addedIds.has(r.id));

  const update = (id: string, patch: Partial<Player>) =>
    setPlayers(players.map(p => (p.id === id ? { ...p, ...patch } : p)));

  const removePlayer = (id: string) => setPlayers(players.filter(p => p.id !== id));

  const addFromRoster = (p: Player) => setPlayers([...players, p]);

  const addPlayer = () =>
    setPlayers([...players, { id: crypto.randomUUID(), name: "", handicapIndex: 0 }]);

  const addBulkNames = () => {
    const names = bulkNames
      .split("\n")
      .map(n => n.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setPlayers([...players, ...names.map(name => ({ id: crypto.randomUUID(), name, handicapIndex: 0 }))]);
    setBulkNames("");
  };

  return (
    <div className="px-5 pt-4">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        Add everyone playing this round — name and handicap index. This list feeds every other
        step.
      </p>

      {availableRoster.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-2">
            From your roster
          </div>
          {availableRoster.map(r => (
            <button
              key={r.id}
              onClick={() => addFromRoster(r)}
              className="w-full flex items-center gap-2.5 p-2.5 bg-surface border border-dashed border-[color:var(--border-strong)] rounded-xl mb-1.5 text-left"
            >
              <div className="w-[34px] h-[34px] rounded-full bg-surface-raised text-chalk-dim text-xs font-bold flex items-center justify-center flex-shrink-0">
                {r.name.split(" ").filter(Boolean).map(n => n[0]).join("") || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{r.name}</div>
                <div className="text-[11px] text-chalk-dim">Hcp {r.handicapIndex}</div>
              </div>
              <span className="text-turf font-bold text-sm flex-shrink-0">+ Add</span>
            </button>
          ))}
        </div>
      )}

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
          {rosterIds.has(p.id) && (
            <span className="text-[9.5px] font-bold uppercase text-chalk-dim bg-surface-raised px-1.5 py-1 rounded flex-shrink-0">
              Roster
            </span>
          )}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-chalk-dim font-semibold uppercase">Hcp</span>
            <input
              className="w-[52px] bg-surface-raised border border-[color:var(--border-strong)] rounded-md text-turf font-mono text-[13px] font-semibold text-center py-1.5"
              value={p.handicapIndex}
              onChange={e => update(p.id, { handicapIndex: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <button
            onClick={() => removePlayer(p.id)}
            aria-label={`Remove ${p.name || "player"}`}
            className="text-chalk-dim hover:text-flag text-lg leading-none px-1 flex-shrink-0"
          >
            ×
          </button>
        </div>
      ))}

      <button
        onClick={addPlayer}
        className="w-full py-3 rounded-xl border border-dashed border-[color:var(--border-strong)] text-turf font-bold text-[13.5px] mb-4"
      >
        + Add another player
      </button>

      <div className="bg-surface border border-[color:var(--border)] rounded-xl p-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-2">
          Paste a list of names
        </div>
        <textarea
          value={bulkNames}
          onChange={e => setBulkNames(e.target.value)}
          placeholder={"One name per line, e.g.\nMike Reyes\nTom Wagner"}
          rows={3}
          className="w-full bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2.5 py-2 text-sm mb-2 resize-none"
        />
        <button
          onClick={addBulkNames}
          disabled={!bulkNames.trim()}
          className="w-full py-2.5 rounded-lg bg-turf text-fairway-950 font-bold text-[13px] disabled:opacity-60"
        >
          Add names
        </button>
      </div>
    </div>
  );
}
