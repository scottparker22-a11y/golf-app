import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO_TRIP_ID } from "@/lib/rounds";

// The single status check both useIsAdmin() (client hook) and the
// admin PIN screen use — isAdmin drives the Admin button / route
// guard, pinSet decides whether the PIN screen offers "Set PIN" or
// "Enter PIN".
export async function GET(request: NextRequest) {
  const isAdmin = verifyAdminToken(request.cookies.get(ADMIN_COOKIE_NAME)?.value, DEMO_TRIP_ID);

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("trips")
      .select("id")
      .eq("id", DEMO_TRIP_ID)
      .not("trip_admin_pin", "is", null)
      .maybeSingle();
    return NextResponse.json({ isAdmin, pinSet: !error && !!data });
  } catch (e) {
    // SUPABASE_SERVICE_ROLE_KEY not set yet, most likely — surface as
    // "no PIN set" rather than crashing the leaderboard's Admin button.
    const message = e instanceof Error ? e.message : "Couldn't check admin status";
    return NextResponse.json({ isAdmin, pinSet: false, error: message });
  }
}
