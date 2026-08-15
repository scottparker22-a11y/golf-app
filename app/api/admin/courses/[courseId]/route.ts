import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO_TRIP_ID, FK_VIOLATION } from "@/lib/rounds";

// Admin-only. Mirrors the old client-side deleteCourse() in lib/rounds.ts.
export async function DELETE(request: NextRequest, { params }: { params: { courseId: string } }) {
  const denied = requireAdmin(request, DEMO_TRIP_ID);
  if (denied) return denied;

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("courses").delete().eq("id", params.courseId);
  if (error) {
    if (error.code === FK_VIOLATION) {
      return NextResponse.json(
        { error: "Can't delete — this course has already been used in a round." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: `Couldn't delete the course: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
