// ─────────────────────────────────────────────────────────────
// SCORING ENGINE
// Every game type reads from the same hole_scores rows + a
// game-specific config blob. Pure functions — no Supabase calls
// in here, so this is easy to unit test in isolation.
// ─────────────────────────────────────────────────────────────

import type { HoleScore, Hole, Player } from "./types";

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
