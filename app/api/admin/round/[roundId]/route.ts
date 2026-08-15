import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO_TRIP_ID } from "@/lib/rounds";

// Admin-only. Mirrors the old client-side archiveRound()/restoreRound()
// (PATCH status) and deleteRound() (DELETE) in lib/rounds.ts.

export async function PATCH(request: NextRequest, { params }: { params: { roundId: string } }) {
  const denied = requireAdmin(request, DEMO_TRIP_ID);
  if (denied) return denied;

  const { status } = await request.json();
  if (status !== "archived" && status !== "completed") {
    return NextResponse.json({ error: "Invalid round status." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("rounds").update({ status }).eq("id", params.roundId);
  if (error) {
    const verb = status === "archived" ? "archive" : "restore";
    return NextResponse.json({ error: `Couldn't ${verb} the round: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: { roundId: string } }) {
  const denied = requireAdmin(request, DEMO_TRIP_ID);
  if (denied) return denied;

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("rounds").delete().eq("id", params.roundId);
  if (error) {
    return NextResponse.json({ error: `Couldn't delete the round: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
