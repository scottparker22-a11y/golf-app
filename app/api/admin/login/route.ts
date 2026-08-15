import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { ADMIN_COOKIE_NAME, adminCookieOptions, signAdminToken } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO_TRIP_ID } from "@/lib/rounds";
import { checkLoginRateLimit, clearLoginRateLimit, rateLimitKeyFor, recordFailedLogin } from "@/lib/loginRateLimit";

const PIN_PATTERN = /^\d{4}$/;

export async function POST(request: NextRequest) {
  const rateLimitKey = rateLimitKeyFor(request);
  if (!checkLoginRateLimit(rateLimitKey)) {
    return NextResponse.json({ error: "Too many attempts — try again in a few minutes." }, { status: 429 });
  }

  const { pin } = await request.json();
  if (typeof pin !== "string" || !PIN_PATTERN.test(pin)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: trip, error: fetchErr } = await admin
    .from("trips")
    .select("trip_admin_pin")
    .eq("id", DEMO_TRIP_ID)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: `Couldn't check the PIN: ${fetchErr.message}` }, { status: 500 });
  }
  if (!trip?.trip_admin_pin) {
    return NextResponse.json({ error: "No admin PIN set yet — set one first." }, { status: 400 });
  }

  const matches = await bcrypt.compare(pin, trip.trip_admin_pin);
  if (!matches) {
    recordFailedLogin(rateLimitKey);
    return NextResponse.json({ error: "Wrong PIN." }, { status: 401 });
  }

  clearLoginRateLimit(rateLimitKey);
  const token = signAdminToken(DEMO_TRIP_ID);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, adminCookieOptions);
  return res;
}
