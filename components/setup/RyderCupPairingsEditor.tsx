"use client";

// Builds this round's Singles (1v1) or Four-Ball (2v2) matches from
// the Cup's two teams — same "auto-fill, then adjust" interaction as
// components/setup/FoursomesStep.tsx, but constrained to keep every
// match split across both sides (a plain foursome doesn't care who's
// on which side; a Ryder Cup match is defined by it). Stableford has
// no pairings of its own — see RyderCupFormatAndPairings, which only
// renders this for the singles/four_ball formats.
import type { Player } from "@/lib/types";
import type { RyderCupMatchConfig } from "@/lib/scoring";

const PLAYERS_PER_SIDE: Record<"singles" | "four_ball", number> = { singles: 1, four_ball: 2 };

export function autoPairMatches(
  teamAPlayers: Player[],
  teamBPlayers: Player[],
  format: "singles" | "four_ball"
): RyderCupMatchConfig[] {
  const perSide = PLAYERS_PER_SIDE[format];
  const count = Math.min(Math.floor(teamAPlayers.length / perSide), Math.floor(teamBPlayers.length / perSide));
  const matches: RyderCupMatchConfig[] = [];
  for (let i = 0; i < count; i++) {
    matches.push({
      id: crypto.randomUUID(),
      matchNumber: i + 1,
      teamAPlayerIds: teamAPlayers.slice(i * perSide, i * perSide + perSide).map(p => p.id),
      teamBPlayerIds: teamBPlayers.slice(i * perSide, i * perSide + perSide).map(p => p.id),
    });
  }
  return matches;
}

export default function RyderCupPairingsEditor({
  format,
  teamAPlayers,
  teamBPlayers,
  teamAName,
  teamBName,
  matches,
  setMatches,
  disabled,
}: {
  format: "singles" | "four_ball";
  teamAPlayers: Player[];
  teamBPlayers: Player[];
  teamAName: string;
  teamBName: string;
  matches: RyderCupMatchConfig[];
  setMatches: (m: RyderCupMatchConfig[]) => void;
  disabled?: boolean;
}) {
  const playerName = (id: string) =>
    teamAPlayers.find(p => p.id === id)?.name ?? teamBPlayers.find(p => p.id === id)?.name ?? "?";

  const pairedIds = new Set(matches.flatMap(m => [...m.teamAPlayerIds, ...m.teamBPlayerIds]));
  const unpairedA = teamAPlayers.filter(p => !pairedIds.has(p.id));
  const unpairedB = teamBPlayers.filter(p => !pairedIds.has(p.id));

  // Swaps one player with whoever's in the same slot of another match
  // on the same side — mirrors FoursomesStep's MoveSelect pattern
  // (pick a match to swap into) rather than free drag-and-drop.
  const swapPlayer = (side: "A" | "B", fromMatchIndex: number, playerId: string, toMatchIndex: number) => {
    if (fromMatchIndex === toMatchIndex) return;
    const key = side === "A" ? ("teamAPlayerIds" as const) : ("teamBPlayerIds" as const);
    const next = matches.map(m => ({ ...m, teamAPlayerIds: [...m.teamAPlayerIds], teamBPlayerIds: [...m.teamBPlayerIds] }));
    const fromIds = next[fromMatchIndex][key];
    const toIds = next[toMatchIndex][key];
    const fromIdx = fromIds.indexOf(playerId);
    if (fromIdx === -1) return;
    const otherPlayerId = toIds[0];
    if (otherPlayerId !== undefined) {
      fromIds[fromIdx] = otherPlayerId;
      toIds[toIds.indexOf(otherPlayerId)] = playerId;
    } else {
      fromIds.splice(fromIdx, 1);
      toIds.push(playerId);
    }
    setMatches(next);
  };

  const SwapSelect = ({ side, matchIndex, playerId }: { side: "A" | "B"; matchIndex: number; playerId: string }) =>
    matches.length > 1 ? (
      <select
        value={matchIndex}
        disabled={disabled}
        onChange={e => swapPlayer(side, matchIndex, playerId, Number(e.target.value))}
        aria-label="Swap into a different match"
        className="bg-surface-raised border border-[color:var(--border-strong)] rounded-md text-[10.5px] font-semibold text-chalk-dim px-1.5 py-1 flex-shrink-0 disabled:opacity-60"
      >
        {matches.map((_, i) => (
          <option key={i} value={i}>
            {i === matchIndex ? `Match ${i + 1}` : `↔ Match ${i + 1}`}
          </option>
        ))}
      </select>
    ) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim">Pairings</div>
        <button
          onClick={() => setMatches(autoPairMatches(teamAPlayers, teamBPlayers, format))}
          disabled={disabled}
          className="text-[11px] font-bold text-turf underline disabled:opacity-60"
        >
          Auto-pair
        </button>
      </div>

      {matches.length === 0 ? (
        <p className="text-[12.5px] text-chalk-dim mb-3">No pairings yet — tap Auto-pair to build them.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-3">
          {matches.map((match, mi) => (
            <div key={match.id} className="bg-surface border border-[color:var(--border)] rounded-xl p-3">
              <div className="text-[11px] font-bold text-chalk-dim mb-2">Match {match.matchNumber}</div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                <div>
                  <div className="text-[10px] font-bold text-chalk-dim mb-1">{teamAName}</div>
                  {match.teamAPlayerIds.map(id => (
                    <div key={id} className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <div className="text-[12px] font-semibold flex-1 min-w-0 truncate">{playerName(id)}</div>
                      <SwapSelect side="A" matchIndex={mi} playerId={id} />
                    </div>
                  ))}
                </div>
                <div className="text-chalk-dim text-[11px] font-semibold pt-1">vs</div>
                <div>
                  <div className="text-[10px] font-bold text-chalk-dim mb-1 text-right">{teamBName}</div>
                  {match.teamBPlayerIds.map(id => (
                    <div key={id} className="flex items-center gap-1.5 mb-1 flex-wrap justify-end">
                      <SwapSelect side="B" matchIndex={mi} playerId={id} />
                      <div className="text-[12px] font-semibold flex-1 min-w-0 truncate text-right">{playerName(id)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(unpairedA.length > 0 || unpairedB.length > 0) && (
        <div className="p-2.5 bg-surface-raised rounded-lg text-[11px] text-chalk-dim leading-relaxed">
          Not in a pairing this round: {[...unpairedA, ...unpairedB].map(p => p.name).join(", ")}
        </div>
      )}
    </div>
  );
}
