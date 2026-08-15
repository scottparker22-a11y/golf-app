import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO_TRIP_ID } from "@/lib/rounds";

// Admin-only. Pins (or clears, if roundId is null) which round the
// un-scoped Live Leaderboard/Scorecard links default to — see
// lib/rounds.ts fetchCurrentRoundId and supabase/add-current-round
// -selector.sql. trips has no anon/authenticated write policy at all,
// so this is the only way this column ever gets written.
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request, DEMO_TRIP_ID);
  if (denied) return denied;

  const { roundId } = await request.json();
  if (roundId !== null && typeof roundId !== "string") {
    return NextResponse.json({ error: "roundId must be a string or null." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("trips").update({ current_round_id: roundId }).eq("id", DEMO_TRIP_ID);
  if (error) {
    return NextResponse.json({ error: `Couldn't update the live round: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
