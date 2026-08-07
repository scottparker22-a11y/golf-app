// ─────────────────────────────────────────────────────────────
// SCORING ENGINE
// Every game type reads from the same hole_scores rows + a
// game-specific config blob. Pure functions — no Supabase calls
// in here, so this is easy to unit test in isolation.
// ─────────────────────────────────────────────────────────────

import type { HoleScore, Hole, Player } from "./types";

// ── Shared utility: handicap strokes ───────────────────────────
export function strokesReceived(hole: Hole, courseHandicap: number): number {
  return hole.strokeIndex <= courseHandicap ? 1 : 0;
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

export function calculateSkins(
  scores: HoleScore[],
  players: Player[],
  holes: Hole[],
  config: SkinsConfig,
  courseHandicaps: Record<string, number>
) {
  let carriedSkins = 0;
  const results: { hole: number; winnerId: string | null; skinsWon: number }[] = [];

  for (const hole of holes) {
    const holeScores = scores.filter(s => s.holeNumber === hole.number && s.playerId);
    const scored = holeScores.map(s => {
      const val = config.usesHandicap
        ? netScore(s.strokes, hole, courseHandicaps[s.playerId!] ?? 0)
        : s.strokes;
      return { playerId: s.playerId!, val };
    });

    if (scored.length === 0) {
      results.push({ hole: hole.number, winnerId: null, skinsWon: 0 });
      continue;
    }

    const min = Math.min(...scored.map(s => s.val));
    const winners = scored.filter(s => s.val === min);

    if (winners.length === 1) {
      const skinsWon = 1 + carriedSkins;
      results.push({ hole: hole.number, winnerId: winners[0].playerId, skinsWon });
      carriedSkins = 0;
    } else {
      results.push({ hole: hole.number, winnerId: null, skinsWon: 0 });
      if (config.carryover) carriedSkins += 1;
    }
  }
  return results;
}

/** Convenience: total skins won per player, for badges on the leaderboard. */
export function skinsWonByPlayer(skinsResults: ReturnType<typeof calculateSkins>) {
  const totals: Record<string, number> = {};
  for (const r of skinsResults) {
    if (!r.winnerId) continue;
    totals[r.winnerId] = (totals[r.winnerId] ?? 0) + r.skinsWon;
  }
  return totals;
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

// ── Individual gross leaderboard (works under any team game) ────
// Scramble/alt-shot holes are excluded since only a team score
// exists for those — see excludedHoleCount for the UI disclaimer.
export function calculateIndividualLeaderboard(scores: HoleScore[], players: Player[], holes: Hole[]) {
  return players.map(player => {
    const individualScores = scores.filter(s => s.playerId === player.id && !s.teamId);
    const total = individualScores.reduce((sum, s) => sum + s.strokes, 0);
    const parForHoles = individualScores.reduce((sum, s) => {
      const hole = holes.find(h => h.number === s.holeNumber);
      return sum + (hole?.par ?? 0);
    }, 0);
    return {
      playerId: player.id,
      name: player.name,
      holesPlayed: individualScores.length,
      relativeToPar: total - parForHoles,
    };
  }).sort((a, b) => a.relativeToPar - b.relativeToPar);
}
