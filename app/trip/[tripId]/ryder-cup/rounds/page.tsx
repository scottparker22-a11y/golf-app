import { redirect } from "next/navigation";
import { isRealAdminSession } from "@/lib/supabaseServer";
import RyderCupRoundsScreen from "@/components/RyderCupRoundsScreen";
import PageNav from "@/components/PageNav";

// Admin-only, same route-guard pattern as app/trip/[tripId]/setup —
// the trip-wide Ryder Cup management screen: one card per round the
// Cup is meant to have (see lib/rounds.ts fetchRyderCupRounds), so a
// later round's pairings can be set (or revisited) any time, without
// re-running the whole Setup Wizard or waiting on earlier rounds.
export default async function RyderCupRoundsPage({ params }: { params: { tripId: string } }) {
  const isAdmin = await isRealAdminSession();
  if (!isAdmin) {
    redirect(`/login?next=/trip/${params.tripId}/ryder-cup/rounds`);
  }

  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <PageNav />
      <div className="mow-stripes px-5 pt-7 pb-6 border-b border-[color:var(--border)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-chalk-dim mb-2.5">
          <span className="w-[7px] h-[7px] rounded-full bg-turf shadow-[0_0_0_3px_rgba(111,207,151,0.22)]" />
          Ryder Cup
        </div>
        <h1 className="font-display font-extrabold text-3xl leading-none mb-1">Rounds</h1>
        <div className="text-sm text-chalk-dim font-medium">Set up or revisit any round&apos;s pairings</div>
      </div>

      <RyderCupRoundsScreen tripId={params.tripId} />
    </main>
  );
}
