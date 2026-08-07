"use client";

import type { GolfFormat, Player } from "@/lib/types";

export type Group = { id: string; playerIds: string[]; format: GolfFormat };

const FORMATS: { value: GolfFormat; label: string }[] = [
  { value: "stroke_play", label: "Stroke Play" },
  { value: "best_ball", label: "Best Ball" },
  { value: "scramble", label: "Scramble" },
  { value: "alt_shot", label: "Alt Shot" },
];

export default function FoursomesStep({
  players,
  groups,
  setGroups,
}: {
  players: Player[];
  groups: Group[];
  setGroups: (g: Group[]) => void;
}) {
  const autoFill = () => {
    const sorted = [...players].sort((a, b) => a.handicapIndex - b.handicapIndex);
    const size = 4;
    const next: Group[] = [];
    for (let i = 0; i < sorted.length; i += size) {
      next.push({
        id: crypto.randomUUID(),
        playerIds: sorted.slice(i, i + size).map(p => p.id),
        format: "stroke_play",
      });
    }
    setGroups(next);
  };

  const avgHcp = (ids: string[]) => {
    const list = players.filter(p => ids.includes(p.id));
    return list.length ? (list.reduce((s, p) => s + p.handicapIndex, 0) / list.length).toFixed(1) : "—";
  };

  return (
    <div className="px-5 pt-4">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        Groups for the round — auto-fill spreads handicaps evenly, or build them manually.
      </p>

      <button
        onClick={autoFill}
        className="inline-flex items-center gap-1.5 bg-surface-raised border border-[color:var(--border-strong)] text-chalk text-[12.5px] font-bold px-3 py-2 rounded-lg mb-4"
      >
        ⤨ Auto-fill foursomes
      </button>

      {groups.map((group, gi) => (
        <div key={group.id} className="bg-surface border border-[color:var(--border)] rounded-xl p-3.5 mb-3">
          <div className="flex justify-between items-center mb-2.5">
            <div className="font-display font-extrabold text-[17px]">Group {gi + 1}</div>
            <div className="text-[11px] text-chalk-dim font-mono">avg {avgHcp(group.playerIds)}</div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto mb-3 pb-0.5">
            {FORMATS.map(f => (
              <button
                key={f.value}
                onClick={() => {
                  const next = [...groups];
                  next[gi] = { ...group, format: f.value };
                  setGroups(next);
                }}
                className={`flex-shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-full border whitespace-nowrap ${
                  group.format === f.value
                    ? "bg-turf text-fairway-950 border-turf"
                    : "bg-surface-raised text-chalk-dim border-[color:var(--border-strong)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {group.playerIds.map(id => {
            const p = players.find(pl => pl.id === id);
            if (!p) return null;
            return (
              <div key={id} className="flex items-center gap-2 bg-surface-raised rounded-lg px-2.5 py-1.5 mb-1.5">
                <div className="text-[12.5px] font-semibold flex-1">{p.name}</div>
                <div className="text-[11px] text-chalk-dim font-mono">{p.handicapIndex}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
