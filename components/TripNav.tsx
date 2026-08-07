"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TripNav({ tripId }: { tripId: string }) {
  const pathname = usePathname();

  const tabs = [
    { href: `/trip/${tripId}/leaderboard`, label: "Leaderboard" },
    { href: `/trip/${tripId}/scorecard`, label: "Scorecard" },
  ];

  return (
    <div className="flex gap-1 mx-5 mt-4 p-1 bg-surface border border-[color:var(--border)] rounded-xl">
      {tabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex-1 text-center text-sm font-semibold py-2 rounded-lg ${
            pathname === tab.href ? "bg-surface-raised text-chalk" : "text-chalk-dim"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
