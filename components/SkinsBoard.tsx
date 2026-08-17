"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveRound } from "@/lib/liveRound";
import { fetchSkinsGame } from "@/lib/rounds";
import {
  approxCourseHandicap,
  calculateSkinsPayout,
  type SkinsGameConfig,
  type SkinsHoleResult,
} from "@/lib/scoring";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function holeStatusLabel(
  gross: SkinsHoleResult | undefined,
  net: SkinsHoleResult | undefined,
  nameFor: (id: string) => string,
  rollover: boolean
) {
  const line = (r: SkinsHoleResult | undefined, label: string) => {
    if (!r) return null;
    if (r.status === "pending") return `${label}: in progress`;
    // "Carried over" only actually happens when the round has rollover
    // on (see lib/scoring.ts's carryover config) — with it off, a tie
    // just loses the skin instead, so the label shouldn't claim it
    // carried anywhere.
    if (r.status === "tied") return `${label}: tied${rollover ? " — carried over" : ""}`;
    return `${label}: won by ${nameFor(r.winnerId!)}`;
  };
  return [line(gross, "Gross"), line(net, "Net")].filter(Boolean).join(" · ");
}

export default function SkinsBoard({ roundId }: { roundId: string }) {
  const { loading, error, players, holes, holeScores } = useLiveRound(roundId);
  const [config, setConfig] = useState<SkinsGameConfig | null | undefined>(undefined);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    fetchSkinsGame(roundId)
      .then(setConfig)
      .catch(e => setConfigError(e instanceof Error ? e.message : "Couldn't load the skins game"));
  }, [roundId]);

  const courseHandicaps = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of players) map[p.id] = approxCourseHandicap(p.handicapIndex);
    return map;
  }, [players]);

  const payout = useMemo(() => {
    if (!config) return null;
    return calculateSkinsPayout(holeScores, players, holes, config, courseHandicaps);
  }, [config, holeScores, players, holes, courseHandicaps]);

  const nameFor = (id: string) => players.find(p => p.id === id)?.name ?? "—";

  if (loading || config === undefined) {
    return <div className="px-5 pt-8 text-sm text-chalk-dim">Loading skins…</div>;
  }
  if (error || configError) {
    return (
      <div className="mx-5 mt-4 p-3 bg-flag/10 border border-flag/30 rounded-xl text-[12.5px] text-flag">
        {error ?? configError}
      </div>
    );
  }
  if (!config || !payout) {
    return (
      <div className="mx-5 mt-4 p-4 bg-surface border border-[color:var(--border)] rounded-xl text-[13px] text-chalk-dim text-center leading-relaxed">
        No skins game set up for this round. Set one up next time from the Skins step in Trip
        Setup.
      </div>
    );
  }

  const allHolesComplete =
    (config.gross ? payout.grossResults.every(r => r.status !== "pending") : true) &&
    (config.net ? payout.netResults.every(r => r.status !== "pending") : true);
  const isFlatBuyin = config.pricing.model === "flat_buyin";

  return (
    <div className="px-5 pt-4 pb-8">
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex-1 min-w-[130px] bg-surface border border-[color:var(--border)] rounded-xl px-3.5 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-1">
            Pot
          </div>
          <div className="font-mono text-lg font-semibold text-flag">{money(payout.pot)}</div>
        </div>
        <div className="flex-1 min-w-[130px] bg-surface border border-[color:var(--border)] rounded-xl px-3.5 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-1">
            Per skin{isFlatBuyin && !allHolesComplete ? " (est.)" : ""}
          </div>
          <div className="font-mono text-lg font-semibold">
            {payout.refundAll ? "—" : money(payout.perSkinValue)}
          </div>
        </div>
        <div className="flex-1 min-w-[130px] bg-surface border border-[color:var(--border)] rounded-xl px-3.5 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-1">
            Skins won
          </div>
          <div className="font-mono text-lg font-semibold">{payout.totalSkinsAwarded}</div>
        </div>
      </div>

      {payout.refundAll && (
        <div className="mb-4 p-3 bg-sand/10 border border-sand/30 rounded-xl text-[12.5px] text-sand leading-relaxed">
          No skins were won across the whole round — every player gets their {money((config.pricing as { buyInPerPlayer: number }).buyInPerPlayer)} entry fee refunded instead.
        </div>
      )}

      <div className="text-[13px] font-bold text-chalk mb-2">Standings</div>
      <div className="bg-surface border border-[color:var(--border)] rounded-xl overflow-hidden mb-5">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[color:var(--border)]">
              <th className="text-left px-2.5 py-2 text-chalk-dim font-semibold text-[10.5px] uppercase">#</th>
              <th className="text-left px-2.5 py-2 text-chalk-dim font-semibold text-[10.5px] uppercase">Player</th>
              {config.gross && (
                <th className="text-right px-2.5 py-2 text-chalk-dim font-semibold text-[10.5px] uppercase">Gross</th>
              )}
              {config.net && (
                <th className="text-right px-2.5 py-2 text-chalk-dim font-semibold text-[10.5px] uppercase">Net</th>
              )}
              <th className="text-right px-2.5 py-2 text-chalk-dim font-semibold text-[10.5px] uppercase">Cash</th>
            </tr>
          </thead>
          <tbody>
            {payout.players.map((p, i) => (
              <tr key={p.playerId} className="border-t border-[color:var(--border)]">
                <td className="px-2.5 py-2 text-chalk-dim">{i + 1}</td>
                <td className="px-2.5 py-2 font-semibold">{p.name}</td>
                {config.gross && <td className="px-2.5 py-2 text-right font-mono">{p.grossSkins}</td>}
                {config.net && <td className="px-2.5 py-2 text-right font-mono">{p.netSkins}</td>}
                <td className="px-2.5 py-2 text-right font-mono font-semibold text-flag">
                  {payout.refundAll ? "—" : money(p.cash)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[13px] font-bold text-chalk mb-2">Hole by hole</div>
      <div className="bg-surface border border-[color:var(--border)] rounded-xl divide-y divide-[color:var(--border)]">
        {holes.map(hole => {
          const g = config.gross ? payout.grossResults.find(r => r.hole === hole.number) : undefined;
          const n = config.net ? payout.netResults.find(r => r.hole === hole.number) : undefined;
          const skinsAtStake = Math.max(g?.skinsAtStake ?? 0, n?.skinsAtStake ?? 0);
          const value = isFlatBuyin
            ? `${skinsAtStake} skin${skinsAtStake === 1 ? "" : "s"}`
            : money(skinsAtStake * (config.pricing as { amountPerSkin: number }).amountPerSkin);
          const pending = (g?.status ?? "pending") === "pending" && (n?.status ?? "pending") === "pending";

          return (
            <div key={hole.number} className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="w-6 text-center font-mono font-bold text-chalk-dim flex-shrink-0">{hole.number}</div>
              <div className={`flex-1 min-w-0 text-[12px] ${pending ? "text-chalk-dim" : "text-chalk"}`}>
                {holeStatusLabel(g, n, nameFor, config.rollover) || "Not tracked"}
              </div>
              <div className="font-mono text-[12px] font-semibold text-chalk-dim flex-shrink-0">{value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
