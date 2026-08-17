"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchRoundStatus } from "@/lib/rounds";

export default function TripNav({ tripId, roundId }: { tripId: string; roundId: string }) {
  const pathname = usePathname();
  const [showStats, setShowStats] = useState(false);
  const [hasTournament, setHasTournament] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Stats is an end-of-round summary, not a live board — only shows
    // once the round actually has stats tracking on AND is completed
    // (see components/setup/RoundsStep.tsx, components/StatsBoard.tsx).
    // Tournament only shows once this round has opted into a
    // multi-round Tournament (see components/setup/FormatStep.tsx).
    // Ryder Cup no longer gets its own tab here — it's a view inside
    // Leaderboard now (see components/Leaderboard.tsx/RyderCupBoard.tsx).
    fetchRoundStatus(roundId)
      .then(({ status, trackStats, tournamentId }) => {
        if (cancelled) return;
        setShowStats(trackStats && status === "completed");
        setHasTournament(!!tournamentId);
      })
      .catch(() => {
        // Non-fatal — just leave the tabs hidden.
      });
    return () => {
      cancelled = true;
    };
  }, [roundId]);

  const tabs = [
    { href: `/trip/${tripId}/round/${roundId}/leaderboard`, label: "Leaderboard" },
    ...(hasTournament ? [{ href: `/trip/${tripId}/tournament`, label: "Tournament" }] : []),
    { href: `/trip/${tripId}/round/${roundId}/scorecard`, label: "Scorecard" },
    { href: `/trip/${tripId}/round/${roundId}/skins`, label: "Skins" },
    ...(showStats ? [{ href: `/trip/${tripId}/round/${roundId}/stats`, label: "Stats" }] : []),
    { href: `/trip/${tripId}/rounds`, label: "History" },
  ];

  return (
    <div className="flex gap-1 mx-5 mt-4 p-1 bg-surface border border-[color:var(--border)] rounded-xl overflow-x-auto">
      {tabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex-1 text-center text-sm font-semibold py-2 rounded-lg whitespace-nowrap px-2 ${
            pathname === tab.href ? "bg-surface-raised text-chalk" : "text-chalk-dim"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
