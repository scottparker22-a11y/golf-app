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
//
// Reads below still go straight to Supabase with the anon key (RLS
// keeps those tables open-read). Writes to the admin-gated tables
// (players/groups/group_players/rounds/games/courses/holes) instead
// fetch() the app's own /api/admin/* routes, which check the admin
// PIN session cookie (lib/adminAuth.ts) and — only once that passes —
// write via the service-role client (lib/supabaseAdmin.ts, used from
// lib/admin/roundAdmin.ts). RLS no longer lets the anon key write to
// those tables at all, so this isn't optional plumbing; it's the only
// way these functions can still succeed. hole_scores is untouched —
// still a direct anon-client write, scoped to the group's
// scorekeeper (see lib/liveRound.ts).
// ─────────────────────────────────────────────────────────────

import { supabase } from "./supabase";
import type { Player } from "./types";
import type { SkinsGameConfig, RyderCupGameConfig } from "./scoring";

/** Parses a /api/admin/* JSON error response into a thrown Error. */
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

export const DEMO_TRIP_ID = "a0000000-0000-0000-0000-000000000001";
export const DEMO_ROUND_ID = "d0000000-0000-0000-0000-000000000001";
export const DEMO_COURSE_ID = "c0000000-0000-0000-0000-000000000001";
export const DEMO_TEE_NAME = "default";

// Standard par/stroke-index layout used for any course created through
// the app, since real course-data autofill isn't wired up yet (see
// lib/courseData.ts) — every new course gets a playable 18 holes
// immediately instead of an empty scorecard.
export const STANDARD_HOLES: { number: number; par: number; strokeIndex: number }[] = [
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
 * it's immediately playable. Returns the new course id. Admin-only —
 * see app/api/admin/courses/route.ts.
 */
export async function createCourse(name: string, location: string): Promise<string> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Give the course a name.");

  const res = await fetch("/api/admin/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: trimmedName, location: location.trim() || null }),
  });
  await throwOnError(res, "Couldn't add the course");
  const { id } = await res.json();
  return id;
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

// Postgres' foreign-key-violation code — used server-side (see
// app/api/admin/courses/[courseId]/route.ts and .../players/[playerId])
// to turn "can't delete, something still points at this row" into a
// friendly message instead of a raw database error.
export const FK_VIOLATION = "23503";

/**
 * Deletes a course from the queue. Blocked by the database (and
 * reported here as a friendly error) if any round has already used
 * it — deleting would corrupt that round's history. Admin-only.
 */
export async function deleteCourse(courseId: string): Promise<void> {
  const res = await fetch(`/api/admin/courses/${courseId}`, { method: "DELETE" });
  await throwOnError(res, "Couldn't delete the course");
}

/**
 * Deletes a player from the trip roster. Blocked by the database if
 * they've already recorded scores in a past round — deleting would
 * corrupt that round's history. Removing them from a foursome
 * they're only listed in (no scores yet) happens automatically.
 * Admin-only.
 */
export async function deletePlayer(playerId: string): Promise<void> {
  const res = await fetch(`/api/admin/players/${playerId}`, { method: "DELETE" });
  await throwOnError(res, "Couldn't delete the player");
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

/**
 * An admin's manual pin (see the bubble selector in Round History /
 * components/RoundsList.tsx) for which round the un-scoped
 * /leaderboard and /scorecard links should land on — takes priority
 * over fetchCurrentRoundId's automatic guess. Null if nothing's
 * pinned. Read is open (anon client); writing it goes through
 * setCurrentRoundSelection below, admin-only.
 */
export async function fetchCurrentRoundSelection(tripId: string): Promise<string | null> {
  const { data, error } = await supabase.from("trips").select("current_round_id").eq("id", tripId).maybeSingle();
  if (error) throw new Error(`Couldn't load the pinned round: ${error.message}`);
  return data?.current_round_id ?? null;
}

/**
 * Pins (or clears, passing null) which round is "the" live round for
 * the trip. Admin-only.
 */
export async function setCurrentRoundSelection(roundId: string | null): Promise<void> {
  const res = await fetch("/api/admin/current-round", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roundId }),
  });
  await throwOnError(res, "Couldn't update the live round");
}

/**
 * The trip's current "live" round. An admin's manual pin (see
 * fetchCurrentRoundSelection above) always wins if one's set —
 * otherwise falls back to the most recent in_progress round, else
 * most recent upcoming. A completed (or archived) round is never
 * picked automatically: once a round wraps up, the un-scoped
 * /leaderboard and /scorecard links shouldn't keep landing on it as
 * if it were still being played (an admin can still pin one manually
 * if they really want to). Returns null when there's nothing to
 * default to — callers should send the visitor to Round History
 * instead of guessing which past round they meant.
 */
export async function fetchCurrentRoundId(tripId: string): Promise<string | null> {
  const pinned = await fetchCurrentRoundSelection(tripId);
  if (pinned) return pinned;

  const rounds = (await fetchRounds(tripId)).filter(
    r => r.status !== "archived" && r.status !== "completed"
  );
  return rounds.find(r => r.status === "in_progress")?.id ?? rounds[0]?.id ?? null;
}

/**
 * Archives a round — hides it from the main History list without
 * deleting anything. Reversible via restoreRound. Admin-only.
 */
export async function archiveRound(roundId: string): Promise<void> {
  const res = await fetch(`/api/admin/round/${roundId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "archived" }),
  });
  await throwOnError(res, "Couldn't archive the round");
}

/** Un-archives a round, putting it back in History as completed. Admin-only. */
export async function restoreRound(roundId: string): Promise<void> {
  const res = await fetch(`/api/admin/round/${roundId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "completed" }),
  });
  await throwOnError(res, "Couldn't restore the round");
}

/**
 * Permanently deletes a round — for ones created by mistake or that
 * never actually happened. Unlike archiveRound, this can't be undone:
 * it cascades to the round's groups, group_players, hole_scores, and
 * games. Player and course rows themselves are untouched (they're
 * trip-scoped, not round-scoped). Admin-only.
 */
export async function deleteRound(roundId: string): Promise<void> {
  const res = await fetch(`/api/admin/round/${roundId}`, { method: "DELETE" });
  await throwOnError(res, "Couldn't delete the round");
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

/**
 * Updates a round's Ryder Cup config in place — used for manual match
 * overrides and mid-round pairing edits. Never touches hole_scores;
 * an override only ever changes what's stored here. Deliberately
 * NOT admin-gated — this is used live, mid-round, by whoever's
 * running the Ryder Cup board, not just the trip admin. Only game
 * *creation* (part of finishing the Setup Wizard) requires admin —
 * see createRoundWithRoster below.
 */
export async function updateRyderCupGame(gameId: string, config: RyderCupGameConfig): Promise<void> {
  const { error } = await supabase.from("games").update({ config }).eq("id", gameId);
  if (error) throw new Error(`Couldn't update the Ryder Cup game: ${error.message}`);
}

// Set when a roster entry is an existing trip player being reused —
// present means "use this id, don't insert a new row."
export type RosterPlayer = { localId: string; name: string; handicapIndex: number; existingId?: string };
export type RosterGroup = {
  name: string;
  localPlayerIds: string[];
  // Wizard-local player id of this group's chosen scorekeeper (see
  // components/setup/ScorekeeperStep.tsx), if one was picked —
  // resolved server-side to a DB id and saved as groups.scorer_player_id.
  scorekeeperLocalPlayerId?: string;
};

/**
 * Creates a brand-new round from the roster + foursomes built in the
 * Setup Wizard. Roster entries with an `existingId` (picked from the
 * trip's standing roster) are reused as-is rather than duplicated;
 * only genuinely new players get inserted. Any round still marked
 * in_progress for this trip is closed out first. Admin-only — the
 * actual DB work happens server-side in lib/admin/roundAdmin.ts, run
 * from app/api/admin/round/route.ts.
 */
export async function createRoundWithRoster(
  tripId: string,
  courseId: string,
  players: RosterPlayer[],
  groups: RosterGroup[],
  skinsConfig?: SkinsGameConfig | null,
  ryderCupConfig?: RyderCupGameConfig | null
): Promise<string> {
  const res = await fetch("/api/admin/round", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tripId, courseId, players, groups, skinsConfig, ryderCupConfig }),
  });
  await throwOnError(res, "Couldn't finish setup");
  const { roundId } = await res.json();
  return roundId;
}
