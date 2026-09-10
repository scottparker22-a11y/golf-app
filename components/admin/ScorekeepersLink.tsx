"use client";

import Link from "next/link";
import { useIsAdmin } from "@/lib/useIsAdmin";

// Admin-only entry point into this round's Scorekeeper assignments
// (see app/trip/[tripId]/round/[roundId]/scorekeepers) — same
// isAdmin-aware gating as AdminButton, just a second small pill next
// to it rather than folded into TripNav's tab bar (this is a one-off
// setup action, not a screen every viewer navigates to).
export default function ScorekeepersLink({ tripId, roundId }: { tripId: string; roundId: string }) {
  const { isAdmin, loading } = useIsAdmin();
  if (loading || !isAdmin) return null;

  return (
    <Link
      href={`/trip/${tripId}/round/${roundId}/scorekeepers`}
      className="inline-flex items-center gap-1.5 text-[12px] font-bold text-chalk-dim bg-surface border border-[color:var(--border-strong)] rounded-full px-3 py-1.5"
    >
      Scorekeepers
    </Link>
  );
}
