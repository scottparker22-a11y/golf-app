import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO_TRIP_ID } from "@/lib/rounds";

// Admin-only. Merges newly-assigned players into a Ryder Cup's saved
// team split (see lib/rounds.ts updateRyderCupTournamentTeams) — used
// when a round joining an in-progress Cup has a player who wasn't
// around for round 1's original split (see components/setup/TeamsStep.tsx's
// "Unassigned" section). Only ever adds/overwrites entries for the
// ids passed in; every other player's locked-in team is untouched.
export async function PATCH(request: NextRequest, { params }: { params: { tournamentId: string } }) {
  // This app only ever has one trip's worth of admin PIN (DEMO_TRIP_ID)
  // — same simplification every other admin route here makes.
  const denied = requireAdmin(request, DEMO_TRIP_ID);
  if (denied) return denied;

  const { teamAssignment } = await request.json();
  const additions: Record<string, "A" | "B"> = {};
  if (teamAssignment && typeof teamAssignment === "object") {
    for (const [playerId, side] of Object.entries(teamAssignment)) {
      if (side === "A" || side === "B") additions[playerId] = side;
    }
  }
  if (Object.keys(additions).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const admin = getSupabaseAdmin();
  const { data: existing, error: fetchErr } = await admin
    .from("ryder_cup_tournaments")
    .select("team_assignment")
    .eq("id", params.tournamentId)
    .single();
  if (fetchErr || !existing) {
    return NextResponse.json({ error: fetchErr?.message ?? "Ryder Cup not found" }, { status: 404 });
  }

  const merged = { ...((existing.team_assignment as Record<string, "A" | "B"> | null) ?? {}), ...additions };
  const { error: updateErr } = await admin
    .from("ryder_cup_tournaments")
    .update({ team_assignment: merged })
    .eq("id", params.tournamentId);
  if (updateErr) {
    return NextResponse.json({ error: `Couldn't update the Ryder Cup's teams: ${updateErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Admin-only. Deletes a Ryder Cup wrapper — see
// components/setup/FormatStep.tsx's "Delete this Ryder Cup" button.
// Unlinks any games that had joined it first (games.tournament_id ->
// null) rather than relying on the FK's default NO ACTION, which
// would otherwise just fail the delete outright; the games themselves
// (and every score behind them) are untouched, they just stop
// counting toward a cross-round Cup score.
export async function DELETE(request: NextRequest, { params }: { params: { tournamentId: string } }) {
  const denied = requireAdmin(request, DEMO_TRIP_ID);
  if (denied) return denied;

  const admin = getSupabaseAdmin();

  const { error: clearErr } = await admin
    .from("games")
    .update({ tournament_id: null })
    .eq("tournament_id", params.tournamentId);
  if (clearErr) {
    return NextResponse.json(
      { error: `Couldn't unlink the Ryder Cup's rounds: ${clearErr.message}` },
      { status: 500 }
    );
  }

  const { error: deleteErr } = await admin.from("ryder_cup_tournaments").delete().eq("id", params.tournamentId);
  if (deleteErr) {
    return NextResponse.json({ error: `Couldn't delete the Ryder Cup: ${deleteErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
