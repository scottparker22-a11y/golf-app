"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TripNav({ tripId, roundId }: { tripId: string; roundId: string }) {
  const pathname = usePathname();

  const tabs = [
    { href: `/trip/${tripId}/round/${roundId}/leaderboard`, label: "Leaderboard" },
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
