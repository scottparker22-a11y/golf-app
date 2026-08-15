import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO_TRIP_ID, FK_VIOLATION } from "@/lib/rounds";

// Admin-only. Mirrors the old client-side deletePlayer() in lib/rounds.ts.
export async function DELETE(request: NextRequest, { params }: { params: { playerId: string } }) {
  const denied = requireAdmin(request, DEMO_TRIP_ID);
  if (denied) return denied;

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("players").delete().eq("id", params.playerId);
  if (error) {
    if (error.code === FK_VIOLATION) {
      return NextResponse.json(
        { error: "Can't delete — this player already has scores recorded in a past round." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: `Couldn't delete the player: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
