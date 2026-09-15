"use client";

import Link from "next/link";
import { useIsAdmin } from "@/lib/useIsAdmin";

// The one Admin entry point — links straight into Trip Setup if
// already logged in as an admin, otherwise to login first.
// Sand-accented to match the other "special access" affordances in
// the app (handicap-stroke dot, Scorer tag).
export default function AdminButton({ tripId }: { tripId: string }) {
  const { isAdmin, loading } = useIsAdmin();

  return (
    <Link
      href={isAdmin ? `/trip/${tripId}/setup` : `/login?next=${encodeURIComponent(`/trip/${tripId}/setup`)}`}
      className="inline-flex items-center gap-1.5 text-[12px] font-bold text-sand bg-sand/10 border border-sand/30 rounded-full px-3 py-1.5"
    >
      <span className="w-[6px] h-[6px] rounded-full bg-sand" />
      {loading ? "Admin" : isAdmin ? "Admin ✓" : "Admin"}
    </Link>
  );
}
