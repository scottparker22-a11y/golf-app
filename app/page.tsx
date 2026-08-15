import Link from "next/link";
import PageNav from "@/components/PageNav";
import AdminSetupLink from "@/components/admin/AdminSetupLink";

// Landing page — in a real build this would list the user's trips
// from Supabase and let them create a new one. Kept minimal here
// since trip creation isn't wired up yet.
export default function Home() {
  return (
    <main className="min-h-screen max-w-[460px] mx-auto flex flex-col">
      <PageNav />
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display font-extrabold text-3xl">Buddy Trip Golf</h1>
        <p className="text-chalk-dim text-sm max-w-xs">
          Live scoring, skins, Nassau, and Ryder Cup for the trip.
        </p>
        <Link
          href="/trip/demo/leaderboard"
          className="mt-2 bg-turf text-fairway-950 font-bold text-sm px-5 py-3 rounded-xl"
        >
          Live leaderboard
        </Link>
        <Link href="/trip/demo/scorecard" className="text-turf text-sm underline">
          Enter scores (scorecard)
        </Link>
        <Link href="/trip/demo/rounds" className="text-turf text-sm underline">
          Round history
        </Link>

        <div className="w-full max-w-[160px] border-t border-[color:var(--border)] mt-4 pt-4">
          <AdminSetupLink tripId="demo" />
        </div>
      </div>
    </main>
  );
}
