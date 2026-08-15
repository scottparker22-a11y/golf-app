import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { ADMIN_COOKIE_NAME, adminCookieOptions, signAdminToken } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO_TRIP_ID } from "@/lib/rounds";

const PIN_PATTERN = /^\d{4}$/;

// Bootstraps the trip's admin PIN — only works while trip_admin_pin is
// still null, re-checked here (not just trusted from the UI) so this
// can't be used to silently reset an existing PIN. Auto-logs the
// browser in on success, same as /api/admin/login.
export async function POST(request: NextRequest) {
  const { pin, confirmPin } = await request.json();

  if (typeof pin !== "string" || !PIN_PATTERN.test(pin)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
  }
  if (pin !== confirmPin) {
    return NextResponse.json({ error: "PINs don't match." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: trip, error: fetchErr } = await admin
    .from("trips")
    .select("trip_admin_pin")
    .eq("id", DEMO_TRIP_ID)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: `Couldn't check the trip: ${fetchErr.message}` }, { status: 500 });
  }
  if (trip?.trip_admin_pin) {
    return NextResponse.json(
      { error: "An admin PIN is already set for this trip — use Enter PIN instead." },
      { status: 409 }
    );
  }

  const hash = await bcrypt.hash(pin, 10);
  const { error: updateErr } = await admin
    .from("trips")
    .update({ trip_admin_pin: hash })
    .eq("id", DEMO_TRIP_ID)
    .is("trip_admin_pin", null);
  if (updateErr) {
    return NextResponse.json({ error: `Couldn't save the PIN: ${updateErr.message}` }, { status: 500 });
  }

  const token = signAdminToken(DEMO_TRIP_ID);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, adminCookieOptions);
  return res;
}
