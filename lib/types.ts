// Shared types across the app — mirrors supabase/schema.sql

export type HoleScore = {
  groupId: string;
  playerId: string | null;
  teamId?: string | null; // set for scramble/alt-shot team-recorded holes
  holeNumber: number;
  strokes: number;
  // Only ever set when the round has track_stats on (see rounds.
  // track_stats) — null otherwise, and fairwayHit stays null on par-3
  // holes even when tracking is on. See lib/scoring.ts
  // calculateRoundStats.
  fairwayHit?: boolean | null;
  gir?: boolean | null;
  putts?: number | null;
};

export type Hole = {
  number: number;
  par: number;
  strokeIndex: number;
};

export type Player = {
  id: string;
  name: string;
  handicapIndex: number;
};

export type GameType =
  | "skins"
  | "nassau"
  | "stableford"
  | "scramble"
  | "match_play"
  | "ryder_cup";

export type GolfFormat = "stroke_play" | "best_ball" | "scramble" | "alt_shot";
