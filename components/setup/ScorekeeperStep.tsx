"use client";

import type { Player } from "@/lib/types";
import type { Group } from "./FoursomesStep";

export default function ScorekeeperStep({
  players,
  groups,
  scorekeepers,
  setScorekeepers,
}: {
  players: Player[];
  groups: Group[];
  scorekeepers: Record<string, string>; // groupId -> playerId
  setScorekeepers: (s: Record<string, string>) => void;
}) {
  return (
    <div className="px-5 pt-4">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        Tap a player in each group to make them the scorekeeper — the only one entering strokes during the round.
      </p>

      {groups.map((group, gi) => (
        <div key={group.id} className="bg-surface border border-[color:var(--border)] rounded-xl p-3.5 mb-3">
          <div className="font-display font-extrabold text-[17px] mb-2.5">Group {gi + 1}</div>
          {group.playerIds.map(id => {
            const p = players.find(pl => pl.id === id);
            if (!p) return null;
            const selected = scorekeepers[group.id] === id;
            return (
              <button
                key={id}
                onClick={() => setScorekeepers({ ...scorekeepers, [group.id]: id })}
                className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 mb-1.5 border text-left ${
                  selected ? "bg-sand/15 border-sand" : "bg-surface-raised border-[color:var(--border-strong)]"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    selected ? "bg-sand border-sand" : "border-chalk-dim"
                  }`}
                />
                <span className="text-[12.5px] font-semibold flex-1">{p.name}</span>
                {selected && <span className="text-[10px] font-bold text-sand uppercase">Scorer</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
