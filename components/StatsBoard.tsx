"use client";

import { useMemo } from "react";
import { useLiveRound } from "@/lib/liveRound";
import { calculateRoundStats } from "@/lib/scoring";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface-raised rounded-lg px-2.5 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-chalk-dim mb-0.5">{label}</div>
      <div className="font-mono text-[15px] font-semibold text-chalk">{value}</div>
      {sub && <div className="text-[10.5px] text-chalk-dim mt-0.5">{sub}</div>}
    </div>
  );
}

export default function StatsBoard({ roundId }: { roundId: string }) {
  const { loading, error, players, holes, holeScores, trackStats } = useLiveRound(roundId);

  const stats = useMemo(
    () => calculateRoundStats(holeScores, players, holes),
    [holeScores, players, holes]
  );

  if (loading) {
    return <div className="px-5 pt-8 text-sm text-chalk-dim">Loading stats…</div>;
  }
  if (error) {
    return (
      <div className="mx-5 mt-4 p-3 bg-flag/10 border border-flag/30 rounded-xl text-[12.5px] text-flag">
        Couldn&apos;t load the round: {error}
      </div>
    );
  }
  if (!trackStats) {
    return (
      <div className="mx-5 mt-4 p-4 bg-surface border border-[color:var(--border)] rounded-xl text-[13px] text-chalk-dim text-center leading-relaxed">
        Stats weren&apos;t tracked for this round. Turn on &quot;Track stats&quot; in Trip Setup
        next time to see Fairways Hit, GIR, and Putts here.
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 pb-8">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        Fairways Hit only counts non-par-3 holes. GIR is out of every hole in the round. Putts
        per hole averages over whatever was actually recorded.
      </p>

      <div className="flex flex-col gap-3">
        {stats.map(p => (
          <div key={p.playerId} className="bg-surface border border-[color:var(--border)] rounded-xl p-3.5">
            <div className="text-[15px] font-semibold mb-2.5">{p.name}</div>
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Fairways Hit"
                value={`${p.fairwayPct}%`}
                sub={`${p.fairwaysHit} of ${p.fairwaysEligible} eligible`}
              />
              <Stat
                label="GIR"
                value={`${p.girPct}%`}
                sub={`${p.girHit} of ${p.girEligible}`}
              />
              <Stat label="Total Putts" value={`${p.totalPutts}`} />
              <Stat
                label="Putts / Hole"
                value={p.puttsHolesRecorded > 0 ? p.puttsPerHole.toFixed(1) : "—"}
                sub={p.puttsHolesRecorded > 0 ? `over ${p.puttsHolesRecorded} holes` : "no putts recorded"}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
