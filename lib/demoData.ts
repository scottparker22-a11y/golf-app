// Demo data so the leaderboard renders something real without a
// live Supabase connection yet. Swap the fetch in
// app/trip/[tripId]/leaderboard/page.tsx for real queries once
// your schema is deployed — the shapes here match hole_scores /
// players / holes exactly, so the scoring functions don't change.

import type { Hole, HoleScore, Player } from "./types";

export const demoHoles: Hole[] = [
  // Front 9 — odd stroke indexes (standard convention)
  { number: 1, par: 4, strokeIndex: 7 },
  { number: 2, par: 3, strokeIndex: 15 },
  { number: 3, par: 5, strokeIndex: 3 },
  { number: 4, par: 4, strokeIndex: 11 },
  { number: 5, par: 4, strokeIndex: 1 },
  { number: 6, par: 3, strokeIndex: 17 },
  { number: 7, par: 4, strokeIndex: 9 },
  { number: 8, par: 5, strokeIndex: 5 },
  { number: 9, par: 4, strokeIndex: 13 },
  // Back 9 — even stroke indexes
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

export const demoPlayers: Player[] = [
  { id: "mike", name: "Mike Reyes", handicapIndex: 8.4 },
  { id: "tom", name: "Tom Wagner", handicapIndex: 12.1 },
  { id: "scott", name: "Scott Parker", handicapIndex: 10.6 },
  { id: "will", name: "Will Robinson", handicapIndex: 14.2 },
  { id: "dave", name: "Dave Chen", handicapIndex: 6.9 },
  { id: "jake", name: "Jake Pruitt", handicapIndex: 7.8 },
];

// team id -> [playerIds] for the team leaderboard pairing
export const demoTeams: Record<string, { name: string; playerIds: string[] }> = {
  "team-1": { name: "Mike & Tom", playerIds: ["mike", "tom"] },
  "team-2": { name: "Scott & Will", playerIds: ["scott", "will"] },
  "team-3": { name: "Dave & Jake", playerIds: ["dave", "jake"] },
};

const strokesByPlayer: Record<string, number[]> = {
  // front 9                     back 9
  mike:  [4, 4, 5, 4, 4, 3, 5, 5, 4,  4, 4, 6, 4, 5, 3, 4, 6, 4],
  tom:   [5, 3, 4, 4, 5, 3, 4, 6, 4,  5, 3, 5, 5, 4, 4, 5, 6, 5],
  scott: [4, 4, 4, 4, 3, 3, 4, 5, 4,  4, 4, 5, 4, 4, 3, 4, 6, 4],
  will:  [5, 4, 6, 5, 4, 4, 5, 6, 5,  5, 5, 7, 5, 5, 4, 6, 7, 5],
  dave:  [4, 3, 5, 3, 4, 3, 4, 4, 4,  4, 3, 5, 4, 4, 3, 4, 5, 4],
  jake:  [4, 3, 4, 4, 4, 2, 4, 5, 4,  4, 3, 5, 4, 4, 2, 4, 6, 4],
};

export const demoHoleScores: HoleScore[] = Object.entries(strokesByPlayer).flatMap(
  ([playerId, strokes]) =>
    strokes.map((s, i) => ({
      groupId: Object.entries(demoTeams).find(([, t]) => t.playerIds.includes(playerId))![0],
      playerId,
      holeNumber: i + 1,
      strokes: s,
    }))
);
