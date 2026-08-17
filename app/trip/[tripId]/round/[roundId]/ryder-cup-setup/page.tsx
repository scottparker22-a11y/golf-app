import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminFlag } from "@/lib/adminAuth";
import { DEMO_TRIP_ID } from "@/lib/rounds";
import RyderCupSetupPanel from "@/components/RyderCupSetupPanel";
import TripNav from "@/components/TripNav";
import PageNav from "@/components/PageNav";

// Admin-only, reachable from Leaderboard.tsx's "this round hasn't set
// up its Ryder Cup matches yet" prompt (a round set up as Ryder Cup
// with no matches never gets a games row — see
// components/RyderCupSetupPanel.tsx). Same route-guard pattern as
// app/trip/[tripId]/setup/page.tsx.
export default function RyderCupSetupPage({
  params,
}: {
  params: { tripId: string; roundId: string };
}) {
  const isAdmin = getAdminFlag(cookies(), DEMO_TRIP_ID);
  if (!isAdmin) {
    redirect(`/trip/${params.tripId}/admin?next=/trip/${params.tripId}/round/${params.roundId}/ryder-cup-setup`);
  }

  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <PageNav />
      <div className="mow-stripes px-5 pt-7 pb-6 border-b border-[color:var(--border)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-chalk-dim mb-2.5">
          <span className="w-[7px] h-[7px] rounded-full bg-turf shadow-[0_0_0_3px_rgba(111,207,151,0.22)]" />
          Setup
        </div>
        <h1 className="font-display font-extrabold text-3xl leading-none mb-1">Ryder Cup</h1>
        <div className="text-sm text-chalk-dim font-medium">Teams &amp; matches for this round</div>
      </div>

      <TripNav tripId={params.tripId} roundId={params.roundId} />

      <RyderCupSetupPanel tripId={params.tripId} roundId={params.roundId} />
    </main>
  );
}
