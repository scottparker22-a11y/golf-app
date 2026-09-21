import { redirect } from "next/navigation";
import { isRealAdminSession } from "@/lib/supabaseServer";
import RyderCupNewRoundPanel from "@/components/RyderCupNewRoundPanel";
import PageNav from "@/components/PageNav";

// Admin-only. Reached from a "Not created yet" card on the Ryder Cup
// Rounds screen (components/RyderCupRoundsScreen.tsx) — ?roundNumber=
// is purely a display label here ("Start Round 3"); which numbered
// slot a newly-created round actually lands in is worked out fresh
// each time from real round dates (see lib/rounds.ts
// fetchRyderCupRounds), not enforced by this param.
export default async function RyderCupNewRoundPage({
  params,
  searchParams,
}: {
  params: { tripId: string };
  searchParams: { roundNumber?: string };
}) {
  const isAdmin = await isRealAdminSession();
  if (!isAdmin) {
    redirect(`/login?next=/trip/${params.tripId}/ryder-cup/rounds`);
  }

  const roundNumber = Math.max(1, parseInt(searchParams.roundNumber ?? "1", 10) || 1);

  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <PageNav />
      <div className="mow-stripes px-5 pt-7 pb-6 border-b border-[color:var(--border)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-chalk-dim mb-2.5">
          <span className="w-[7px] h-[7px] rounded-full bg-turf shadow-[0_0_0_3px_rgba(111,207,151,0.22)]" />
          Ryder Cup
        </div>
        <h1 className="font-display font-extrabold text-3xl leading-none mb-1">Round {roundNumber}</h1>
        <div className="text-sm text-chalk-dim font-medium">Course, format &amp; pairings</div>
      </div>

      <RyderCupNewRoundPanel tripId={params.tripId} roundNumber={roundNumber} />
    </main>
  );
}
