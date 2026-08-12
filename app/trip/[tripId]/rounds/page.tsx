import RoundsList from "@/components/RoundsList";
import { DEMO_TRIP_ID } from "@/lib/rounds";
import PageNav from "@/components/PageNav";

// Round history for the trip — every round played is saved
// permanently (see lib/rounds.ts), so past rounds stay available to
// look back at even after a new one starts.
export default function RoundsPage({ params }: { params: { tripId: string } }) {
  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <PageNav />
      <div className="mow-stripes px-5 pt-7 pb-6 border-b border-[color:var(--border)]">
        <div className="text-xs font-semibold uppercase tracking-wide text-chalk-dim mb-2.5">
          Round history
        </div>
        <h1 className="font-display font-extrabold text-3xl leading-none mb-1">Trip {params.tripId}</h1>
        <div className="text-sm text-chalk-dim font-medium">Every round is saved — tap one to look back</div>
      </div>

      <RoundsList tripId={params.tripId} tripDbId={DEMO_TRIP_ID} />
    </main>
  );
}
