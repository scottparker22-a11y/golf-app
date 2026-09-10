import { NextResponse, type NextRequest } from "next/server";
import { requireAdminBridged } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEMO_TRIP_ID } from "@/lib/rounds";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Admin-only. Links a golfer (an existing `players` row) to a real
// login: sends Supabase's own built-in invite email (a link to set
// their own password — this app never sees or stores it), then links
// the resulting auth user to a `profiles` row and that row back onto
// the player. If the email is already a registered Supabase Auth
// user (e.g. re-linking, or they already have an account for a
// different player/trip), reuses that existing user instead of
// erroring — inviteUserByEmail's own "already registered" case.
export async function POST(request: NextRequest) {
  const denied = await requireAdminBridged(request, DEMO_TRIP_ID);
  if (denied) return denied;

  const { playerId, email } = await request.json();
  if (typeof playerId !== "string" || !playerId) {
    return NextResponse.json({ error: "playerId is required." }, { status: 400 });
  }
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: player, error: playerErr } = await admin
    .from("players")
    .select("id, name, trip_id, profile_id")
    .eq("id", playerId)
    .maybeSingle();
  if (playerErr) {
    return NextResponse.json({ error: `Couldn't load the player: ${playerErr.message}` }, { status: 500 });
  }
  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }
  if (player.profile_id) {
    return NextResponse.json({ error: "This player already has an account linked." }, { status: 409 });
  }

  let authUserId: string;
  const invited = await admin.auth.admin.inviteUserByEmail(email);
  if (invited.error) {
    // "already registered" isn't a failure here — link the existing
    // account instead of bouncing the admin with an error for
    // something they'd reasonably expect to just work.
    const alreadyRegistered = /already.*registered|already.*exists/i.test(invited.error.message);
    if (!alreadyRegistered) {
      return NextResponse.json({ error: `Couldn't send the invite: ${invited.error.message}` }, { status: 500 });
    }
    const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) {
      return NextResponse.json({ error: `Couldn't look up the existing account: ${listErr.message}` }, { status: 500 });
    }
    const existing = usersPage.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) {
      return NextResponse.json({ error: "That email is registered, but couldn't be found." }, { status: 500 });
    }
    authUserId = existing.id;
  } else {
    authUserId = invited.data.user.id;
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .upsert(
      { auth_user_id: authUserId, display_name: player.name, email, role: "player", active: true },
      { onConflict: "auth_user_id" }
    )
    .select("id")
    .single();
  if (profileErr) {
    return NextResponse.json({ error: `Couldn't create the profile: ${profileErr.message}` }, { status: 500 });
  }

  const { error: linkErr } = await admin.from("players").update({ profile_id: profile.id }).eq("id", playerId);
  if (linkErr) {
    return NextResponse.json({ error: `Couldn't link the profile to the player: ${linkErr.message}` }, { status: 500 });
  }

  // Best-effort — trip_members isn't enforced by anything yet (that's
  // the later, separate read-lockdown phase), so a failure here
  // shouldn't block the invite itself.
  await admin
    .from("trip_members")
    .upsert(
      { trip_id: player.trip_id, profile_id: profile.id, player_id: playerId, status: "active" },
      { onConflict: "trip_id,profile_id" }
    );

  return NextResponse.json({ profileId: profile.id });
}
