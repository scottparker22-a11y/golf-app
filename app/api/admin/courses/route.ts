import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO_TEE_NAME, DEMO_TRIP_ID, STANDARD_HOLES } from "@/lib/rounds";

// Admin-only. Mirrors the old client-side createCourse() in
// lib/rounds.ts, just run with the service-role client after
// requireAdmin() passes — see supabase/add-admin-pin.sql for the RLS
// change that makes this necessary (the anon key can no longer insert
// into courses/holes at all).
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request, DEMO_TRIP_ID);
  if (denied) return denied;

  const { name, location } = await request.json();
  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (!trimmedName) {
    return NextResponse.json({ error: "Give the course a name." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: course, error: courseErr } = await admin
    .from("courses")
    .insert({ name: trimmedName, location: location || null })
    .select("id")
    .single();
  if (courseErr || !course) {
    return NextResponse.json({ error: courseErr?.message ?? "Couldn't add the course" }, { status: 500 });
  }

  const { error: holesErr } = await admin.from("holes").insert(
    STANDARD_HOLES.map(h => ({
      course_id: course.id,
      tee_name: DEMO_TEE_NAME,
      number: h.number,
      par: h.par,
      stroke_index: h.strokeIndex,
    }))
  );
  if (holesErr) {
    return NextResponse.json(
      { error: `Couldn't set up the course's holes: ${holesErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: course.id });
}
