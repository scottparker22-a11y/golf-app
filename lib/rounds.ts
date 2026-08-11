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
import type { Player } from "./types";

export const DEMO_TRIP_ID = "a0000000-0000-0000-0000-000000000001";
export const DEMO_ROUND_ID = "d0000000-0000-0000-0000-000000000001";
export const DEMO_COURSE_ID = "c0000000-0000-0000-0000-000000000001";
export const DEMO_TEE_NAME = "default";

// Standard par/stroke-index layout used for any course created through
// the app, since real course-data autofill isn't wired up yet (see
// lib/courseData.ts) — every new course gets a playable 18 holes
// immediately instead of an empty scorecard.
const STANDARD_HOLES: { number: number; par: number; strokeIndex: number }[] = [
  { number: 1, par: 4, strokeIndex: 7 },
  { number: 2, par: 3, strokeIndex: 15 },
  { number: 3, par: 5, strokeIndex: 3 },
  { number: 4, par: 4, strokeIndex: 11 },
  { number: 5, par: 4, strokeIndex: 1 },
  { number: 6, par: 3, strokeIndex: 17 },
  { number: 7, par: 4, strokeIndex: 9 },
  { number: 8, par: 5, strokeIndex: 5 },
  { number: 9, par: 4, strokeIndex: 13 },
  { number: 10, par: 4, strokeIndex: 8 },
  { number: 11, par: 3, strokeIndex: 16 },
  { number: 12, par: 5, strokeIndex: 4 },
  { number: 13, par: 4, strokeIndex: 12 },
  { number: 14, par: 4, strokeIndex: 2 },
  { number: 15, par: 3, strokeIndex: 18 },
  { number: 16, par: 4, strokeIndex: 10 },
  { number: 17, par: 5, strokeIndex: 6 },
  { number: 18, par: 4, strokeIndex: 14 },
];

export type CourseSummary = { id: string; name: string; location: string | null };

/** The preloaded queue of courses to pick from, alphabetical. */
export async function fetchCourses(): Promise<CourseSummary[]> {
  const { data, error } = await supabase.from("courses").select("id, name, location").order("name");
  if (error) throw new Error(`Couldn't load courses: ${error.message}`);
  return data ?? [];
}

/**
 * Adds a new course to the queue with a standard 18-hole layout, so
 * it's immediately playable. Returns the new course id.
 */
export async function createCourse(name: string, location: string): Promise<string> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Give the course a name.");

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .insert({ name: trimmedName, location: location.trim() || null })
    .select("id")
    .single();
  if (courseErr || !course) throw new Error(courseErr?.message ?? "Couldn't add the course");

  const { error: holesErr } = await supabase.from("holes").insert(
    STANDARD_HOLES.map(h => ({
      course_id: course.id,
      tee_name: DEMO_TEE_NAME,
      number: h.number,
      par: h.par,
      stroke_index: h.strokeIndex,
    }))
  );
  if (holesErr) throw new Error(`Couldn't set up the course's holes: ${holesErr.message}`);

  return course.id;
}

/** The trip's standing player roster — build it once, reuse every round. */
export async function fetchTripRoster(tripId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, handicap_index")
    .eq("trip_id", tripId)
    .order("name");
  if (error) throw new Error(`Couldn't load the roster: ${error.message}`);
  return (data ?? []).map(p => ({ id: p.id, name: p.name, handicapIndex: p.handicap_index ?? 0 }));
}

// Postgres' foreign-key-violation code — used to turn "can't delete,
// something still points at this row" into a friendly message instead
// of a raw database error.
const FK_VIOLATION = "23503";

/**
 * Deletes a course from the queue. Blocked by the database (and
 * reported here as a friendly error) if any round has already used
 * it — deleting would corrupt that round's history.
 */
export async function deleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) {
    if (error.code === FK_VIOLATION) {
      throw new Error("Can't delete — this course has already been used in a round.");
    }
    throw new Error(`Couldn't delete the course: ${error.message}`);
  }
}

/**
 * Deletes a player from the trip roster. Blocked by the database if
 * they've already recorded scores in a past round — deleting would
 * corrupt that round's history. Removing them from a foursome
 * they're only listed in (no scores yet) happens automatically.
 */
export async function deletePlayer(playerId: string): Promise<void> {
  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) {
    if (error.code === FK_VIOLATION) {
      throw new Error("Can't delete — this player already has scores recorded in a past round.");
    }
    throw new Error(`Couldn't delete the player: ${error.message}`);
  }
}

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

// Set when a roster entry is an existing trip player being reused —
// present means "use this id, don't insert a new row."
export type RosterPlayer = { localId: string; name: string; handicapIndex: number; existingId?: string };
export type RosterGroup = { name: string; localPlayerIds: string[] };

/**
 * Creates a brand-new round from the roster + foursomes built in the
 * Setup Wizard. Roster entries with an `existingId` (picked from the
 * trip's standing roster) are reused as-is rather than duplicated;
 * only genuinely new players get inserted. Any round still marked
 * in_progress for this trip is closed out first.
 */
export async function createRoundWithRoster(
  tripId: string,
  courseId: string,
  players: RosterPlayer[],
  groups: RosterGroup[]
): Promise<string> {
  const namedPlayers = players.filter(p => p.name.trim().length > 0);
  if (namedPlayers.length === 0) {
    throw new Error("Add at least one player before finishing setup.");
  }

  const idMap = new Map<string, string>();

  const toInsert = namedPlayers.filter(p => !p.existingId);
  if (toInsert.length > 0) {
    const { data: insertedPlayers, error: playersErr } = await supabase
      .from("players")
      .insert(toInsert.map(p => ({ trip_id: tripId, name: p.name.trim(), handicap_index: p.handicapIndex })))
      .select("id");
    if (playersErr || !insertedPlayers || insertedPlayers.length !== toInsert.length) {
      throw new Error(playersErr?.message ?? "Couldn't save players");
    }
    // Supabase preserves insert-array order in the returned rows, so
    // pairing by index maps each wizard-local id to its new DB id.
    toInsert.forEach((p, i) => idMap.set(p.localId, insertedPlayers[i].id));
  }

  for (const p of namedPlayers) {
    if (!p.existingId) continue;
    idMap.set(p.localId, p.existingId);
    // Keep the roster's handicap current if it was edited this round.
    const { error: updateErr } = await supabase
      .from("players")
      .update({ handicap_index: p.handicapIndex, name: p.name.trim() })
      .eq("id", p.existingId);
    if (updateErr) throw new Error(`Couldn't update ${p.name}: ${updateErr.message}`);
  }

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
      course_id: courseId,
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
