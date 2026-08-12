"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchRyderCupGame } from "@/lib/rounds";

export default function TripNav({ tripId, roundId }: { tripId: string; roundId: string }) {
  const pathname = usePathname();
  const [hasRyderCup, setHasRyderCup] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Ryder Cup only gets its own tab when the round actually has it
    // configured (see lib/rounds.ts fetchRyderCupGame) — most rounds
    // won't, and the tab shouldn't show up promising a page with
    // nothing on it.
    fetchRyderCupGame(roundId)
      .then(game => {
        if (!cancelled) setHasRyderCup(!!game);
      })
      .catch(() => {
        // Non-fatal — just leave the tab hidden.
      });
    return () => {
      cancelled = true;
    };
  }, [roundId]);

  const tabs = [
    { href: `/trip/${tripId}/round/${roundId}/leaderboard`, label: "Leaderboard" },
    ...(hasRyderCup ? [{ href: `/trip/${tripId}/round/${roundId}/ryder-cup`, label: "Ryder Cup" }] : []),
    { href: `/trip/${tripId}/round/${roundId}/scorecard`, label: "Scorecard" },
    { href: `/trip/${tripId}/round/${roundId}/skins`, label: "Skins" },
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
