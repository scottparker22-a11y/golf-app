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
import type { GolfFormat, Hole, HoleScore, Player } from "./types";
import {
  approxCourseHandicap,
  calculateRyderCupMatch,
  calculateRyderCupTeamScore,
  type RyderCupGameConfig,
  type RyderCupMatchResult,
  type RyderCupTeamScore,
  type SkinsGameConfig,
} from "./scoring";

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

/**
 * Which players (by id) played the trip's most recently created round —
 * lets the Setup Wizard offer "use last round's players" so a new round
 * with the same group doesn't mean re-picking everyone from the roster
 * one at a time (see components/setup/PlayersStep.tsx). Groups/lineup
 * are deliberately not reused here — FoursomesStep.tsx's own
 * auto-fill/move-between-groups already covers "same players, new
 * groups". Empty if the trip has no rounds yet.
 */
export async function fetchLastRoundPlayerIds(tripId: string): Promise<string[]> {
  const { data: lastRound, error: roundErr } = await supabase
    .from("rounds")
    .select("id")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (roundErr) throw new Error(`Couldn't check the last round: ${roundErr.message}`);
  if (!lastRound) return [];

  const { data: groups, error: groupsErr } = await supabase
    .from("groups")
    .select("group_players(player_id)")
    .eq("round_id", lastRound.id);
  if (groupsErr) throw new Error(`Couldn't load the last round's players: ${groupsErr.message}`);

  const ids = new Set<string>();
  for (const g of groups ?? []) {
    for (const gp of (g.group_players ?? []) as { player_id: string }[]) {
      ids.add(gp.player_id);
    }
  }
  return [...ids];
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
  courseName: string | null;
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
    .select("id, date, status, courses(name)")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Couldn't load rounds: ${error.message}`);
  return (data ?? []).map(r => ({
    id: r.id,
    date: r.date,
    status: r.status as RoundStatus,
    courseName: (r.courses as unknown as { name: string } | null)?.name ?? null,
  }));
}

/**
 * Just status + track_stats + tournament_id for one round — used by
 * TripNav to decide whether the Stats tab should render at all (only
 * once track_stats is on for the round AND it's actually completed —
 * see components/TripNav.tsx and lib/scoring.ts calculateRoundStats)
 * and whether the Tournament tab should (only when this round opted
 * into a multi-round Tournament — see components/setup/FormatStep.tsx).
 */
export async function fetchRoundStatus(
  roundId: string
): Promise<{ status: RoundStatus; trackStats: boolean; tournamentId: string | null }> {
  const { data, error } = await supabase
    .from("rounds")
    .select("status, track_stats, tournament_id")
    .eq("id", roundId)
    .single();
  if (error) throw new Error(`Couldn't load the round: ${error.message}`);
  return {
    status: data.status as RoundStatus,
    trackStats: data.track_stats ?? false,
    tournamentId: data.tournament_id ?? null,
  };
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

/**
 * Creates a round's Ryder Cup game after the fact — for a round that
 * was set up as Ryder Cup but never actually got any matches built
 * (see components/RyderCupSetupPanel.tsx), so it never got a `games`
 * row (createRyderCupGame during setup skips the insert entirely when
 * matches is empty) and never showed up as a Leaderboard view.
 * `tournamentId` links it to the trip's active Ryder Cup if there is
 * one, same as during normal setup. Admin-only — insert into `games`
 * always is. Fails if the round already has a Ryder Cup game; use
 * updateRyderCupGame to edit that one instead.
 */
export async function createRyderCupGameForRound(
  roundId: string,
  config: RyderCupGameConfig,
  tournamentId?: string | null
): Promise<string> {
  const res = await fetch(`/api/admin/round/${roundId}/ryder-cup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config, tournamentId }),
  });
  await throwOnError(res, "Couldn't create the Ryder Cup game");
  const { gameId } = await res.json();
  return gameId;
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
  // Format + pairings picked in components/setup/FoursomesStep.tsx —
  // saved as groups.format/stroke_play_teams and each group_players
  // row's `pairing`. Drives the 2-man team scoring in
  // lib/scoring.ts calculateTwoManTeamStandings (Best Ball, and
  // Stroke Play when strokePlayTeams === "pairs"); Scramble/Alt Shot
  // formats are stored but not yet computed anywhere (see
  // FoursomesStep.tsx's TEAM_FORMATS comment).
  format: GolfFormat;
  strokePlayTeams: "none" | "pairs";
  // Wizard-local player id -> "1" | "2", mirroring FoursomesStep's
  // Group.pairings.
  pairings: Record<string, "1" | "2">;
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
export type CreateRoundResult = {
  roundId: string;
  /**
   * Wizard-local player id -> real DB player id, for every player in
   * this round — lets a caller that built something keyed by
   * wizard-local ids before the round existed (see SetupWizard.tsx's
   * teamAssignment) translate to real ids afterward. See
   * lib/admin/roundAdmin.ts's matching CreateRoundResult type.
   */
  idMap: Record<string, string>;
};

export async function createRoundWithRoster(
  tripId: string,
  courseId: string,
  players: RosterPlayer[],
  groups: RosterGroup[],
  skinsConfig?: SkinsGameConfig | null,
  ryderCupConfig?: RyderCupGameConfig | null,
  trackStats?: boolean,
  tournamentId?: string | null,
  ryderCupTournamentId?: string | null
): Promise<CreateRoundResult> {
  const res = await fetch("/api/admin/round", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tripId,
      courseId,
      players,
      groups,
      skinsConfig,
      ryderCupConfig,
      trackStats,
      tournamentId,
      ryderCupTournamentId,
    }),
  });
  await throwOnError(res, "Couldn't finish setup");
  return res.json();
}

// ── Multi-round Tournament + trip-wide Ryder Cup ─────────────────
// A Tournament (Stroke Play across several rounds) and a Ryder Cup
// (match play across several rounds) can each be active on a trip at
// once, independently of one another — a round can opt into either,
// both, or neither (see components/setup/FormatStep.tsx). Both of the
// "active" fetches below just grab the trip's most recent row in
// their table — a trip only ever runs one of each at a time in this
// app, so "most recent" and "the active one" are the same thing.

export type ActiveTournament = {
  id: string;
  totalRounds: number;
  usesHandicap: boolean;
  /** How many rounds have already opted into it — informational only, never a cap. */
  roundsPlayed: number;
  /**
   * The course planned for each round, set once up front on the
   * Format step when the tournament was created (see
   * components/setup/FormatStep.tsx's "Course order" section) —
   * index i is round i+1's course id, or null if that slot was never
   * decided. Always at least as long as roundsPlayed+1 so
   * `courseOrder[roundsPlayed]` (this round's slot) is always a valid
   * index, even on a tournament created before this existed.
   */
  courseOrder: (string | null)[];
};

/** The trip's in-progress multi-round Tournament, if any — null if none has been started. */
export async function fetchActiveTournament(tripId: string): Promise<ActiveTournament | null> {
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, total_rounds, uses_handicap, course_order")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Couldn't check for an active tournament: ${error.message}`);
  if (!data) return null;

  const { count, error: countErr } = await supabase
    .from("rounds")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", data.id);
  if (countErr) throw new Error(`Couldn't check the tournament's rounds: ${countErr.message}`);

  const roundsPlayed = count ?? 0;
  const courseOrder = [...((data.course_order as (string | null)[] | null) ?? [])];
  while (courseOrder.length <= roundsPlayed) courseOrder.push(null);

  return {
    id: data.id,
    totalRounds: data.total_rounds,
    usesHandicap: data.uses_handicap,
    roundsPlayed,
    courseOrder,
  };
}

export type RyderCupTeamAssignment = Record<string, "A" | "B">;

export type ActiveRyderCupTournament = {
  id: string;
  teamAName: string;
  teamBName: string;
  totalRounds: number;
  /** How many rounds have already set up a Ryder Cup game linked to it. */
  roundsPlayed: number;
  /**
   * Who's on Team A vs Team B — set once when the Cup is created
   * (round 1's split) and carried over so the same players stay on
   * the same side every round instead of being re-split each time.
   * See components/setup/TeamsStep.tsx (locked once this is
   * non-empty) and updateRyderCupTournamentTeams below (for merging
   * in a player who wasn't around for the original split).
   */
  teamAssignment: RyderCupTeamAssignment;
  /**
   * The course planned for each round, set once up front when the Cup
   * was created (see components/setup/FormatStep.tsx's "Course order"
   * section) — same shape/behavior as ActiveTournament.courseOrder.
   */
  courseOrder: (string | null)[];
};

/** The trip's in-progress multi-round Ryder Cup, if any — null if none has been started. */
export async function fetchActiveRyderCupTournament(tripId: string): Promise<ActiveRyderCupTournament | null> {
  const { data, error } = await supabase
    .from("ryder_cup_tournaments")
    .select("id, team_a_name, team_b_name, total_rounds, team_assignment, course_order")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Couldn't check for an active Ryder Cup: ${error.message}`);
  if (!data) return null;

  const { count, error: countErr } = await supabase
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", data.id)
    .eq("type", "ryder_cup");
  if (countErr) throw new Error(`Couldn't check the Ryder Cup's rounds: ${countErr.message}`);

  const roundsPlayed = count ?? 0;
  const courseOrder = [...((data.course_order as (string | null)[] | null) ?? [])];
  while (courseOrder.length <= roundsPlayed) courseOrder.push(null);

  return {
    id: data.id,
    teamAName: data.team_a_name,
    teamBName: data.team_b_name,
    totalRounds: data.total_rounds,
    roundsPlayed,
    teamAssignment: (data.team_assignment as RyderCupTeamAssignment | null) ?? {},
    courseOrder,
  };
}

/**
 * Creates the trip-wide Tournament row. `courseOrder` is the course
 * planned for each round, picked up front on the Format step (index i
 * = round i+1's course id, or null for "not decided yet") — entirely
 * optional, rounds can still pick their own course one at a time as
 * usual if left empty. Admin-only. Returns the new tournament id.
 */
export async function createTournament(
  tripId: string,
  totalRounds: number,
  usesHandicap: boolean,
  courseOrder?: (string | null)[]
): Promise<string> {
  const res = await fetch("/api/admin/tournament", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tripId, totalRounds, usesHandicap, courseOrder }),
  });
  await throwOnError(res, "Couldn't create the tournament");
  const { id } = await res.json();
  return id;
}

/**
 * Permanently deletes a Tournament wrapper for the whole trip — see
 * components/setup/FormatStep.tsx's "Delete this Tournament" button.
 * Any rounds that had joined it are untouched; they just stop
 * counting toward it (their tournament_id gets cleared server-side).
 * Admin-only.
 */
export async function deleteTournament(tournamentId: string): Promise<void> {
  const res = await fetch(`/api/admin/tournament/${tournamentId}`, { method: "DELETE" });
  await throwOnError(res, "Couldn't delete the tournament");
}

/**
 * Creates the trip-wide Ryder Cup row. `teamAssignment` is round 1's
 * team split (playerId -> "A" | "B") — saved so every later round
 * that joins this Cup starts locked to the same teams instead of
 * re-splitting the roster (see components/setup/TeamsStep.tsx).
 * `courseOrder` is the course planned for each round, same idea as
 * createTournament's — optional, rounds can still pick their own
 * course one at a time if left empty. Admin-only. Returns the new
 * tournament id.
 */
export async function createRyderCupTournament(
  tripId: string,
  teamAName: string,
  teamBName: string,
  totalRounds: number,
  teamAssignment?: RyderCupTeamAssignment,
  courseOrder?: (string | null)[]
): Promise<string> {
  const res = await fetch("/api/admin/ryder-cup-tournament", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tripId, teamAName, teamBName, totalRounds, teamAssignment, courseOrder }),
  });
  await throwOnError(res, "Couldn't create the Ryder Cup");
  const { id } = await res.json();
  return id;
}

/**
 * Merges newly-assigned players into an existing Ryder Cup's saved
 * team split — used when a round joining the Cup has a player who
 * wasn't around for the original split (see
 * components/setup/TeamsStep.tsx's "Unassigned" section). Only ever
 * adds/updates entries, never removes existing ones, so earlier
 * rounds' locked-in teams are untouched. Admin-only.
 */
export async function updateRyderCupTournamentTeams(
  tournamentId: string,
  teamAssignment: RyderCupTeamAssignment
): Promise<void> {
  const res = await fetch(`/api/admin/ryder-cup-tournament/${tournamentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamAssignment }),
  });
  await throwOnError(res, "Couldn't update the Ryder Cup's teams");
}

/**
 * Permanently deletes a Ryder Cup wrapper for the whole trip — see
 * components/setup/FormatStep.tsx's "Delete this Ryder Cup" button.
 * Any rounds/games that had joined it are untouched; they just stop
 * counting toward its cross-round Cup score. Admin-only.
 */
export async function deleteRyderCupTournament(tournamentId: string): Promise<void> {
  const res = await fetch(`/api/admin/ryder-cup-tournament/${tournamentId}`, { method: "DELETE" });
  await throwOnError(res, "Couldn't delete the Ryder Cup");
}

/** One round's holes + player-keyed hole_scores — the minimal read a cross-round aggregate needs. */
async function fetchRoundHolesAndScoresForCup(roundId: string): Promise<{ holes: Hole[]; scores: HoleScore[] }> {
  const { data: round, error: roundErr } = await supabase
    .from("rounds")
    .select("course_id, tee_name")
    .eq("id", roundId)
    .single();
  if (roundErr || !round) throw new Error(roundErr?.message ?? "Round not found");

  const [holesRes, groupsRes] = await Promise.all([
    supabase
      .from("holes")
      .select("number, par, stroke_index")
      .eq("course_id", round.course_id)
      .eq("tee_name", round.tee_name)
      .order("number"),
    supabase.from("groups").select("id").eq("round_id", roundId),
  ]);
  if (holesRes.error) throw new Error(`Couldn't load holes: ${holesRes.error.message}`);
  if (groupsRes.error) throw new Error(`Couldn't load groups: ${groupsRes.error.message}`);

  const holes: Hole[] = (holesRes.data ?? []).map(h => ({
    number: h.number,
    par: h.par,
    strokeIndex: h.stroke_index,
  }));

  const groupIds = (groupsRes.data ?? []).map(g => g.id);
  if (groupIds.length === 0) return { holes, scores: [] };

  const { data: scoresData, error: scoresErr } = await supabase
    .from("hole_scores")
    .select("group_id, player_id, hole_number, strokes")
    .in("group_id", groupIds);
  if (scoresErr) throw new Error(`Couldn't load scores: ${scoresErr.message}`);

  const scores: HoleScore[] = (scoresData ?? []).map(r => ({
    groupId: r.group_id,
    playerId: r.player_id,
    holeNumber: r.hole_number,
    strokes: r.strokes,
  }));

  return { holes, scores };
}

export type RyderCupTripScore = {
  teamAName: string;
  teamBName: string;
  teamScore: RyderCupTeamScore;
};

/**
 * The trip's overall Ryder Cup score — near the top of Leaderboard.tsx
 * and TournamentLeaderboard.tsx (see components/RyderCupScoreBanner.tsx),
 * since it's the number people care about most on a multi-day Cup.
 * Aggregates every match across every round linked to the trip's
 * active multi-round Ryder Cup, if one exists; otherwise falls back
 * to whatever single-round Ryder Cup game is on the trip's current
 * round; otherwise null (no Ryder Cup being played at all).
 */
export async function fetchRyderCupTeamScoreForTrip(tripId: string): Promise<RyderCupTripScore | null> {
  const activeCup = await fetchActiveRyderCupTournament(tripId);

  if (activeCup) {
    const { data: games, error } = await supabase
      .from("games")
      .select("round_id, config")
      .eq("tournament_id", activeCup.id)
      .eq("type", "ryder_cup");
    if (error) throw new Error(`Couldn't load the Ryder Cup's matches: ${error.message}`);

    if (games && games.length > 0) {
      const roster = await fetchTripRoster(tripId);
      const courseHandicaps: Record<string, number> = {};
      for (const p of roster) courseHandicaps[p.id] = approxCourseHandicap(p.handicapIndex);

      const allResults: RyderCupMatchResult[] = [];
      for (const g of games as { round_id: string; config: RyderCupGameConfig }[]) {
        const { holes, scores } = await fetchRoundHolesAndScoresForCup(g.round_id);
        for (const match of g.config.matches) {
          allResults.push(calculateRyderCupMatch(scores, holes, match, courseHandicaps, g.config.defaultPointValue));
        }
      }
      if (allResults.length > 0) {
        return {
          teamAName: activeCup.teamAName,
          teamBName: activeCup.teamBName,
          teamScore: calculateRyderCupTeamScore(allResults),
        };
      }
    }
  }

  // Fall back to a plain single-round Ryder Cup on the trip's current round.
  const currentRoundId = await fetchCurrentRoundId(tripId);
  if (!currentRoundId) return null;
  const game = await fetchRyderCupGame(currentRoundId);
  if (!game || game.config.matches.length === 0) return null;

  const { holes, scores } = await fetchRoundHolesAndScoresForCup(currentRoundId);
  const roster = await fetchTripRoster(tripId);
  const courseHandicaps: Record<string, number> = {};
  for (const p of roster) courseHandicaps[p.id] = approxCourseHandicap(p.handicapIndex);

  const results = game.config.matches.map(m =>
    calculateRyderCupMatch(scores, holes, m, courseHandicaps, game.config.defaultPointValue)
  );
  return {
    teamAName: game.config.teamAName,
    teamBName: game.config.teamBName,
    teamScore: calculateRyderCupTeamScore(results),
  };
}
