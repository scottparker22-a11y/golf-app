// ─────────────────────────────────────────────────────────────
// Round history — plain data functions (no "use client"), so both
// server components (redirects, initial fetches) and client
// components can import them. The live-scoring React hook lives in
// lib/liveRound.ts.
//
// Every round a trip plays is its own row in `rounds`, kept around by
// default so past rounds stay available to look back at even after a
// new one starts (archiveRound just hides one from the main list).
// deleteRound is the one true escape hatch, for rounds that were
// created by mistake — it's irreversible and cascades to that
// round's groups/group_players/hole_scores/games, unlike everything
// else here. See supabase/seed.sql for the demo trip's starting round.
// ─────────────────────────────────────────────────────────────

import { supabase } from "./supabase";
import type { Player } from "./types";
import type { SkinsGameConfig, RyderCupGameConfig } from "./scoring";

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

export type RoundStatus = "upcoming" | "in_progress" | "completed" | "archived";

export type RoundSummary = {
  id: string;
  date: string;
  status: RoundStatus;
};

/**
 * All rounds for a trip, most recent first. Ordered by created_at
 * (not just `date`) since several rounds can share the same calendar
 * date — without a real tiebreaker, "most recent" is ambiguous and
 * things like "start a new round, copying the last one" can silently
 * grab the wrong round.
 */
export async function fetchRounds(tripId: string): Promise<RoundSummary[]> {
  const { data, error } = await supabase
    .from("rounds")
    .select("id, date, status")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Couldn't load rounds: ${error.message}`);
  return (data ?? []).map(r => ({ id: r.id, date: r.date, status: r.status as RoundStatus }));
}

/** The trip's current round — most recent in_progress, else most recent overall (archived rounds excluded). */
export async function fetchCurrentRoundId(tripId: string): Promise<string> {
  const rounds = (await fetchRounds(tripId)).filter(r => r.status !== "archived");
  return rounds.find(r => r.status === "in_progress")?.id ?? rounds[0]?.id ?? DEMO_ROUND_ID;
}

/**
 * Archives a round — hides it from the main History list without
 * deleting anything. Reversible via restoreRound.
 */
export async function archiveRound(roundId: string): Promise<void> {
  const { error } = await supabase.from("rounds").update({ status: "archived" }).eq("id", roundId);
  if (error) throw new Error(`Couldn't archive the round: ${error.message}`);
}

/** Un-archives a round, putting it back in History as completed. */
export async function restoreRound(roundId: string): Promise<void> {
  const { error } = await supabase.from("rounds").update({ status: "completed" }).eq("id", roundId);
  if (error) throw new Error(`Couldn't restore the round: ${error.message}`);
}

/**
 * Permanently deletes a round — for ones created by mistake or that
 * never actually happened. Unlike archiveRound, this can't be undone:
 * it cascades to the round's groups, group_players, hole_scores, and
 * games. Player and course rows themselves are untouched (they're
 * trip-scoped, not round-scoped).
 */
export async function deleteRound(roundId: string): Promise<void> {
  const { error } = await supabase.from("rounds").delete().eq("id", roundId);
  if (error) throw new Error(`Couldn't delete the round: ${error.message}`);
}

/** The round's Skins game config, if one was set up — null if Skins isn't being played. */
export async function fetchSkinsGame(roundId: string): Promise<SkinsGameConfig | null> {
  const { data, error } = await supabase
    .from("games")
    .select("config")
    .eq("round_id", roundId)
    .eq("type", "skins")
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the skins game: ${error.message}`);
  return (data?.config as SkinsGameConfig | undefined) ?? null;
}

/**
 * The round's Ryder Cup game (id + config), if Ryder Cup Style was
 * enabled for it — null otherwise. TripNav uses this to decide
 * whether to show the Ryder Cup tab at all.
 */
export async function fetchRyderCupGame(
  roundId: string
): Promise<{ gameId: string; config: RyderCupGameConfig } | null> {
  const { data, error } = await supabase
    .from("games")
    .select("id, config")
    .eq("round_id", roundId)
    .eq("type", "ryder_cup")
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the Ryder Cup game: ${error.message}`);
  if (!data) return null;
  return { gameId: data.id, config: data.config as RyderCupGameConfig };
}

/** Saves a round's Ryder Cup game config (only if at least one match is configured). */
export async function createRyderCupGame(roundId: string, config: RyderCupGameConfig): Promise<void> {
  if (config.matches.length === 0) return;
  const { error } = await supabase
    .from("games")
    .insert({ round_id: roundId, type: "ryder_cup", name: "Ryder Cup", config });
  if (error) throw new Error(`Couldn't save the Ryder Cup game: ${error.message}`);
}

/**
 * Updates a round's Ryder Cup config in place — used for manual match
 * overrides and mid-round pairing edits. Never touches hole_scores;
 * an override only ever changes what's stored here.
 */
export async function updateRyderCupGame(gameId: string, config: RyderCupGameConfig): Promise<void> {
  const { error } = await supabase.from("games").update({ config }).eq("id", gameId);
  if (error) throw new Error(`Couldn't update the Ryder Cup game: ${error.message}`);
}

/** Saves a round's Skins game config (only if Gross or Net is actually enabled). */
export async function createSkinsGame(roundId: string, config: SkinsGameConfig): Promise<void> {
  if (!config.gross && !config.net) return;
  const { error } = await supabase
    .from("games")
    .insert({ round_id: roundId, type: "skins", name: "Skins", config });
  if (error) throw new Error(`Couldn't save the skins game: ${error.message}`);
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
  groups: RosterGroup[],
  skinsConfig?: SkinsGameConfig | null,
  ryderCupConfig?: RyderCupGameConfig | null
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

  if (skinsConfig) {
    await createSkinsGame(newRound.id, skinsConfig);
  }

  if (ryderCupConfig) {
    // Matches were built in the wizard against wizard-local player
    // ids — remap through the same idMap used for groups above so
    // they point at the real DB player rows.
    const remapped: RyderCupGameConfig = {
      ...ryderCupConfig,
      matches: ryderCupConfig.matches.map(m => ({
        ...m,
        teamAPlayerIds: m.teamAPlayerIds.map(lid => idMap.get(lid) ?? lid),
        teamBPlayerIds: m.teamBPlayerIds.map(lid => idMap.get(lid) ?? lid),
      })),
    };
    await createRyderCupGame(newRound.id, remapped);
  }

  return newRound.id;
}
