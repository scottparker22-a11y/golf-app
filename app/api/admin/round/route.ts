import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO_TRIP_ID } from "@/lib/rounds";
import { runCreateRoundWithRoster } from "@/lib/admin/roundAdmin";

// Admin-only. The real DB work — inserting players/rounds/groups/
// group_players/games — lives in lib/admin/roundAdmin.ts (moved there
// from lib/rounds.ts's old createRoundWithRoster) so it can run
// against the service-role client. See components/setup/SetupWizard.tsx
// for the caller.
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request, DEMO_TRIP_ID);
  if (denied) return denied;

  const { tripId, courseId, players, groups, skinsConfig, ryderCupConfig, trackStats } = await request.json();
  if (!courseId) {
    return NextResponse.json({ error: "Pick a course on the first step." }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    const roundId = await runCreateRoundWithRoster(
      admin,
      tripId ?? DEMO_TRIP_ID,
      courseId,
      players ?? [],
      groups ?? [],
      skinsConfig,
      ryderCupConfig,
      trackStats
    );
    return NextResponse.json({ roundId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Couldn't finish setup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
