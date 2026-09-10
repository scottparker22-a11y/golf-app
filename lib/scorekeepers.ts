// Real, enforceable Scorekeeper permissions — round (+ optional
// group) scoped, backed by the `scorekeeper_assignments` table (see
// supabase/add-auth-and-roles.sql). This is separate from
// groups.scorer_player_id (set by components/setup/ScorekeeperStep.tsx
// during round setup), which stays purely a cosmetic label — a
// player only actually gets score-write access once they're both (a)
// linked to a real login (players.profile_id) and (b) assigned here.
//
// Unlike most of this file's siblings in lib/rounds.ts,
// assign/removeScorekeeper write directly with the anon client
// rather than through an /api/admin/* route — scorekeeper_assignments
// is gated by its own "admin manages scorekeeper_assignments" RLS
// policy (is_admin(), checked against the caller's real Supabase Auth
// session), so a real admin session is the enforcement here, not a
// server route. invitePlayer is the one exception: creating a login
// always requires the service-role key, so that goes through
// /api/admin/invite-player.

import { supabase } from "./supabase";

async function throwOnError(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  let message = fallback;
  try {
    const data = await res.json();
    if (data?.error) message = data.error;
  } catch {
    // Non-JSON error body — stick with the fallback.
  }
  throw new Error(message);
}

export type ScorekeeperAssignment = {
  id: string;
  groupId: string | null;
  profileId: string;
  displayName: string;
  active: boolean;
};

/** Every active Scorekeeper assignment for a round, across all its groups. */
export async function fetchScorekeepers(roundId: string): Promise<ScorekeeperAssignment[]> {
  // scorekeeper_assignments has two FKs into profiles (profile_id and
  // assigned_by) — the embed must name which one, or PostgREST errors
  // with "more than one relationship was found".
  const { data, error } = await supabase
    .from("scorekeeper_assignments")
    .select("id, group_id, profile_id, active, profiles!scorekeeper_assignments_profile_id_fkey(display_name)")
    .eq("round_id", roundId)
    .eq("active", true);
  if (error) throw new Error(`Couldn't load scorekeepers: ${error.message}`);
  return (data ?? []).map(r => ({
    id: r.id,
    groupId: r.group_id,
    profileId: r.profile_id,
    displayName: (r.profiles as unknown as { display_name: string } | null)?.display_name ?? "—",
    active: r.active,
  }));
}

export type PlayerProfile = { profileId: string; displayName: string } | null;

/** Which of these players already have a login linked, keyed by player id. */
export async function fetchPlayerProfiles(playerIds: string[]): Promise<Record<string, PlayerProfile>> {
  if (playerIds.length === 0) return {};
  const { data, error } = await supabase
    .from("players")
    .select("id, profile_id, profiles(display_name)")
    .in("id", playerIds);
  if (error) throw new Error(`Couldn't load player accounts: ${error.message}`);
  const map: Record<string, PlayerProfile> = {};
  for (const row of data ?? []) {
    map[row.id] = row.profile_id
      ? {
          profileId: row.profile_id,
          displayName: (row.profiles as unknown as { display_name: string } | null)?.display_name ?? "—",
        }
      : null;
  }
  return map;
}

/**
 * Grants (or re-grants, if previously removed) a group-scoped
 * Scorekeeper permission. Idempotent — toggling it on twice in a row
 * doesn't create duplicate rows.
 */
export async function assignScorekeeper(roundId: string, groupId: string, profileId: string): Promise<void> {
  const { data: existing, error: findErr } = await supabase
    .from("scorekeeper_assignments")
    .select("id, active")
    .eq("round_id", roundId)
    .eq("group_id", groupId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (findErr) throw new Error(`Couldn't check existing assignment: ${findErr.message}`);

  if (existing) {
    if (existing.active) return;
    const { error } = await supabase.from("scorekeeper_assignments").update({ active: true }).eq("id", existing.id);
    if (error) throw new Error(`Couldn't re-enable the scorekeeper: ${error.message}`);
    return;
  }

  const { error } = await supabase
    .from("scorekeeper_assignments")
    .insert({ round_id: roundId, group_id: groupId, profile_id: profileId });
  if (error) throw new Error(`Couldn't assign the scorekeeper: ${error.message}`);
}

/**
 * Revokes a Scorekeeper permission immediately — every hole_scores
 * write re-checks can_score() live (see supabase/add-auth-and-roles.sql),
 * so this takes effect on their very next attempt, no re-login needed.
 */
export async function removeScorekeeper(assignmentId: string): Promise<void> {
  const { error } = await supabase.from("scorekeeper_assignments").update({ active: false }).eq("id", assignmentId);
  if (error) throw new Error(`Couldn't remove the scorekeeper: ${error.message}`);
}

/**
 * Links an existing player to a real login — sends them Supabase's
 * own invite email to set their own password (this app never sees or
 * stores it). Admin-only; goes through a Route Handler since creating
 * a login always requires the service-role key.
 */
export async function invitePlayer(playerId: string, email: string): Promise<{ profileId: string }> {
  const res = await fetch("/api/admin/invite-player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, email }),
  });
  await throwOnError(res, "Couldn't send the invite");
  return res.json();
}
