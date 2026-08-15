"use client";

import Link from "next/link";
import { useIsAdmin } from "@/lib/useIsAdmin";

// The home page's entry point into Trip Setup — deliberately separated
// from the main menu (see app/page.tsx) and labeled so it reads as a
// side door, not a regular option. Same isAdmin-aware routing as
// components/admin/AdminButton.tsx (straight to Setup if this browser
// already unlocked the PIN, otherwise to the PIN screen first), just
// styled small/muted to match this page's de-emphasized treatment
// instead of the leaderboard header's pill.
export default function AdminSetupLink({ tripId }: { tripId: string }) {
  const { isAdmin } = useIsAdmin();

  return (
    <Link href={isAdmin ? `/trip/${tripId}/setup` : `/trip/${tripId}/admin`} className="text-chalk-dim text-xs underline">
      Trip setup <span className="text-chalk-dim/70">(Admin only)</span>
    </Link>
  );
}
