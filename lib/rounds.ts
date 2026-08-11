// ─────────────────────────────────────────────────────────────
// Round history — plain data functions (no "use client"), so both
// server components (redirects, initial fetches) and client
// components can import them. The live-scoring React hook lives in
// lib/liveRound.ts.
//
// Every round a trip plays is its own row in `rounds` and is never
// deleted, so past rounds stay available to look back at even after
// a new one starts. See supabase/seed.sql for the demo trip's
// starting round.
// ─────────────────────────────────────────────────────────────

import { supabase } from "./supabase";

export const DEMO_TRIP_ID = "a0000000-0000-0000-0000-000000000001";
export const DEMO_ROUND_ID = "d0000000-0000-0000-0000-000000000001";
export const DEMO_COURSE_ID = "c0000000-0000-0000-0000-000000000001";
export const DEMO_TEE_NAME = "default";

export type RoundStatus = "upcoming" | "in_progress" | "completed";

export type RoundSummary = {
  id: string;
  date: string;
  status: RoundStatus;
};

/** All rounds for a trip, most recent first. */
export async function fetchRounds(tripId: string): Promise<RoundSummary[]> {
  const { data, error } = await supabase
    .from("rounds")
    .select("id, date, status")
    .eq("trip_id", tripId)
    .order("date", { ascending: false });
  if (error) throw new Error(`Couldn't load rounds: ${error.message}`);
  return (data ?? []).map(r => ({ id: r.id, date: r.date, status: r.status as RoundStatus }));
}

/** The trip's current round — most recent in_progress, else most recent overall. */
export async function fetchCurrentRoundId(tripId: string): Promise<string> {
  const rounds = await fetchRounds(tripId);
  return rounds.find(r => r.status === "in_progress")?.id ?? rounds[0]?.id ?? DEMO_ROUND_ID;
}

/**
 * Starts a new round for the trip, copying the foursomes (groups +
 * players) from an existing round so the new one is immediately
 * playable — no re-entering the roster. Any round still marked
 * in_progress is closed out to completed first.
 */
export async function createRound(tripId: string, copyGroupsFromRoundId: string): Promise<string> {
  const { data: sourceRound, error: sourceErr } = await supabase
    .from("rounds")
    .select("course_id, tee_name")
    .eq("id", copyGroupsFromRoundId)
    .single();
  if (sourceErr || !sourceRound) {
    throw new Error(sourceErr?.message ?? "Couldn't find a round to copy from");
  }

  const { data: sourceGroups, error: groupsErr } = await supabase
    .from("groups")
    .select("name, group_players(player_id)")
    .eq("round_id", copyGroupsFromRoundId);
  if (groupsErr) throw new Error(`Couldn't load groups to copy: ${groupsErr.message}`);

  const { error: closeErr } = await supabase
    .from("rounds")
    .update({ status: "completed" })
    .eq("trip_id", tripId)
    .eq("status", "in_progress");
  if (closeErr) throw new Error(`Couldn't close out the previous round: ${closeErr.message}`);

  const { data: newRound, error: insertErr } = await supabase
    .from("rounds")
    .insert({
      trip_id: tripId,
      course_id: sourceRound.course_id,
      tee_name: sourceRound.tee_name,
      date: new Date().toISOString().slice(0, 10),
      status: "in_progress",
    })
    .select("id")
    .single();
  if (insertErr || !newRound) throw new Error(insertErr?.message ?? "Couldn't create the new round");

  for (const g of (sourceGroups ?? []) as { name: string | null; group_players: { player_id: string }[] | null }[]) {
    const { data: newGroup, error: groupInsertErr } = await supabase
      .from("groups")
      .insert({ round_id: newRound.id, name: g.name })
      .select("id")
      .single();
    if (groupInsertErr || !newGroup) {
      throw new Error(groupInsertErr?.message ?? "Couldn't set up a foursome for the new round");
    }

    const playerIds = (g.group_players ?? []).map(gp => gp.player_id);
    if (playerIds.length > 0) {
      const { error: gpErr } = await supabase
        .from("group_players")
        .insert(playerIds.map(playerId => ({ group_id: newGroup.id, player_id: playerId })));
      if (gpErr) throw new Error(`Couldn't add players to the new round: ${gpErr.message}`);
    }
  }

  return newRound.id;
}

export type RosterPlayer = { localId: string; name: string; handicapIndex: number };
export type RosterGroup = { name: string; localPlayerIds: string[] };

/**
 * Creates a brand-new round from a roster entered in the Setup
 * Wizard — real players, real foursomes, not the seeded demo data.
 * Any round still marked in_progress for this trip is closed out
 * first. Course/tee autofill isn't wired up yet (see
 * lib/courseData.ts), so every round currently uses the same demo
 * course/tee.
 */
export async function createRoundWithRoster(
  tripId: string,
  players: RosterPlayer[],
  groups: RosterGroup[]
): Promise<string> {
  const namedPlayers = players.filter(p => p.name.trim().length > 0);
  if (namedPlayers.length === 0) {
    throw new Error("Add at least one player's name before finishing setup.");
  }

  const { data: insertedPlayers, error: playersErr } = await supabase
    .from("players")
    .insert(
      namedPlayers.map(p => ({ trip_id: tripId, name: p.name.trim(), handicap_index: p.handicapIndex }))
    )
    .select("id");
  if (playersErr || !insertedPlayers || insertedPlayers.length !== namedPlayers.length) {
    throw new Error(playersErr?.message ?? "Couldn't save players");
  }

  // Supabase preserves insert-array order in the returned rows, so
  // pairing by index maps each wizard-local id to its new DB id.
  const idMap = new Map<string, string>();
  namedPlayers.forEach((p, i) => idMap.set(p.localId, insertedPlayers[i].id));

  const { error: closeErr } = await supabase
    .from("rounds")
    .update({ status: "completed" })
    .eq("trip_id", tripId)
    .eq("status", "in_progress");
  if (closeErr) throw new Error(`Couldn't close out the previous round: ${closeErr.message}`);

  const { data: newRound, error: roundErr } = await supabase
    .from("rounds")
    .insert({
      trip_id: tripId,
      course_id: DEMO_COURSE_ID,
      tee_name: DEMO_TEE_NAME,
      date: new Date().toISOString().slice(0, 10),
      status: "in_progress",
    })
    .select("id")
    .single();
  if (roundErr || !newRound) throw new Error(roundErr?.message ?? "Couldn't create the round");

  // Fall back to one big group if foursomes weren't set up, so
  // scoring still works with whatever roster was entered.
  const effectiveGroups: RosterGroup[] =
    groups.length > 0
      ? groups
      : [{ name: "All players", localPlayerIds: namedPlayers.map(p => p.localId) }];

  for (const g of effectiveGroups) {
    const dbPlayerIds = g.localPlayerIds.map(lid => idMap.get(lid)).filter((id): id is string => !!id);
    if (dbPlayerIds.length === 0) continue;

    const { data: newGroup, error: groupErr } = await supabase
      .from("groups")
      .insert({ round_id: newRound.id, name: g.name })
      .select("id")
      .single();
    if (groupErr || !newGroup) throw new Error(groupErr?.message ?? "Couldn't set up a foursome");

    const { error: gpErr } = await supabase
      .from("group_players")
      .insert(dbPlayerIds.map(playerId => ({ group_id: newGroup.id, player_id: playerId })));
    if (gpErr) throw new Error(`Couldn't add players to a foursome: ${gpErr.message}`);
  }

  return newRound.id;
}
