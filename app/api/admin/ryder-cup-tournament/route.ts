import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO_TRIP_ID } from "@/lib/rounds";

// Admin-only. Creates the trip-wide, cross-round Ryder Cup row (the
// existing ryder_cup_tournaments table, previously never written to
// anywhere) — see components/setup/FormatStep.tsx (where "Also play
// Ryder Cup" is toggled and totalRounds is set) and lib/rounds.ts
// fetchActiveRyderCupTournament (which the wizard uses on later
// rounds to auto-join instead of creating a second one).
export async function POST(request: NextRequest) {
  const { tripId, teamAName, teamBName, totalRounds } = await request.json();
  const resolvedTripId = tripId ?? DEMO_TRIP_ID;

  const denied = requireAdmin(request, resolvedTripId);
  if (denied) return denied;

  const rounds = Number(totalRounds);
  if (!Number.isFinite(rounds) || rounds < 1) {
    return NextResponse.json({ error: "The Ryder Cup needs at least 1 round." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("ryder_cup_tournaments")
    .insert({
      trip_id: resolvedTripId,
      team_a_name: (teamAName || "Team A").trim() || "Team A",
      team_b_name: (teamBName || "Team B").trim() || "Team B",
      total_rounds: rounds,
    })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Couldn't create the Ryder Cup" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
