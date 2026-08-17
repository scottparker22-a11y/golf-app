"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchRyderCupGame, updateRyderCupGame } from "@/lib/rounds";
import type { Hole, HoleScore, Player } from "@/lib/types";
import {
  approxCourseHandicap,
  calculateIndividualLeaderboard,
  calculateRyderCupMatch,
  formatRyderCupMatchStatus,
  type RyderCupGameConfig,
  type RyderCupMatchConfig,
  type RyderCupMatchResult,
  type RyderCupOverride,
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

  useEffect(() => {
    let cancelled = false;
    fetchRyderCupGame(roundId)
      .then(g => {
        if (!cancelled) setGame(g);
      })
      .catch(e => setGameError(e instanceof Error ? e.message : "Couldn't load the Ryder Cup game"));
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
  const formatLabel = match.format === "singles" ? "Singles" : "Four-Ball";

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
