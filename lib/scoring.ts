// ─────────────────────────────────────────────────────────────
// SCORING ENGINE
// Every game type reads from the same hole_scores rows + a
// game-specific config blob. Pure functions — no Supabase calls
// in here, so this is easy to unit test in isolation.
// ─────────────────────────────────────────────────────────────

import type { GolfFormat, HoleScore, Hole, Player } from "./types";

// Shared with components/setup/FoursomesStep.tsx, which is the only
// place these get picked — kept here (rather than duplicated) so
// setup and scoring can never drift on what "uses pairing" means.
// Best Ball and Scramble/Alt Shot always play as 2-man teams within a
// foursome; Stroke Play only does if strokePlayTeams was explicitly
// set to "pairs".
export const TEAM_FORMATS: GolfFormat[] = ["best_ball", "scramble", "alt_shot"];

export function usesPairing(group: { format: GolfFormat; strokePlayTeams: "none" | "pairs" }): boolean {
  return TEAM_FORMATS.includes(group.format) || (group.format === "stroke_play" && group.strokePlayTeams === "pairs");
}

// ── Shared utility: handicap strokes ───────────────────────────
// Handles course handicaps above 18: every hole gets its normal
// stroke (if strokeIndex <= handicap), and holes with a low enough
// stroke index get a second stroke once the handicap exceeds 18.
export function strokesReceived(hole: Hole, courseHandicap: number): number {
  let strokes = hole.strokeIndex <= courseHandicap ? 1 : 0;
  if (courseHandicap > 18 && courseHandicap - 18 >= hole.strokeIndex) {
    strokes += 1;
  }
  return strokes;
}

/**
 * Simple course handicap approximation (rounded handicap index) for use
 * where a full slope/rating calculation hasn't been wired up yet. Swap
 * this out once course tee data (slope + rating) is available per round.
 */
export function approxCourseHandicap(handicapIndex: number): number {
  return Math.round(handicapIndex);
}

export function netScore(strokes: number, hole: Hole, courseHandicap: number): number {
  return strokes - strokesReceived(hole, courseHandicap);
}

// ── SKINS ───────────────────────────────────────────────────────
export type SkinsConfig = {
  usesHandicap: boolean;
  carryover: boolean;
};

// "pending" — not every player has posted a score for this hole yet,
// so it can't be judged (the lowest score so far would be misleading).
// "tied" — everyone's in, two+ players tied for lowest; skin is
// halved (lost) or carried to the next hole depending on `carryover`.
// "won" — a single player had the outright lowest score.
export type SkinsHoleStatus = "pending" | "won" | "tied";

export type SkinsHoleResult = {
  hole: number;
  status: SkinsHoleStatus;
  winnerId: string | null;
  /** 1 plus any carried-over skins from prior ties — only nonzero when status === "won". */
  skinsWon: number;
  /** How many skins are riding on this hole right now (1 + carry-in) — meaningful for every status, so the live board can show a dollar value even on pending/tied holes. */
  skinsAtStake: number;
};

export function calculateSkins(
  scores: HoleScore[],
  players: Player[],
  holes: Hole[],
  config: SkinsConfig,
  courseHandicaps: Record<string, number>
): SkinsHoleResult[] {
  let carriedSkins = 0;
  const results: SkinsHoleResult[] = [];

  for (const hole of holes) {
    const skinsAtStake = 1 + carriedSkins;
    const holeScores = scores.filter(s => s.holeNumber === hole.number && s.playerId);
    const scored = holeScores.map(s => {
      const val = config.usesHandicap
        ? netScore(s.strokes, hole, courseHandicaps[s.playerId!] ?? 0)
        : s.strokes;
      return { playerId: s.playerId!, val };
    });

    // Only judge a hole once every player in the round has posted a
    // score for it — otherwise "lowest score so far" doesn't mean
    // the hole is actually decided.
    if (players.length === 0 || scored.length < players.length) {
      results.push({ hole: hole.number, status: "pending", winnerId: null, skinsWon: 0, skinsAtStake });
      continue;
    }

    const min = Math.min(...scored.map(s => s.val));
    const winners = scored.filter(s => s.val === min);

    if (winners.length === 1) {
      results.push({
        hole: hole.number,
        status: "won",
        winnerId: winners[0].playerId,
        skinsWon: skinsAtStake,
        skinsAtStake,
      });
      carriedSkins = 0;
    } else {
      results.push({ hole: hole.number, status: "tied", winnerId: null, skinsWon: 0, skinsAtStake });
      if (config.carryover) carriedSkins += 1;
    }
  }
  return results;
}

/** Convenience: total skins won per player, for badges on the leaderboard. */
export function skinsWonByPlayer(skinsResults: SkinsHoleResult[]) {
  const totals: Record<string, number> = {};
  for (const r of skinsResults) {
    if (!r.winnerId) continue;
    totals[r.winnerId] = (totals[r.winnerId] ?? 0) + r.skinsWon;
  }
  return totals;
}

// ── SKINS PAYOUT — pricing, pot, and per-player cash ────────────
// Model A: a fixed dollar amount per skin — the pot floats with how
// many skins actually get won.
// Model B: a fixed pot (players × buy-in) split evenly across every
// skin won, so the per-skin value isn't known until skins are
// counted — and if literally zero skins were won, everyone gets
// refunded rather than dividing by zero.
export type SkinsPricing =
  | { model: "per_skin"; amountPerSkin: number }
  | { model: "flat_buyin"; buyInPerPlayer: number };

export type SkinsGameConfig = {
  gross: boolean;
  net: boolean;
  rollover: boolean;
  pricing: SkinsPricing;
};

export type SkinsPlayerPayout = {
  playerId: string;
  name: string;
  grossSkins: number;
  netSkins: number;
  totalSkins: number;
  cash: number;
};

export type SkinsPayoutSummary = {
  grossResults: SkinsHoleResult[];
  netResults: SkinsHoleResult[];
  totalSkinsAwarded: number;
  pot: number;
  /** Dollars per skin — fixed under Model A, computed (and provisional until the round finishes) under Model B. */
  perSkinValue: number;
  /** Model B only: zero skins were won across the whole round, so refund every player's buy-in instead of dividing by zero. */
  refundAll: boolean;
  players: SkinsPlayerPayout[];
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateSkinsPayout(
  scores: HoleScore[],
  players: Player[],
  holes: Hole[],
  config: SkinsGameConfig,
  courseHandicaps: Record<string, number>
): SkinsPayoutSummary {
  const grossResults = config.gross
    ? calculateSkins(scores, players, holes, { usesHandicap: false, carryover: config.rollover }, courseHandicaps)
    : [];
  const netResults = config.net
    ? calculateSkins(scores, players, holes, { usesHandicap: true, carryover: config.rollover }, courseHandicaps)
    : [];

  const grossByPlayer = skinsWonByPlayer(grossResults);
  const netByPlayer = skinsWonByPlayer(netResults);

  const totalGrossSkins = Object.values(grossByPlayer).reduce((sum, n) => sum + n, 0);
  const totalNetSkins = Object.values(netByPlayer).reduce((sum, n) => sum + n, 0);
  // A player can win both the gross and net skin on the same hole —
  // these two tracks run independently and their totals just add.
  const totalSkinsAwarded = totalGrossSkins + totalNetSkins;

  let pot: number;
  let perSkinValue: number;
  let refundAll = false;

  if (config.pricing.model === "per_skin") {
    perSkinValue = config.pricing.amountPerSkin;
    pot = round2(totalSkinsAwarded * perSkinValue);
  } else {
    pot = round2(config.pricing.buyInPerPlayer * players.length);
    if (totalSkinsAwarded === 0) {
      refundAll = true;
      perSkinValue = 0;
    } else {
      perSkinValue = pot / totalSkinsAwarded;
    }
  }

  const playerPayouts: SkinsPlayerPayout[] = players
    .map(p => {
      const grossSkins = grossByPlayer[p.id] ?? 0;
      const netSkins = netByPlayer[p.id] ?? 0;
      const totalSkins = grossSkins + netSkins;
      const cash = refundAll ? 0 : round2(totalSkins * perSkinValue);
      return { playerId: p.id, name: p.name, grossSkins, netSkins, totalSkins, cash };
    })
    .sort((a, b) => b.cash - a.cash || b.totalSkins - a.totalSkins);

  return {
    grossResults,
    netResults,
    totalSkinsAwarded,
    pot,
    perSkinValue: round2(perSkinValue),
    refundAll,
    players: playerPayouts,
  };
}

// ── STABLEFORD ──────────────────────────────────────────────────
export type StablefordConfig = {
  usesHandicap: boolean;
  pointsTable?: Record<number, number>;
};

const DEFAULT_STABLEFORD_POINTS: Record<number, number> = {
  [-3]: 8, [-2]: 5, [-1]: 3, 0: 2, 1: 1, 2: 0,
};

export function calculateStableford(
  scores: HoleScore[],
  players: Player[],
  holes: Hole[],
  config: StablefordConfig,
  courseHandicaps: Record<string, number>
) {
  const table = config.pointsTable ?? DEFAULT_STABLEFORD_POINTS;
  const totals: Record<string, number> = {};

  for (const player of players) {
    totals[player.id] = 0;
    for (const hole of holes) {
      const s = scores.find(sc => sc.playerId === player.id && sc.holeNumber === hole.number);
      if (!s) continue;
      const strokes = config.usesHandicap
        ? netScore(s.strokes, hole, courseHandicaps[player.id] ?? 0)
        : s.strokes;
      const relToPar = strokes - hole.par;
      totals[player.id] += table[relToPar] ?? 0;
    }
  }
  return totals;
}

// ── MATCH PLAY (1v1 or team of individuals) ─────────────────────
export type MatchPlayConfig = {
  usesHandicap: boolean;
  sideA: string[];
  sideB: string[];
};

export function calculateMatchPlay(
  scores: HoleScore[],
  holes: Hole[],
  config: MatchPlayConfig,
  courseHandicaps: Record<string, number>
) {
  let status = 0;
  const holeResults: { hole: number; result: "A" | "B" | "halved" }[] = [];

  for (const hole of holes) {
    const bestOf = (ids: string[]) =>
      Math.min(...ids.map(id => {
        const s = scores.find(sc => sc.playerId === id && sc.holeNumber === hole.number);
        if (!s) return Infinity;
        return config.usesHandicap
          ? netScore(s.strokes, hole, courseHandicaps[id] ?? 0)
          : s.strokes;
      }));

    const aScore = bestOf(config.sideA);
    const bScore = bestOf(config.sideB);

    if (aScore < bScore) { status += 1; holeResults.push({ hole: hole.number, result: "A" }); }
    else if (bScore < aScore) { status -= 1; holeResults.push({ hole: hole.number, result: "B" }); }
    else { holeResults.push({ hole: hole.number, result: "halved" }); }
  }
  return { finalStatus: status, holeResults };
}

// ── NASSAU (front 9 / back 9 / overall) ──────────────────────────
export function calculateNassau(
  scores: HoleScore[],
  holes: Hole[],
  config: MatchPlayConfig,
  courseHandicaps: Record<string, number>
) {
  const front = holes.filter(h => h.number <= 9);
  const back = holes.filter(h => h.number > 9);
  return {
    front9: calculateMatchPlay(scores, front, config, courseHandicaps),
    back9: calculateMatchPlay(scores, back, config, courseHandicaps),
    overall: calculateMatchPlay(scores, holes, config, courseHandicaps),
  };
}

// ── SCRAMBLE / team-recorded totals ──────────────────────────────
export function calculateScramble(scores: HoleScore[], holes: Hole[]) {
  const totals: Record<string, number> = {};
  for (const hole of holes) {
    const holeScores = scores.filter(s => s.holeNumber === hole.number && s.teamId);
    for (const s of holeScores) {
      totals[s.teamId!] = (totals[s.teamId!] ?? 0) + s.strokes;
    }
  }
  return totals;
}

function teamScoreMatchPlay(scores: HoleScore[], holes: Hole[], sideATeamId: string, sideBTeamId: string) {
  let status = 0;
  const holeResults: { hole: number; result: "A" | "B" | "halved" }[] = [];

  for (const hole of holes) {
    const aScore = scores.find(s => s.teamId === sideATeamId && s.holeNumber === hole.number)?.strokes ?? Infinity;
    const bScore = scores.find(s => s.teamId === sideBTeamId && s.holeNumber === hole.number)?.strokes ?? Infinity;

    if (aScore < bScore) { status += 1; holeResults.push({ hole: hole.number, result: "A" }); }
    else if (bScore < aScore) { status -= 1; holeResults.push({ hole: hole.number, result: "B" }); }
    else { holeResults.push({ hole: hole.number, result: "halved" }); }
  }
  return { finalStatus: status, holeResults };
}

// ── RYDER CUP ─────────────────────────────────────────────────
export type RyderCupSession = {
  format: "stroke_play" | "best_ball" | "scramble" | "alt_shot";
  roundNumber: number;
  sideA: string[];
  sideB: string[];
  sideATeamId?: string;
  sideBTeamId?: string;
};

export type RyderCupConfig = {
  teamAName: string;
  teamBName: string;
  totalRounds: number;
  sessions: RyderCupSession[];
};

export function calculateRyderCup(scores: HoleScore[], holes: Hole[], config: RyderCupConfig) {
  let pointsA = 0;
  let pointsB = 0;

  const sessionResults = config.sessions.map(session => {
    const result =
      session.format === "scramble" || session.format === "alt_shot"
        ? teamScoreMatchPlay(scores, holes, session.sideATeamId!, session.sideBTeamId!)
        : calculateMatchPlay(scores, holes, { usesHandicap: false, sideA: session.sideA, sideB: session.sideB }, {});

    if (result.finalStatus > 0) pointsA += 1;
    else if (result.finalStatus < 0) pointsB += 1;
    else { pointsA += 0.5; pointsB += 0.5; }

    return { format: session.format, roundNumber: session.roundNumber, ...result };
  });

  const roundsCompleted = new Set(config.sessions.map(s => s.roundNumber)).size;
  const estSessionsPerRound = config.sessions.length / Math.max(roundsCompleted, 1);
  const estTotalSessions = estSessionsPerRound * config.totalRounds;
  const maxRemainingPoints = estTotalSessions - (pointsA + pointsB);
  const isDecided = pointsA > pointsB + maxRemainingPoints || pointsB > pointsA + maxRemainingPoints;

  return {
    teamAName: config.teamAName,
    teamBName: config.teamBName,
    pointsA,
    pointsB,
    roundsCompleted,
    totalRounds: config.totalRounds,
    isDecided,
    sessionResults,
  };
}

// ── RYDER CUP MATCH PLAY (round-scoped) ──────────────────────────
// A second, independent read of the same hole_scores individual
// strokes already entered on the Scorecard — there is no separate
// Ryder Cup score entry, and nothing here is precomputed/stored.
// (Unrelated to RyderCupConfig/calculateRyderCup above, which is a
// still-unused stub predating both this and the real multi-round
// Tournament concept below — see calculateTournamentLeaderboard.)
export type RyderCupMatchFormat = "singles" | "four_ball";
export type RyderCupScoringBasis = "gross" | "net";

// Set by the organizer to lock in a result without touching any
// golfer's actual scores — see calculateRyderCupMatch's override
// handling. A concession is just "team X wins" with a note attached.
export type RyderCupOverride = {
  result: "team_a" | "team_b" | "halved";
  note?: string;
};

export type RyderCupMatchConfig = {
  id: string;
  matchNumber: number;
  format: RyderCupMatchFormat;
  scoringBasis: RyderCupScoringBasis;
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  teeTime?: string | null;
  pointValue?: number | null; // falls back to the game's defaultPointValue
  override?: RyderCupOverride | null;
};

export type RyderCupGameConfig = {
  teamAName: string;
  teamBName: string;
  defaultPointValue: number;
  matches: RyderCupMatchConfig[];
};

export type RyderCupHoleResult = { hole: number; result: "A" | "B" | "halved" | "pending" };

export type RyderCupMatchResult = {
  matchId: string;
  holeResults: RyderCupHoleResult[];
  holesPlayed: number;
  totalHoles: number;
  margin: number; // running, positive = team A leading
  status: "not_started" | "live" | "dormie" | "final";
  leaderSide: "A" | "B" | null;
  winnerSide: "A" | "B" | "halved" | null;
  closedEarly: boolean; // final before every hole was needed
  finalMargin: number; // |margin| at the moment the match was decided
  finalRemaining: number; // holes left at that point (0 if it went the distance)
  pointValue: number;
  pointsA: number;
  pointsB: number;
  isOverridden: boolean;
  overrideNote?: string;
};

// A hole only counts once every player in the match has posted a
// score for it — same completeness gating Skins uses, so live match
// status never jumps ahead of what's actually been entered.
function ryderCupHoleValue(
  scores: HoleScore[],
  hole: Hole,
  playerId: string,
  scoringBasis: RyderCupScoringBasis,
  courseHandicaps: Record<string, number>
): number | null {
  const s = scores.find(sc => sc.playerId === playerId && sc.holeNumber === hole.number);
  if (!s) return null;
  return scoringBasis === "net" ? netScore(s.strokes, hole, courseHandicaps[playerId] ?? 0) : s.strokes;
}

/**
 * One match's live result. Singles is just the four-ball case with
 * one player per side — the "best of your side" comparison collapses
 * to that one player's own score.
 */
export function calculateRyderCupMatch(
  scores: HoleScore[],
  holes: Hole[],
  match: RyderCupMatchConfig,
  courseHandicaps: Record<string, number>,
  defaultPointValue: number
): RyderCupMatchResult {
  const pointValue = match.pointValue ?? defaultPointValue;
  const sortedHoles = [...holes].sort((a, b) => a.number - b.number);
  const totalHoles = sortedHoles.length;

  const holeResults: RyderCupHoleResult[] = [];
  let margin = 0;
  let holesPlayed = 0;
  let closedAtHole: number | null = null;
  let closedMargin = 0;
  let closedRemaining = 0;

  for (const hole of sortedHoles) {
    if (closedAtHole !== null) {
      holeResults.push({ hole: hole.number, result: "pending" });
      continue;
    }

    const aValues = match.teamAPlayerIds.map(id =>
      ryderCupHoleValue(scores, hole, id, match.scoringBasis, courseHandicaps)
    );
    const bValues = match.teamBPlayerIds.map(id =>
      ryderCupHoleValue(scores, hole, id, match.scoringBasis, courseHandicaps)
    );
    if (aValues.some(v => v === null) || bValues.some(v => v === null)) {
      holeResults.push({ hole: hole.number, result: "pending" });
      continue;
    }

    const aScore = Math.min(...(aValues as number[]));
    const bScore = Math.min(...(bValues as number[]));
    let result: "A" | "B" | "halved";
    if (aScore < bScore) { margin += 1; result = "A"; }
    else if (bScore < aScore) { margin -= 1; result = "B"; }
    else { result = "halved"; }

    holeResults.push({ hole: hole.number, result });
    holesPlayed += 1;

    // Traditional match play ends the moment the trailing side can no
    // longer catch up, even with holes still on the card.
    const remaining = totalHoles - hole.number;
    if (Math.abs(margin) > remaining) {
      closedAtHole = hole.number;
      closedMargin = Math.abs(margin);
      closedRemaining = remaining;
    }
  }

  const remainingAfterPlayed = totalHoles - holesPlayed;
  const isDormie =
    closedAtHole === null && holesPlayed > 0 && remainingAfterPlayed > 0 && Math.abs(margin) === remainingAfterPlayed;
  const wentTheDistance = closedAtHole === null && holesPlayed === totalHoles && totalHoles > 0;

  let status: RyderCupMatchResult["status"] = "not_started";
  if (closedAtHole !== null || wentTheDistance) status = "final";
  else if (isDormie) status = "dormie";
  else if (holesPlayed > 0) status = "live";

  let winnerSide: RyderCupMatchResult["winnerSide"] = null;
  let pointsA = 0;
  let pointsB = 0;
  const finalMargin = closedAtHole !== null ? closedMargin : Math.abs(margin);
  const finalRemaining = closedAtHole !== null ? closedRemaining : 0;
  let isOverridden = false;

  if (match.override) {
    isOverridden = true;
    status = "final";
    if (match.override.result === "team_a") { winnerSide = "A"; pointsA = pointValue; }
    else if (match.override.result === "team_b") { winnerSide = "B"; pointsB = pointValue; }
    else { winnerSide = "halved"; pointsA = pointValue / 2; pointsB = pointValue / 2; }
  } else if (status === "final") {
    if (margin > 0) { winnerSide = "A"; pointsA = pointValue; }
    else if (margin < 0) { winnerSide = "B"; pointsB = pointValue; }
    else { winnerSide = "halved"; pointsA = pointValue / 2; pointsB = pointValue / 2; }
  }

  const leaderSide = margin > 0 ? "A" : margin < 0 ? "B" : null;

  return {
    matchId: match.id,
    holeResults,
    holesPlayed,
    totalHoles,
    margin,
    status,
    leaderSide,
    winnerSide,
    closedEarly: closedAtHole !== null,
    finalMargin,
    finalRemaining,
    pointValue,
    pointsA,
    pointsB,
    isOverridden,
    overrideNote: match.override?.note,
  };
}

export function formatRyderCupMatchStatus(result: RyderCupMatchResult, teamAName: string, teamBName: string): string {
  if (result.status === "not_started") return "Not started";

  if (result.status === "final") {
    if (result.winnerSide === "halved") return "Final: Halved";
    const name = result.winnerSide === "A" ? teamAName : teamBName;
    if (result.isOverridden) return `Final: ${name} wins (override)`;
    return result.closedEarly
      ? `Final: ${name} wins ${result.finalMargin} & ${result.finalRemaining}`
      : `Final: ${name} ${result.finalMargin} UP`;
  }

  const marginAbs = Math.abs(result.margin);
  const leaderName = result.leaderSide === "A" ? teamAName : result.leaderSide === "B" ? teamBName : null;
  const base = marginAbs === 0 ? "All Square" : `${leaderName} ${marginAbs} UP`;
  return result.status === "dormie" ? `${base} (Dormie)` : base;
}

export type RyderCupTeamScore = {
  pointsA: number;
  pointsB: number;
  totalPoints: number;
  pointsRemaining: number;
  neededToWinA: number;
  neededToWinB: number;
  clinchedSide: "A" | "B" | "tied" | null;
};

/**
 * Overall Cup score — summed straight from each match's own points,
 * never derived from individual leaderboard position (a golfer can
 * top the Gross leaderboard and still lose their match). The winning
 * threshold is computed off however many points this round's matches
 * are actually worth, never a hard-coded 14.5-style constant.
 */
export function calculateRyderCupTeamScore(matchResults: RyderCupMatchResult[]): RyderCupTeamScore {
  let pointsA = 0;
  let pointsB = 0;
  let totalPoints = 0;
  for (const m of matchResults) {
    totalPoints += m.pointValue;
    pointsA += m.pointsA;
    pointsB += m.pointsB;
  }
  const pointsAwarded = pointsA + pointsB;
  const pointsRemaining = Math.max(0, totalPoints - pointsAwarded);
  const winThreshold = totalPoints / 2 + 0.5;
  const neededToWinA = Math.max(0, winThreshold - pointsA);
  const neededToWinB = Math.max(0, winThreshold - pointsB);

  let clinchedSide: RyderCupTeamScore["clinchedSide"] = null;
  if (pointsA > pointsB + pointsRemaining) clinchedSide = "A";
  else if (pointsB > pointsA + pointsRemaining) clinchedSide = "B";
  else if (pointsRemaining === 0 && totalPoints > 0) clinchedSide = pointsA === pointsB ? "tied" : pointsA > pointsB ? "A" : "B";

  return { pointsA, pointsB, totalPoints, pointsRemaining, neededToWinA, neededToWinB, clinchedSide };
}

// ── Individual gross + net leaderboard (works under any team game) ──
// Scramble/alt-shot holes are excluded since only a team score
// exists for those — see excludedHoleCount for the UI disclaimer.
// courseHandicaps is optional — pass it (see approxCourseHandicap) to
// get netRelativeToPar too; without it net just equals gross.
export function calculateIndividualLeaderboard(
  scores: HoleScore[],
  players: Player[],
  holes: Hole[],
  courseHandicaps: Record<string, number> = {}
) {
  return players.map(player => {
    const individualScores = scores.filter(s => s.playerId === player.id && !s.teamId);
    const courseHandicap = courseHandicaps[player.id] ?? 0;
    let grossTotal = 0;
    let netTotal = 0;
    let parForHoles = 0;
    for (const s of individualScores) {
      const hole = holes.find(h => h.number === s.holeNumber);
      grossTotal += s.strokes;
      netTotal += hole ? s.strokes - strokesReceived(hole, courseHandicap) : s.strokes;
      parForHoles += hole?.par ?? 0;
    }
    return {
      playerId: player.id,
      name: player.name,
      holesPlayed: individualScores.length,
      relativeToPar: grossTotal - parForHoles,
      netRelativeToPar: netTotal - parForHoles,
    };
  }).sort((a, b) => a.relativeToPar - b.relativeToPar);
}

// ── TOURNAMENT LEADERBOARD (cross-round) ─────────────────────────
// Same individually-recorded-scores convention as
// calculateIndividualLeaderboard (team/scramble holes excluded), just
// summed across every round the tournament has played so far instead
// of one round's holes. A player who hasn't posted anything in a
// given round gets `strokes: null` for it (shows as "—" rather than
// 0) and is left out of the ranking entirely until they've played at
// least one round — otherwise an untouched trip would show everyone
// tied at even par in position 1.
export type TournamentRoundInput = {
  roundId: string;
  holes: Hole[];
  scores: HoleScore[];
};

export type TournamentPlayerRound = {
  roundId: string;
  strokes: number | null;
};

export type TournamentStanding = {
  playerId: string;
  name: string;
  relativeToPar: number;
  totalStrokes: number;
  roundsPlayed: number;
  rounds: TournamentPlayerRound[];
  position: number; // 1-based, no gaps
  positionLabel: string; // "1", "2", "T3", "T3", "T5"... — PGA-style, ties skip ahead
};

export function calculateTournamentLeaderboard(
  roundsData: TournamentRoundInput[],
  players: Player[],
  courseHandicaps: Record<string, number> = {},
  usesHandicap = false
): TournamentStanding[] {
  const totals = players.map(player => {
    const courseHandicap = courseHandicaps[player.id] ?? 0;
    let totalStrokes = 0;
    let totalPar = 0;
    let roundsPlayed = 0;

    const rounds: TournamentPlayerRound[] = roundsData.map(rd => {
      const individualScores = rd.scores.filter(s => s.playerId === player.id && !s.teamId);
      if (individualScores.length === 0) return { roundId: rd.roundId, strokes: null };

      let strokes = 0;
      let par = 0;
      for (const s of individualScores) {
        const hole = rd.holes.find(h => h.number === s.holeNumber);
        strokes += usesHandicap && hole ? s.strokes - strokesReceived(hole, courseHandicap) : s.strokes;
        par += hole?.par ?? 0;
      }
      totalStrokes += strokes;
      totalPar += par;
      roundsPlayed += 1;
      return { roundId: rd.roundId, strokes };
    });

    return {
      playerId: player.id,
      name: player.name,
      relativeToPar: totalStrokes - totalPar,
      totalStrokes,
      roundsPlayed,
      rounds,
    };
  });

  const sorted = totals
    .filter(p => p.roundsPlayed > 0)
    .sort((a, b) => a.relativeToPar - b.relativeToPar);

  return sorted.map((p, i) => {
    const position = i + 1;
    // Tied with the row directly above/below → same label as whoever
    // is first in this tied block ("T3" for every player tied at 3rd).
    const tied =
      (i > 0 && sorted[i - 1].relativeToPar === p.relativeToPar) ||
      (i < sorted.length - 1 && sorted[i + 1].relativeToPar === p.relativeToPar);
    let firstTiedIndex = i;
    while (firstTiedIndex > 0 && sorted[firstTiedIndex - 1].relativeToPar === p.relativeToPar) firstTiedIndex--;
    return {
      ...p,
      position,
      positionLabel: tied ? `T${firstTiedIndex + 1}` : String(position),
    };
  });
}

// ── ROUND STATS (Fairways Hit, GIR, Putts) — optional per round ──
// Set via rounds.track_stats (see components/setup/RoundsStep.tsx)
// and entered per hole on the Scorecard when it's on; this just rolls
// up whatever's been recorded on hole_scores — no separate table.
// Fairways/GIR percentages use fixed denominators (eligible-hole
// count / total holes in the round), not "holes recorded so far" —
// a partial round still shows real progress against the full round,
// same as a "8 of 14 fairways" read partway through. Putts/hole is a
// true average over holes that actually have a putts value; treating
// unrecorded holes as 0 putts would skew it.
export type PlayerRoundStats = {
  playerId: string;
  name: string;
  fairwaysHit: number;
  fairwaysEligible: number; // non-par-3 holes in the round
  fairwayPct: number; // 0-100
  girHit: number;
  girEligible: number; // holes.length — "X of 18" per a standard round
  girPct: number;
  totalPutts: number;
  puttsHolesRecorded: number;
  puttsPerHole: number;
};

export function calculateRoundStats(
  scores: HoleScore[],
  players: Player[],
  holes: Hole[]
): PlayerRoundStats[] {
  const fairwaysEligible = holes.filter(h => h.par !== 3).length;
  const girEligible = holes.length;

  return players.map(player => {
    const individualScores = scores.filter(s => s.playerId === player.id && !s.teamId);

    const fairwaysHit = individualScores.filter(s => s.fairwayHit === true).length;
    const girHit = individualScores.filter(s => s.gir === true).length;

    const puttsEntries = individualScores
      .map(s => s.putts)
      .filter((p): p is number => p !== null && p !== undefined);
    const totalPutts = puttsEntries.reduce((sum, p) => sum + p, 0);
    const puttsHolesRecorded = puttsEntries.length;

    return {
      playerId: player.id,
      name: player.name,
      fairwaysHit,
      fairwaysEligible,
      fairwayPct: fairwaysEligible > 0 ? Math.round((fairwaysHit / fairwaysEligible) * 100) : 0,
      girHit,
      girEligible,
      girPct: girEligible > 0 ? Math.round((girHit / girEligible) * 100) : 0,
      totalPutts,
      puttsHolesRecorded,
      puttsPerHole: puttsHolesRecorded > 0 ? totalPutts / puttsHolesRecorded : 0,
    };
  });
}

// ── TWO-MAN TEAMS (Best Ball, or Stroke Play opted into pairs) ──
// Independent of Ryder Cup's separate, round-wide Team A/B concept —
// this is per-foursome, from components/setup/FoursomesStep.tsx's
// format + pairings. Groups that don't usesPairing() (plain Stroke
// Play, or Scramble/Alt Shot — those need one shared score per team
// per hole, which the Scorecard doesn't support entering yet) are
// skipped entirely; the caller keeps treating them as one
// whole-foursome unit.
export type TwoManTeamGroupInput = {
  id: string;
  format: GolfFormat;
  strokePlayTeams: "none" | "pairs";
  playerIds: string[];
  pairings: Record<string, "1" | "2">;
};

export type TwoManTeamStanding = {
  teamKey: string; // `${groupId}:${pairing}`
  groupId: string;
  pairing: "1" | "2";
  playerIds: string[];
  name: string;
  relativeToPar: number;
  netRelativeToPar: number;
  holesPlayed: number;
  // Per-hole computed score, keyed by hole number — only present for
  // holes where a value could actually be computed (Best Ball needs
  // both partners posted; Stroke Play sums whichever have). Used by
  // the Scorecard's Teams toggle.
  grossByHole: Record<number, number>;
  netByHole: Record<number, number>;
};

export function calculateTwoManTeamStandings(
  scores: HoleScore[],
  players: Player[],
  holes: Hole[],
  groups: TwoManTeamGroupInput[],
  courseHandicaps: Record<string, number>
): TwoManTeamStanding[] {
  const standings: TwoManTeamStanding[] = [];

  for (const group of groups) {
    if (!usesPairing(group)) continue;
    const isBestBall = group.format === "best_ball";

    for (const pairing of ["1", "2"] as const) {
      const pairPlayerIds = group.playerIds.filter(id => group.pairings[id] === pairing);
      if (pairPlayerIds.length === 0) continue;

      const name =
        pairPlayerIds
          .map(id => players.find(p => p.id === id)?.name)
          .filter((n): n is string => !!n)
          .join(" & ") || "Team";

      let grossTotal = 0;
      let netTotal = 0;
      let parForHoles = 0;
      let holesPlayed = 0;
      const grossByHole: Record<number, number> = {};
      const netByHole: Record<number, number> = {};

      for (const hole of holes) {
        const entries = pairPlayerIds.map(id => {
          const s = scores.find(sc => sc.playerId === id && sc.holeNumber === hole.number);
          if (!s) return null;
          return { gross: s.strokes, net: s.strokes - strokesReceived(hole, courseHandicaps[id] ?? 0) };
        });

        if (isBestBall) {
          // Only count a hole once every partner in the pair has
          // posted — same completeness gating Skins/Ryder Cup use, so
          // the running total never implies a hole is decided before
          // both scores are actually in.
          if (entries.some(e => e === null)) continue;
          const vals = entries as { gross: number; net: number }[];
          const gross = Math.min(...vals.map(v => v.gross));
          const net = Math.min(...vals.map(v => v.net));
          grossTotal += gross;
          netTotal += net;
          parForHoles += hole.par;
          holesPlayed += 1;
          grossByHole[hole.number] = gross;
          netByHole[hole.number] = net;
        } else {
          // Stroke Play + pairs: sum whichever partners have posted —
          // same math as summing the pair's individual relativeToPar
          // values (calculateIndividualLeaderboard), just computed
          // per hole so the Scorecard can show it too.
          const posted = entries.filter((e): e is { gross: number; net: number } => e !== null);
          if (posted.length === 0) continue;
          const gross = posted.reduce((sum, e) => sum + e.gross, 0);
          const net = posted.reduce((sum, e) => sum + e.net, 0);
          grossTotal += gross;
          netTotal += net;
          parForHoles += hole.par * posted.length;
          holesPlayed += 1;
          grossByHole[hole.number] = gross;
          netByHole[hole.number] = net;
        }
      }

      standings.push({
        teamKey: `${group.id}:${pairing}`,
        groupId: group.id,
        pairing,
        playerIds: pairPlayerIds,
        name,
        relativeToPar: grossTotal - parForHoles,
        netRelativeToPar: netTotal - parForHoles,
        holesPlayed,
        grossByHole,
        netByHole,
      });
    }
  }

  return standings.sort((a, b) => a.relativeToPar - b.relativeToPar);
}

// ── TWO-MAN MATCH PLAY (Scorecard's Teams mode) ──────────────────
// Same pairing data as calculateTwoManTeamStandings above, but the
// Scorecard wants head-to-head match play instead of a running
// stroke total: each hole, whichever pair's best ball (gross) is
// lower wins the hole; the Scorecard highlights whoever's individual
// score won it and shows a running Up/Down/Square status, same idea
// as the "We/They +/-" row on a paper scorecard. Gross only — this
// app's Scorecard doesn't have a net toggle anywhere else either.
export type TwoManMatchPlayHoleResult = {
  hole: number;
  decided: boolean; // false = at least one side hasn't posted both scores yet
  winner: "1" | "2" | "halved" | null; // null when not decided
  winningPlayerIds: string[]; // whose score(s) actually won it, for highlighting — empty if halved/not decided
  margin: number | null; // cumulative, positive = pairing "1" up, negative = pairing "2" up; null when not decided
};

export type TwoManMatchPlayResult = {
  groupId: string;
  pairing1: { playerIds: string[]; name: string };
  pairing2: { playerIds: string[]; name: string };
  holeResults: TwoManMatchPlayHoleResult[];
};

function pairingName(playerIds: string[], players: Player[]): string {
  return (
    playerIds
      .map(id => players.find(p => p.id === id)?.name)
      .filter((n): n is string => !!n)
      .join(" & ") || "Team"
  );
}

export function calculateTwoManMatchPlay(
  scores: HoleScore[],
  players: Player[],
  holes: Hole[],
  group: { id: string; playerIds: string[]; pairings: Record<string, "1" | "2"> }
): TwoManMatchPlayResult {
  const side1 = group.playerIds.filter(id => group.pairings[id] === "1");
  const side2 = group.playerIds.filter(id => group.pairings[id] === "2");

  const holeResults: TwoManMatchPlayHoleResult[] = [];
  let margin = 0;

  for (const hole of [...holes].sort((a, b) => a.number - b.number)) {
    const scoreFor = (id: string) => scores.find(s => s.playerId === id && s.holeNumber === hole.number)?.strokes;

    const side1Scores = side1.map(id => ({ id, strokes: scoreFor(id) }));
    const side2Scores = side2.map(id => ({ id, strokes: scoreFor(id) }));
    const side1Complete = side1Scores.every(s => s.strokes !== undefined);
    const side2Complete = side2Scores.every(s => s.strokes !== undefined);

    if (!side1Complete || !side2Complete) {
      holeResults.push({ hole: hole.number, decided: false, winner: null, winningPlayerIds: [], margin: null });
      continue;
    }

    const side1Best = Math.min(...side1Scores.map(s => s.strokes as number));
    const side2Best = Math.min(...side2Scores.map(s => s.strokes as number));

    let winner: "1" | "2" | "halved";
    let winningPlayerIds: string[] = [];
    if (side1Best < side2Best) {
      winner = "1";
      winningPlayerIds = side1Scores.filter(s => s.strokes === side1Best).map(s => s.id);
      margin += 1;
    } else if (side2Best < side1Best) {
      winner = "2";
      winningPlayerIds = side2Scores.filter(s => s.strokes === side2Best).map(s => s.id);
      margin -= 1;
    } else {
      winner = "halved";
    }

    holeResults.push({ hole: hole.number, decided: true, winner, winningPlayerIds, margin });
  }

  return {
    groupId: group.id,
    pairing1: { playerIds: side1, name: pairingName(side1, players) },
    pairing2: { playerIds: side2, name: pairingName(side2, players) },
    holeResults,
  };
}

/** "E" / "+1" / "-2" — positive favors pairing 1, negative favors pairing 2. */
export function formatTwoManMargin(margin: number): string {
  if (margin === 0) return "E";
  return margin > 0 ? `+${margin}` : `${margin}`;
}
