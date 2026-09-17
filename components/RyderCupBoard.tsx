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
  ryderCupStablefordPoints,
  stablefordPointsColor,
  strokesReceived,
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
            holes={holes}
            holeScores={holeScores}
            courseHandicaps={courseHandicaps}
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
// that actually decides the session (TeamStablefordTable below is
// just the breakdown behind those two numbers).
function TeamStablefordCard({
  result,
  teamAName,
  teamBName,
  playerName,
  holes,
  holeScores,
  courseHandicaps,
}: {
  result: RyderCupStablefordSessionResult;
  teamAName: string;
  teamBName: string;
  playerName: (id: string) => string;
  holes: Hole[];
  holeScores: HoleScore[];
  courseHandicaps: Record<string, number>;
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

      <TeamStablefordTable
        playersA={result.playersA}
        playersB={result.playersB}
        playerName={playerName}
        isNet={result.format === "stableford_net"}
        holes={holes}
        holeScores={holeScores}
        courseHandicaps={courseHandicaps}
      />
    </div>
  );
}

// Hole-by-hole strokes + Stableford points for every player in the
// team Stableford session — one row per player (however many are on
// each side, per the trip's Ryder Cup team split), with a divider
// between Team A's players and Team B's. OUT/IN/TOT subtotals mirror
// components/Scorecard.tsx's stacked strokes-over-points convention.
// The grand totalA/totalB (the numbers that actually decide who wins
// the session) live in the banner above this table, not repeated as
// a row here — they're already computed once by
// calculateRyderCupStablefordSession, no need to sum them again.
function TeamStablefordTable({
  playersA,
  playersB,
  playerName,
  isNet,
  holes,
  holeScores,
  courseHandicaps,
}: {
  playersA: string[];
  playersB: string[];
  playerName: (id: string) => string;
  isNet: boolean;
  holes: Hole[];
  holeScores: HoleScore[];
  courseHandicaps: Record<string, number>;
}) {
  const frontHoles = holes.filter(h => h.number <= 9);
  const backHoles = holes.filter(h => h.number > 9);
  const hasBack = backHoles.length > 0;
  const sumPar = (hs: Hole[]) => hs.reduce((sum, h) => sum + h.par, 0);

  const strokesFor = (playerId: string, holeNumber: number) =>
    holeScores.find(s => s.playerId === playerId && s.holeNumber === holeNumber)?.strokes;

  const pointsFor = (playerId: string, h: Hole, courseHandicap: number) => {
    const strokes = strokesFor(playerId, h.number);
    return strokes === undefined ? undefined : ryderCupStablefordPoints(strokes, h.par, courseHandicap, h.strokeIndex, isNet);
  };

  const sumStrokes = (playerId: string, hs: Hole[]) => {
    const entered = hs.map(h => strokesFor(playerId, h.number)).filter((s): s is number => s !== undefined);
    return entered.length ? entered.reduce((sum, s) => sum + s, 0) : undefined;
  };

  const sumPoints = (playerId: string, hs: Hole[], courseHandicap: number) => {
    const entered = hs.map(h => pointsFor(playerId, h, courseHandicap)).filter((p): p is number => p !== undefined);
    return entered.length ? entered.reduce((sum, p) => sum + p, 0) : undefined;
  };

  const subtotalCellClass = "px-1.5 py-1 text-center bg-surface-raised border-l border-[color:var(--border-strong)]";
  const subtotalHeaderClass = subtotalCellClass + " text-chalk-dim font-semibold text-[10px] uppercase";

  const renderSubtotal = (playerId: string, hs: Hole[], courseHandicap: number) => (
    <td className={subtotalCellClass}>
      <div className="font-mono font-bold text-[13px] text-chalk">{sumStrokes(playerId, hs) ?? "–"}</div>
      <div className="font-mono text-[11px] font-bold leading-tight text-chalk-dim">
        {sumPoints(playerId, hs, courseHandicap) ?? "–"}
      </div>
    </td>
  );

  const renderHoleCell = (playerId: string, h: Hole, courseHandicap: number) => {
    const strokes = strokesFor(playerId, h.number);
    const points = pointsFor(playerId, h, courseHandicap);
    const getsStroke = isNet && strokesReceived(h, courseHandicap) > 0;
    return (
      <td key={h.number} className="relative text-center px-1 py-1">
        {getsStroke && <span className="absolute top-0 right-0.5 w-[5px] h-[5px] rounded-full bg-sand" />}
        <div className="font-mono font-bold text-[13px] text-chalk">{strokes ?? "–"}</div>
        <div className={`font-mono text-[11px] font-bold leading-tight ${points !== undefined ? stablefordPointsColor(points) : "text-chalk-dim"}`}>
          {points ?? ""}
        </div>
      </td>
    );
  };

  const renderPlayerRow = (playerId: string) => {
    const courseHandicap = courseHandicaps[playerId] ?? 0;
    return (
      <tr key={playerId}>
        <td className="sticky left-0 z-10 bg-surface pr-2 py-1 font-semibold text-[12px] whitespace-nowrap">
          {playerName(playerId)}
        </td>
        {frontHoles.map(h => renderHoleCell(playerId, h, courseHandicap))}
        {hasBack && renderSubtotal(playerId, frontHoles, courseHandicap)}
        {backHoles.map(h => renderHoleCell(playerId, h, courseHandicap))}
        {hasBack && renderSubtotal(playerId, backHoles, courseHandicap)}
        {renderSubtotal(playerId, holes, courseHandicap)}
      </tr>
    );
  };

  return (
    <div className="mt-2.5">
      <div className="overflow-x-auto -mx-3.5 px-3.5">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface text-left pr-2 py-1 text-chalk-dim font-semibold text-[10px] uppercase whitespace-nowrap">
                Hole
              </th>
              {frontHoles.map(h => (
                <th key={h.number} className="px-1 py-1 text-chalk-dim font-semibold text-center text-[11px] w-[30px]">
                  {h.number}
                </th>
              ))}
              {hasBack && <th className={subtotalHeaderClass}>Out</th>}
              {backHoles.map(h => (
                <th key={h.number} className="px-1 py-1 text-chalk-dim font-semibold text-center text-[11px] w-[30px]">
                  {h.number}
                </th>
              ))}
              {hasBack && <th className={subtotalHeaderClass}>In</th>}
              <th className={subtotalHeaderClass}>Tot</th>
            </tr>
            <tr>
              <th className="sticky left-0 z-10 bg-surface text-left pr-2 py-1 text-chalk-dim font-medium text-[10px] whitespace-nowrap">
                Par
              </th>
              {frontHoles.map(h => (
                <th key={h.number} className="px-1 py-1 text-chalk-dim font-mono text-center text-[11px]">
                  {h.par}
                </th>
              ))}
              {hasBack && <th className={subtotalCellClass + " font-mono text-[11px]"}>{sumPar(frontHoles)}</th>}
              {backHoles.map(h => (
                <th key={h.number} className="px-1 py-1 text-chalk-dim font-mono text-center text-[11px]">
                  {h.par}
                </th>
              ))}
              {hasBack && <th className={subtotalCellClass + " font-mono text-[11px]"}>{sumPar(backHoles)}</th>}
              <th className={subtotalCellClass + " font-mono text-[11px]"}>{sumPar(holes)}</th>
            </tr>
          </thead>
          <tbody>
            {playersA.map(renderPlayerRow)}
            {playersA.length > 0 && playersB.length > 0 && (
              <tr aria-hidden className="h-2">
                <td className="sticky left-0 z-10 bg-fairway-950 p-0" />
                <td colSpan={100} className="bg-fairway-950 p-0" />
              </tr>
            )}
            {playersB.map(renderPlayerRow)}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 text-[10.5px] text-chalk-dim">
        <LegendDot colorClass="bg-turf" label="Birdie+" />
        <LegendDot colorClass="bg-chalk-dim" label="Par/Bogey" />
        <LegendDot colorClass="bg-flag" label="Dbl+" />
        <LegendDot colorClass="bg-sand" label="= stroke hole" />
      </div>

      <div className="mt-2 p-2.5 bg-surface-raised rounded-lg text-[10.5px] text-chalk-dim leading-relaxed">
        <span className="font-semibold text-chalk">Top number</span> = strokes entered by the scorekeeper.{" "}
        <span className="font-semibold text-chalk">Small number below</span> = Stableford points for that hole,
        colored by outcome. The sand-colored dot marks a hole where that player received a handicap stroke.
      </div>
    </div>
  );
}

function LegendDot({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${colorClass}`} />
      {label}
    </span>
  );
}
