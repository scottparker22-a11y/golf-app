import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminFlag } from "@/lib/adminAuth";
import { isRealAdminSession } from "@/lib/supabaseServer";
import { DEMO_TRIP_ID } from "@/lib/rounds";
import ScorekeeperAssignmentPanel from "@/components/ScorekeeperAssignmentPanel";
import TripNav from "@/components/TripNav";
import PageNav from "@/components/PageNav";

// Admin-only. Same route-guard pattern as app/trip/[tripId]/setup —
// either the legacy shared PIN or a real admin session unlocks this.
// Grants/revokes real Scorekeeper access (scorekeeper_assignments) for
// an existing round, live or not — separate from the cosmetic
// scorer_player_id picked during round setup (see
// components/setup/ScorekeeperStep.tsx).
export default async function ScorekeepersPage({
  params,
}: {
  params: { tripId: string; roundId: string };
}) {
  const isAdmin = getAdminFlag(cookies(), DEMO_TRIP_ID) || (await isRealAdminSession());
  if (!isAdmin) {
    redirect(`/trip/${params.tripId}/admin?next=/trip/${params.tripId}/round/${params.roundId}/scorekeepers`);
  }

  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <PageNav />
      <div className="mow-stripes px-5 pt-7 pb-6 border-b border-[color:var(--border)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-chalk-dim mb-2.5">
          <span className="w-[7px] h-[7px] rounded-full bg-turf shadow-[0_0_0_3px_rgba(111,207,151,0.22)]" />
          Setup
        </div>
        <h1 className="font-display font-extrabold text-3xl leading-none mb-1">Scorekeepers</h1>
        <div className="text-sm text-chalk-dim font-medium">Who can enter scores for this round</div>
      </div>

      <TripNav tripId={params.tripId} roundId={params.roundId} />

      <ScorekeeperAssignmentPanel roundId={params.roundId} />
    </main>
  );
}
