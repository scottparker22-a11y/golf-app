import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO_TRIP_ID } from "@/lib/rounds";

// Admin-only. Deletes a Tournament wrapper — see
// components/setup/FormatStep.tsx's "Delete this Tournament" button.
// Unlinks any rounds that had joined it first (rounds.tournament_id ->
// null) rather than relying on the FK's default NO ACTION, which
// would otherwise just fail the delete outright; the rounds
// themselves (and every score/game behind them) are untouched, they
// just stop counting toward a Tournament leaderboard.
export async function DELETE(request: NextRequest, { params }: { params: { tournamentId: string } }) {
  const denied = requireAdmin(request, DEMO_TRIP_ID);
  if (denied) return denied;

  const admin = getSupabaseAdmin();

  const { error: clearErr } = await admin
    .from("rounds")
    .update({ tournament_id: null })
    .eq("tournament_id", params.tournamentId);
  if (clearErr) {
    return NextResponse.json(
      { error: `Couldn't unlink the tournament's rounds: ${clearErr.message}` },
      { status: 500 }
    );
  }

  const { error: deleteErr } = await admin.from("tournaments").delete().eq("id", params.tournamentId);
  if (deleteErr) {
    return NextResponse.json({ error: `Couldn't delete the tournament: ${deleteErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
