import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO_TRIP_ID } from "@/lib/rounds";

// Admin-only. Creates the trip-wide multi-round Tournament row —
// see components/setup/FormatStep.tsx (where "Tournament" is picked
// and totalRounds is set) and lib/rounds.ts fetchActiveTournament
// (which the wizard uses on later rounds to auto-join instead of
// creating a second one).
export async function POST(request: NextRequest) {
  const { tripId, totalRounds, usesHandicap, courseOrder } = await request.json();
  const resolvedTripId = tripId ?? DEMO_TRIP_ID;

  const denied = requireAdmin(request, resolvedTripId);
  if (denied) return denied;

  const rounds = Number(totalRounds);
  if (!Number.isFinite(rounds) || rounds < 1) {
    return NextResponse.json({ error: "Tournaments need at least 1 round." }, { status: 400 });
  }

  // Optional — the course planned for each round, picked up front on
  // the Format step (see components/setup/FormatStep.tsx). Each entry
  // is a course id or null; anything that isn't a non-empty string
  // collapses to null rather than failing the whole request.
  const cleanCourseOrder = Array.isArray(courseOrder)
    ? courseOrder.map((c: unknown) => (typeof c === "string" && c.trim() ? c : null))
    : null;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("tournaments")
    .insert({
      trip_id: resolvedTripId,
      format: "stroke_play",
      total_rounds: rounds,
      uses_handicap: !!usesHandicap,
      course_order: cleanCourseOrder,
    })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Couldn't create the tournament" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
