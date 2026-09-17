"use client";

import { useEffect, useMemo, useState } from "react";
import { DEMO_TRIP_ID, fetchActiveRyderCupTournament, fetchRyderCupGame, updateRyderCupGame } from "@/lib/rounds";
import type { Hole, HoleScore, Player } from "@/lib/types";
import {
  RYDER_CUP_MATCH_FORMAT_LABEL,
  RYDER_CUP_STABLEFORD_SESSION_LABEL,
  approxCourseHandicap,
  calculateIndividualLeaderboard,
  calculateRyderCupMatch,
  calculateRyderCupStablefordSession,
  formatRyderCupMatchStatus,
  type RyderCupGameConfig,
  type RyderCupMatchConfig,
  type RyderCupMatchResult,
  type RyderCupOverride,
  type RyderCupStablefordSessionResult,
} from "@/lib/scoring";

type Game = { gameId: string; config: RyderCupGameConfig };

function formatScore(n: number) {
  return n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`;
}

function rankLabel(sorted: { playerId: string; value: number }[], playerId: string): string {
  const entry = sorted.find(e => e.playerId === playerId);
  if (!entry) return "—";
  const place = sorted.findIndex(e => e.value === entry.value) + 1;
  const tied = sorted.filter(e => e.value === entry.value).length > 1;
  const suffix = place === 1 ? "st" : place === 2 ? "nd" : place === 3 ? "rd" : "th";
  return tied ? `T${place}` : `${place}${suffix}`;
}

// The Ryder Cup match-card view — embedded inside Leaderboard.tsx as
// its third view mode (Individual / Team / Ryder Cup) for a round
// that has a Ryder Cup game, rather than living on its own page. No
// team-score banner here: Leaderboard.tsx already shows one at the
// top of the page (trip-wide, via lib/rounds.ts
// fetchRyderCupTeamScoreForTrip) regardless of which view is active,
// so repeating a round-only score here would just be a second,
// less-complete number for the same thing.
//
// players/holes/holeScores come from the parent's own useLiveRound
// call rather than this component calling it a second time — two
// useLiveRound(roundId) instances for the same round both try to open
// a Supabase Realtime channel named `hole_scores:${roundId}`, and the
// second subscribe() collides with the first ("cannot add
// postgres_changes callbacks... after subscribe()"). Leaderboard.tsx
// already handles the loading/error states before rendering this.
export default function RyderCupBoard({
  roundId,
  players,
  holes,
  holeScores,
}: {
  roundId: string;
  players: Player[];
  holes: Hole[];
  holeScores: HoleScore[];
}) {
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [gameError, setGameError] = useState<string | null>(null);
  // Who's on Team A vs B, for the team Stableford session below — the
  // session has no per-match player picks of its own, it uses the
  // trip's whole Ryder Cup team split (see
  // components/setup/TeamsStep.tsx / ActiveRyderCupTournament).
  const [teamAssignment, setTeamAssignment] = useState<Record<string, "A" | "B">>({});

  useEffect(() => {
    let cancelled = false;
    fetchRyderCupGame(roundId)
      .then(g => {
        if (!cancelled) setGame(g);
      })
      .catch(e => setGameError(e instanceof Error ? e.message : "Couldn't load the Ryder Cup game"));
    // DEMO_TRIP_ID, not a tripId prop — the trip's real Ryder Cup team
    // split is keyed by the real trip UUID, never the cosmetic "demo"
    // URL slug (see lib/rounds.ts and the same fix in Leaderboard.tsx).
    fetchActiveRyderCupTournament(DEMO_TRIP_ID)
      .then(cup => {
        if (!cancelled) setTeamAssignment(cup?.teamAssignment ?? {});
      })
      .catch(() => {
        // Non-fatal — the team Stableford session just won't show.
      });
    return () => {
      cancelled = true;
    };
  }, [roundId]);

  const courseHandicaps = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of players) map[p.id] = approxCourseHandicap(p.handicapIndex);
    return map;
  }, [players]);

  const individual = useMemo(
    () => calculateIndividualLeaderboard(holeScores, players, holes, courseHandicaps),
    [holeScores, players, holes, courseHandicaps]
  );
  const grossRanked = useMemo(
    () =>
      [...individual]
        .sort((a, b) => a.relativeToPar - b.relativeToPar)
        .map(p => ({ playerId: p.playerId, value: p.relativeToPar })),
    [individual]
  );
  const netRanked = useMemo(
    () =>
      [...individual]
        .sort((a, b) => a.netRelativeToPar - b.netRelativeToPar)
        .map(p => ({ playerId: p.playerId, value: p.netRelativeToPar })),
    [individual]
  );

  const matchResults = useMemo<RyderCupMatchResult[]>(() => {
    if (!game) return [];
    return game.config.matches.map(m =>
      calculateRyderCupMatch(holeScores, holes, m, courseHandicaps, game.config.defaultPointValue)
    );
  }, [game, holeScores, holes, courseHandicaps]);

  const stablefordSessionResult = useMemo<RyderCupStablefordSessionResult | null>(() => {
    if (!game?.config.stablefordSession) return null;
    return calculateRyderCupStablefordSession(
      holeScores,
      holes,
      teamAssignment,
      players.map(p => p.id),
      game.config.stablefordSession,
      courseHandicaps
    );
  }, [game, holeScores, holes, teamAssignment, players, courseHandicaps]);

  const saveOverride = async (matchId: string, override: RyderCupOverride | null) => {
    if (!game) return;
    const nextConfig: RyderCupGameConfig = {
      ...game.config,
      matches: game.config.matches.map(m => (m.id === matchId ? { ...m, override } : m)),
    };
    setGame({ ...game, config: nextConfig });
    try {
      await updateRyderCupGame(game.gameId, nextConfig);
    } catch (e) {
      setGameError(e instanceof Error ? e.message : "Couldn't save the override");
    }
  };

  if (game === undefined) {
    return <div className="px-5 pt-8 text-sm text-chalk-dim">Loading Ryder Cup…</div>;
  }
  if (!game) {
    return (
      <div className="mx-5 mt-4 p-4 bg-surface border border-[color:var(--border)] rounded-xl text-[13px] text-chalk-dim leading-relaxed">
        Ryder Cup Style isn&apos;t set up for this round. Enable it and build matches from Trip Setup →
        Format.
      </div>
    );
  }

  const { teamAName, teamBName } = game.config;
  const playerName = (id: string) => players.find(p => p.id === id)?.name ?? "?";

  const withResults = game.config.matches.map((match, i) => ({ match, result: matchResults[i] }));
  const live = withResults.filter(x => x.result.status === "live" || x.result.status === "dormie");
  const completed = withResults.filter(x => x.result.status === "final");
  const upcoming = withResults.filter(x => x.result.status === "not_started");

  return (
    <div className="px-5 pt-4 pb-10">
      {gameError && (
        <div className="mb-4 p-3 bg-flag/10 border border-flag/30 rounded-xl text-[12.5px] text-flag">{gameError}</div>
      )}

      {stablefordSessionResult && (
        <Section title="Team Stableford">
          <TeamStablefordCard
            result={stablefordSessionResult}
            teamAName={teamAName}
            teamBName={teamBName}
            playerName={playerName}
            individual={individual}
          />
        </Section>
      )}

      {live.length > 0 && (
        <Section title="Live matches">
          {live.map(({ match, result }) => (
            <MatchCard
              key={match.id}
              match={match}
              result={result}
              teamAName={teamAName}
              teamBName={teamBName}
              playerName={playerName}
              individual={individual}
              grossRanked={grossRanked}
              netRanked={netRanked}
              onOverride={saveOverride}
            />
          ))}
        </Section>
      )}

      {completed.length > 0 && (
        <Section title="Completed matches">
          {completed.map(({ match, result }) => (
            <MatchCard
              key={match.id}
              match={match}
              result={result}
              teamAName={teamAName}
              teamBName={teamBName}
              playerName={playerName}
              individual={individual}
              grossRanked={grossRanked}
              netRanked={netRanked}
              onOverride={saveOverride}
            />
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Upcoming matches">
          {upcoming.map(({ match, result }) => (
            <MatchCard
              key={match.id}
              match={match}
              result={result}
              teamAName={teamAName}
              teamBName={teamBName}
              playerName={playerName}
              individual={individual}
              grossRanked={grossRanked}
              netRanked={netRanked}
              onOverride={saveOverride}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] font-bold uppercase tracking-wide text-chalk-dim mb-2 px-1">{title}</div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function MatchCard({
  match,
  result,
  teamAName,
  teamBName,
  playerName,
  individual,
  grossRanked,
  netRanked,
  onOverride,
}: {
  match: RyderCupMatchConfig;
  result: RyderCupMatchResult;
  teamAName: string;
  teamBName: string;
  playerName: (id: string) => string;
  individual: ReturnType<typeof calculateIndividualLeaderboard>;
  grossRanked: { playerId: string; value: number }[];
  netRanked: { playerId: string; value: number }[];
  onOverride: (matchId: string, override: RyderCupOverride | null) => void;
}) {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const statusText = formatRyderCupMatchStatus(result, teamAName, teamBName);
  const formatLabel = RYDER_CUP_MATCH_FORMAT_LABEL[match.format];

  return (
    <div className="bg-surface border border-[color:var(--border)] rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold text-chalk-dim">
          Match {match.matchNumber} — {formatLabel} · Scoring: {match.scoringBasis === "gross" ? "Gross" : "Net"}
        </div>
        {match.teeTime && result.status === "not_started" && (
          <div className="text-[11px] text-chalk-dim font-mono">{match.teeTime}</div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-2">
        <PlayerSide
          playerIds={match.teamAPlayerIds}
          playerName={playerName}
          individual={individual}
          grossRanked={grossRanked}
          netRanked={netRanked}
          expandedPlayerId={expandedPlayerId}
          setExpandedPlayerId={setExpandedPlayerId}
          statusText={statusText}
          align="left"
        />
        <div className="text-chalk-dim text-[11px] font-semibold">vs</div>
        <PlayerSide
          playerIds={match.teamBPlayerIds}
          playerName={playerName}
          individual={individual}
          grossRanked={grossRanked}
          netRanked={netRanked}
          expandedPlayerId={expandedPlayerId}
          setExpandedPlayerId={setExpandedPlayerId}
          statusText={statusText}
          align="right"
        />
      </div>

      <div
        className={`text-center text-[13px] font-bold py-1.5 rounded-lg ${
          result.status === "final"
            ? "bg-surface-raised text-chalk"
            : result.leaderSide === "A"
            ? "bg-turf/15 text-turf"
            : result.leaderSide === "B"
            ? "bg-flag/15 text-flag"
            : "bg-surface-raised text-chalk-dim"
        }`}
      >
        {statusText}
        {result.status !== "not_started" && result.status !== "final" && (
          <span className="text-chalk-dim font-medium"> · Thru {result.holesPlayed}</span>
        )}
      </div>

      {result.holesPlayed > 0 && <HoleStrip result={result} teamAName={teamAName} teamBName={teamBName} />}

      <div className="mt-2.5 flex items-center justify-between">
        {result.isOverridden ? (
          <div className="text-[11px] text-sand font-semibold">
            Manually overridden{result.overrideNote ? ` — ${result.overrideNote}` : ""}
          </div>
        ) : (
          <div />
        )}
        {!overrideOpen ? (
          <button
            onClick={() => setOverrideOpen(true)}
            className="text-[11px] font-bold text-chalk-dim underline"
          >
            {result.isOverridden ? "Change override" : "Override match"}
          </button>
        ) : null}
      </div>

      {overrideOpen && (
        <div className="mt-2 p-2.5 bg-surface-raised rounded-lg flex flex-col gap-1.5">
          <div className="text-[11px] text-chalk-dim mb-0.5">
            Sets the match result only — doesn&apos;t change any golfer&apos;s scores.
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                onOverride(match.id, { result: "team_a" });
                setOverrideOpen(false);
              }}
              className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-turf/15 text-turf"
            >
              {teamAName} wins
            </button>
            <button
              onClick={() => {
                onOverride(match.id, { result: "team_b" });
                setOverrideOpen(false);
              }}
              className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-flag/15 text-flag"
            >
              {teamBName} wins
            </button>
            <button
              onClick={() => {
                onOverride(match.id, { result: "halved" });
                setOverrideOpen(false);
              }}
              className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-surface text-chalk-dim border border-[color:var(--border)]"
            >
              Halved
            </button>
          </div>
          <div className="flex gap-1.5">
            {result.isOverridden && (
              <button
                onClick={() => {
                  onOverride(match.id, null);
                  setOverrideOpen(false);
                }}
                className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-surface text-chalk-dim border border-[color:var(--border)]"
              >
                Reset to automatic
              </button>
            )}
            <button
              onClick={() => setOverrideOpen(false)}
              className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-surface text-chalk-dim border border-[color:var(--border)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerSide({
  playerIds,
  playerName,
  individual,
  grossRanked,
  netRanked,
  expandedPlayerId,
  setExpandedPlayerId,
  statusText,
  align,
}: {
  playerIds: string[];
  playerName: (id: string) => string;
  individual: ReturnType<typeof calculateIndividualLeaderboard>;
  grossRanked: { playerId: string; value: number }[];
  netRanked: { playerId: string; value: number }[];
  expandedPlayerId: string | null;
  setExpandedPlayerId: (id: string | null) => void;
  statusText: string;
  align: "left" | "right";
}) {
  return (
    <div className={align === "left" ? "text-left" : "text-right"}>
      {playerIds.map(id => {
        const stats = individual.find(p => p.playerId === id);
        const expanded = expandedPlayerId === id;
        return (
          <div key={id}>
            <button
              onClick={() => setExpandedPlayerId(expanded ? null : id)}
              className="text-[13px] font-semibold block w-full truncate"
            >
              {playerName(id)}
            </button>
            {stats && (
              <div className="text-[10.5px] text-chalk-dim font-mono">
                G {formatScore(stats.relativeToPar)} · N {formatScore(stats.netRelativeToPar)}
              </div>
            )}
            {expanded && stats && (
              <div
                className={`mt-1 mb-1 p-2 bg-surface-raised rounded-lg text-[10.5px] leading-relaxed ${
                  align === "right" ? "text-right" : "text-left"
                }`}
              >
                <div>Gross: {formatScore(stats.relativeToPar)} (Rank {rankLabel(grossRanked, id)})</div>
                <div>Net: {formatScore(stats.netRelativeToPar)} (Rank {rankLabel(netRanked, id)})</div>
                <div className="text-chalk-dim mt-0.5">Match: {statusText}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HoleStrip({
  result,
  teamAName,
  teamBName,
}: {
  result: RyderCupMatchResult;
  teamAName: string;
  teamBName: string;
}) {
  const aInitial = teamAName.trim().charAt(0).toUpperCase() || "A";
  const bInitial = teamBName.trim().charAt(0).toUpperCase() || "B";
  return (
    <div className="flex gap-[3px] mt-2.5 overflow-x-auto pb-0.5">
      {result.holeResults.map(hr => (
        <div
          key={hr.hole}
          title={`Hole ${hr.hole}`}
          className={`w-[18px] h-[18px] flex-shrink-0 rounded-[4px] flex items-center justify-center text-[9px] font-bold ${
            hr.result === "A"
              ? "bg-turf/25 text-turf"
              : hr.result === "B"
              ? "bg-flag/25 text-flag"
              : hr.result === "halved"
              ? "bg-surface-raised text-chalk-dim"
              : "bg-surface border border-[color:var(--border)] text-transparent"
          }`}
        >
          {hr.result === "A" ? aInitial : hr.result === "B" ? bInitial : hr.result === "halved" ? "–" : ""}
        </div>
      ))}
    </div>
  );
}

// Team USA total points vs. Team Europe total points — the banner
// that actually decides the session (TeamStablefordPlayerList below
// is just the per-player breakdown behind those two numbers; the
// full hole-by-hole grid lives on the Scorecard page, not here — the
// Leaderboard just needs each player's progress and running total).
function TeamStablefordCard({
  result,
  teamAName,
  teamBName,
  playerName,
  individual,
}: {
  result: RyderCupStablefordSessionResult;
  teamAName: string;
  teamBName: string;
  playerName: (id: string) => string;
  individual: ReturnType<typeof calculateIndividualLeaderboard>;
}) {
  const leaderSide = result.totalA > result.totalB ? "A" : result.totalB > result.totalA ? "B" : null;

  const statusText =
    result.status === "not_started"
      ? "Not started"
      : result.status === "final"
      ? result.winnerSide === "halved"
        ? "Final: Halved"
        : `Final: ${result.winnerSide === "A" ? teamAName : teamBName} wins`
      : leaderSide
      ? `${leaderSide === "A" ? teamAName : teamBName} leads`
      : "All Square";

  return (
    <div className="bg-surface border border-[color:var(--border)] rounded-xl p-3.5">
      <div className="text-[11px] font-bold text-chalk-dim mb-2">
        {RYDER_CUP_STABLEFORD_SESSION_LABEL[result.format]} · {result.pointValue}{" "}
        {result.pointValue === 1 ? "point" : "points"} to the winning team
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-2">
        <div className="text-left">
          <div className="text-[13px] font-semibold truncate">{teamAName}</div>
          <div className="text-[10.5px] text-chalk-dim font-mono">{result.totalA} pts</div>
        </div>
        <div className="text-chalk-dim text-[11px] font-semibold">vs</div>
        <div className="text-right">
          <div className="text-[13px] font-semibold truncate">{teamBName}</div>
          <div className="text-[10.5px] text-chalk-dim font-mono">{result.totalB} pts</div>
        </div>
      </div>

      <div
        className={`text-center text-[13px] font-bold py-1.5 rounded-lg ${
          result.status === "final"
            ? "bg-surface-raised text-chalk"
            : leaderSide === "A"
            ? "bg-turf/15 text-turf"
            : leaderSide === "B"
            ? "bg-flag/15 text-flag"
            : "bg-surface-raised text-chalk-dim"
        }`}
      >
        {statusText}
      </div>

      <TeamStablefordPlayerList
        playersA={result.playersA}
        playersB={result.playersB}
        playerName={playerName}
        playerTotals={result.playerTotals}
        totalHoles={result.totalHoles}
        individual={individual}
        teamAName={teamAName}
        teamBName={teamBName}
      />
    </div>
  );
}

// Individual progress for the team Stableford session — ranked most
// points to least, regardless of side, like any other leaderboard.
// Just what hole each player is on and their running point total,
// not the full hole-by-hole grid (that lives on the Scorecard page,
// where strokes are actually entered). holesPlayed comes from the
// same calculateIndividualLeaderboard the rest of this board already
// computes, so "Thru N" here matches the "Thru N" match cards use.
// Players who haven't posted a score yet (total undefined) sort last.
function TeamStablefordPlayerList({
  playersA,
  playersB,
  playerName,
  playerTotals,
  totalHoles,
  individual,
  teamAName,
  teamBName,
}: {
  playersA: string[];
  playersB: string[];
  playerName: (id: string) => string;
  playerTotals: Record<string, number | undefined>;
  totalHoles: number;
  individual: ReturnType<typeof calculateIndividualLeaderboard>;
  teamAName: string;
  teamBName: string;
}) {
  const ranked = [
    ...playersA.map(id => ({ id, side: "A" as const })),
    ...playersB.map(id => ({ id, side: "B" as const })),
  ].sort((a, b) => {
    const at = playerTotals[a.id];
    const bt = playerTotals[b.id];
    if (at === undefined && bt === undefined) return 0;
    if (at === undefined) return 1;
    if (bt === undefined) return -1;
    return bt - at;
  });

  return (
    <div className="mt-2.5">
      {ranked.map(({ id, side }, i) => {
        const holesPlayed = individual.find(p => p.playerId === id)?.holesPlayed ?? 0;
        const thruLabel = holesPlayed === 0 ? "Not started" : holesPlayed >= totalHoles ? "F" : `Thru ${holesPlayed}`;
        const total = playerTotals[id];
        return (
          <div
            key={id}
            className="flex items-center gap-2.5 py-1.5 border-b border-[color:var(--border)] last:border-b-0"
          >
            <div className="w-5 flex-shrink-0 text-[11px] font-bold text-chalk-dim text-center">{i + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate">{playerName(id)}</div>
              <div className="text-[10.5px] text-chalk-dim">
                <span className={side === "A" ? "text-turf" : "text-flag"}>{side === "A" ? teamAName : teamBName}</span>
                {" · "}
                {thruLabel}
              </div>
            </div>
            <div className="flex-shrink-0 text-[15px] font-mono font-bold text-chalk">
              {total ?? "–"} <span className="text-[10.5px] font-sans font-semibold text-chalk-dim">pts</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
