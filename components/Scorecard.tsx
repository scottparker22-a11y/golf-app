"use client";

import type { Hole, HoleScore, Player } from "@/lib/types";
import { useHoleScores } from "@/lib/tripStore";

type TeamDef = { id: string; name: string; playerIds: string[] };

export default function Scorecard({
  tripId,
  players,
  holes,
  teams,
  initialHoleScores,
}: {
  tripId: string;
  players: Player[];
  holes: Hole[];
  teams: TeamDef[];
  initialHoleScores: HoleScore[];
}) {
  const { holeScores, setStroke, clearStroke } = useHoleScores(tripId, initialHoleScores);

  const scoreFor = (playerId: string, holeNumber: number) =>
    holeScores.find(s => s.playerId === playerId && s.holeNumber === holeNumber)?.strokes;

  const relToParClass = (strokes: number | undefined, par: number) => {
    if (strokes === undefined) return "text-chalk-dim";
    if (strokes <= par - 1) return "text-turf";
    if (strokes === par) return "text-chalk";
    if (strokes === par + 1) return "text-sand";
    return "text-flag";
  };

  const handleChange = (groupId: string, playerId: string, holeNumber: number, raw: string) => {
    if (raw === "") {
      clearStroke(playerId, holeNumber);
      return;
    }
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < 1 || n > 15) return;
    setStroke(groupId, playerId, holeNumber, n);
  };

  return (
    <div className="px-5 pt-4 pb-8">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        Tap a box and enter strokes for each hole. Saves as you go — everyone scoring on this
        same phone/browser will see it update on the leaderboard.
      </p>

      {teams.map(team => (
        <div key={team.id} className="mb-5">
          <div className="text-[13px] font-bold text-chalk mb-2">{team.name}</div>
          <div className="bg-surface border border-[color:var(--border)] rounded-xl overflow-x-auto">
            <table className="border-collapse text-[12px] w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-surface text-left px-2.5 py-2 text-chalk-dim font-semibold text-[11px] uppercase min-w-[68px]">
                    Hole
                  </th>
                  {holes.map(h => (
                    <th key={h.number} className="px-1 py-2 text-chalk-dim font-semibold text-center w-[38px]">
                      {h.number}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky left-0 bg-surface text-left px-2.5 py-1.5 text-chalk-dim font-medium text-[11px]">
                    Par
                  </th>
                  {holes.map(h => (
                    <th key={h.number} className="px-1 py-1.5 text-chalk-dim font-mono text-center">
                      {h.par}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.playerIds.map(playerId => {
                  const p = players.find(pl => pl.id === playerId);
                  if (!p) return null;
                  return (
                    <tr key={playerId} className="border-t border-[color:var(--border)]">
                      <td className="sticky left-0 bg-surface px-2.5 py-1.5 font-semibold text-[12px] whitespace-nowrap">
                        {p.name}
                      </td>
                      {holes.map(h => {
                        const strokes = scoreFor(playerId, h.number);
                        return (
                          <td key={h.number} className="p-0.5">
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={15}
                              value={strokes ?? ""}
                              onChange={e =>
                                handleChange(team.id, playerId, h.number, e.target.value)
                              }
                              className={`w-[36px] h-[32px] text-center bg-surface-raised border border-[color:var(--border-strong)] rounded-md font-mono font-semibold outline-none focus:border-turf ${relToParClass(
                                strokes,
                                h.par
                              )}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
