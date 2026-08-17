import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO_TRIP_ID } from "@/lib/rounds";

// Admin-only. Creates a round's Ryder Cup game after the fact — see
// lib/rounds.ts createRyderCupGameForRound and
// components/RyderCupSetupPanel.tsx (reachable from a "this round
// hasn't set up its Ryder Cup matches yet" prompt on Leaderboard.tsx).
// This is the one and only place a `games` row of type ryder_cup gets
// inserted outside of finishing the Setup Wizard.
export async function POST(request: NextRequest, { params }: { params: { roundId: string } }) {
  const denied = requireAdmin(request, DEMO_TRIP_ID);
  if (denied) return denied;

  const { config, tournamentId } = await request.json();
  if (!config || !Array.isArray(config.matches)) {
    return NextResponse.json({ error: "Missing Ryder Cup config." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: existing, error: existingErr } = await admin
    .from("games")
    .select("id")
    .eq("round_id", params.roundId)
    .eq("type", "ryder_cup")
    .maybeSingle();
  if (existingErr) {
    return NextResponse.json({ error: `Couldn't check for an existing game: ${existingErr.message}` }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json(
      { error: "This round already has a Ryder Cup game — edit it instead of creating a new one." },
      { status: 409 }
    );
  }

  const { data, error } = await admin
    .from("games")
    .insert({
      round_id: params.roundId,
      type: "ryder_cup",
      name: "Ryder Cup",
      config,
      tournament_id: tournamentId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Couldn't create the Ryder Cup game" }, { status: 500 });
  }

  return NextResponse.json({ gameId: data.id });
}
