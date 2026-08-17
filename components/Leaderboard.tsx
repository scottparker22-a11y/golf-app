"use client";

import { useEffect, useMemo, useState } from "react";
import {
  approxCourseHandicap,
  calculateIndividualLeaderboard,
  calculateSkins,
  calculateTwoManTeamStandings,
  skinsWonByPlayer,
  usesPairing,
} from "@/lib/scoring";
import { useLiveRound } from "@/lib/liveRound";
import { fetchRyderCupTeamScoreForTrip, type RyderCupTripScore } from "@/lib/rounds";
import RyderCupScoreBanner from "./RyderCupScoreBanner";

export default function Leaderboard({ roundId, tripId }: { roundId: string; tripId: string }) {
  const [view, setView] = useState<"team" | "individual">("individual");
  const [scoreMode, setScoreMode] = useState<"gross" | "net">("gross");

  // Live, shared with every other device watching this same round —
  // Supabase pushes any player's entered stroke here in real time.
  const { loading, error, players, holes, teams, holeScores } = useLiveRound(roundId);

  // Trip-wide, fetch-once (not live) — see lib/rounds.ts
  // fetchRyderCupTeamScoreForTrip. Shown above the Individual/Team
  // toggle since the overall Cup score is what people check first.
  const [ryderCupTripScore, setRyderCupTripScore] = useState<RyderCupTripScore | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchRyderCupTeamScoreForTrip(tripId)
      .then(score => {
        if (!cancelled) setRyderCupTripScore(score);
      })
      .catch(() => {
        // Non-fatal — the round's own scores/skins still render below.
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const courseHandicaps = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of players) map[p.id] = approxCourseHandicap(p.handicapIndex);
    return map;
  }, [players]);

  const individualByGross = useMemo(
    () => calculateIndividualLeaderboard(holeScores, players, holes, courseHandicaps),
    [holeScores, players, holes, courseHandicaps]
  );
  const individual = useMemo(() => {
    const sortKey = scoreMode === "net" ? "netRelativeToPar" : "relativeToPar";
    return [...individualByGross].sort((a, b) => a[sortKey] - b[sortKey]);
  }, [individualByGross, scoreMode]);

  const grossSkinsResults = useMemo(
    () => calculateSkins(holeScores, players, holes, { usesHandicap: false, carryover: true }, {}),
    [holeScores, players, holes]
  );
  const netSkinsResults = useMemo(
    () =>
      calculateSkins(
        holeScores,
        players,
        holes,
        { usesHandicap: true, carryover: true },
        courseHandicaps
      ),
    [holeScores, players, holes, courseHandicaps]
  );
  const grossSkinsByPlayer = useMemo(() => skinsWonByPlayer(grossSkinsResults), [grossSkinsResults]);
  const netSkinsByPlayer = useMemo(() => skinsWonByPlayer(netSkinsResults), [netSkinsResults]);

  // Groups set up with 2-man pairing (Best Ball, or Stroke Play opted
  // into "Teams of 2" — see FoursomesStep.tsx) split into their two
  // pairs here instead of showing as one whole-foursome total.
  // Independent of the separate Ryder Cup Team A/B concept.
  const twoManStandings = useMemo(
    () => calculateTwoManTeamStandings(holeScores, players, holes, teams.filter(usesPairing), courseHandicaps),
    [teams, holeScores, players, holes, courseHandicaps]
  );

  const teamStandings = useMemo(() => {
    const sortKey = scoreMode === "net" ? "netRelativeToPar" : "relativeToPar";
    const rows: {
      id: string;
      name: string;
      total: number;
      holesPlayed: number;
      grossSkinsCount: number;
      netSkinsCount: number;
    }[] = [];

    for (const team of teams) {
      if (usesPairing(team)) {
        for (const pair of twoManStandings.filter(t => t.groupId === team.id)) {
          rows.push({
            id: pair.teamKey,
            name: pair.name,
            total: pair[sortKey],
            holesPlayed: pair.holesPlayed,
            grossSkinsCount: pair.playerIds.reduce((sum, id) => sum + (grossSkinsByPlayer[id] ?? 0), 0),
            netSkinsCount: pair.playerIds.reduce((sum, id) => sum + (netSkinsByPlayer[id] ?? 0), 0),
          });
        }
      } else {
        const members = individualByGross.filter(p => team.playerIds.includes(p.playerId));
        rows.push({
          id: team.id,
          name: team.name,
          total: members.reduce((sum, m) => sum + m[sortKey], 0),
          holesPlayed: members.length ? Math.min(...members.map(m => m.holesPlayed)) : 0,
          grossSkinsCount: team.playerIds.reduce((sum, id) => sum + (grossSkinsByPlayer[id] ?? 0), 0),
          netSkinsCount: team.playerIds.reduce((sum, id) => sum + (netSkinsByPlayer[id] ?? 0), 0),
        });
      }
    }

    return rows.sort((a, b) => a.total - b.total);
  }, [teams, twoManStandings, individualByGross, scoreMode, grossSkinsByPlayer, netSkinsByPlayer]);

  const formatScore = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
  const scoreColor = (n: number) => (n < 0 ? "text-turf" : "text-chalk");

  if (loading) {
    return <div className="px-5 pt-8 text-sm text-chalk-dim">Loading live leaderboard…</div>;
  }
  if (error) {
    return (
      <div className="mx-5 mt-4 p-3 bg-flag/10 border border-flag/30 rounded-xl text-[12.5px] text-flag">
        Couldn&apos;t load the round: {error}
      </div>
    );
  }

  return (
    <div>
      {ryderCupTripScore && (
        <div className="mx-5 mt-4">
          <RyderCupScoreBanner
            teamAName={ryderCupTripScore.teamAName}
            teamBName={ryderCupTripScore.teamBName}
            teamScore={ryderCupTripScore.teamScore}
          />
        </div>
      )}

      <div className="flex gap-1 mx-5 mt-4 p-1 bg-surface border border-[color:var(--border)] rounded-xl">
        <button
          onClick={() => setView("individual")}
          className={`flex-1 text-sm font-semibold py-2 rounded-lg ${
            view === "individual" ? "bg-surface-raised text-chalk" : "text-chalk-dim"
          }`}
        >
          Individual
        </button>
        <button
          onClick={() => setView("team")}
          className={`flex-1 text-sm font-semibold py-2 rounded-lg ${
            view === "team" ? "bg-surface-raised text-chalk" : "text-chalk-dim"
          }`}
        >
          Team
        </button>
      </div>

      <div className="flex gap-1 mx-5 mt-2 p-1 bg-surface border border-[color:var(--border)] rounded-xl">
        <button
          onClick={() => setScoreMode("gross")}
          className={`flex-1 text-sm font-semibold py-2 rounded-lg ${
            scoreMode === "gross" ? "bg-surface-raised text-chalk" : "text-chalk-dim"
          }`}
        >
          Gross
        </button>
        <button
          onClick={() => setScoreMode("net")}
          className={`flex-1 text-sm font-semibold py-2 rounded-lg ${
            scoreMode === "net" ? "bg-surface-raised text-chalk" : "text-chalk-dim"
          }`}
        >
          Net
        </button>
      </div>

      {view === "team" ? (
        <div className="px-3 pt-4 pb-1">
          {teamStandings.map((team, i) => (
            <div
              key={team.id}
              className={`grid grid-cols-[34px_1fr_auto] items-center gap-3 p-3 rounded-xl mb-1.5 ${
                i === 0 ? "bg-surface-raised border border-[color:var(--border-strong)]" : ""
              }`}
            >
              <div className={`font-display font-extrabold text-xl text-center ${i === 0 ? "text-sand" : "text-chalk-dim"}`}>
                {i + 1}
              </div>
              <div>
                <div className="text-[15px] font-semibold">{team.name}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {team.grossSkinsCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-flag/15 text-flag">
                      {team.grossSkinsCount} gross skin{team.grossSkinsCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {team.netSkinsCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-turf/15 text-turf">
                      {team.netSkinsCount} net skin{team.netSkinsCount === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-mono font-semibold text-lg ${scoreColor(team.total)}`}>{formatScore(team.total)}</div>
                <div className="text-[11px] text-chalk-dim">thru {team.holesPlayed}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-3 pt-4 pb-1">
          <div className="flex items-start gap-2 mx-2 mb-3 p-2.5 bg-surface border border-[color:var(--border)] rounded-lg text-xs text-chalk-dim leading-relaxed">
            {scoreMode === "net"
              ? "Net totals — strokes minus handicap strokes (course handicap approximated from handicap index). Individually-recorded holes only; scramble/alt-shot holes are excluded since only a team score exists for those."
              : "Gross totals from individually-recorded holes only. Scramble/alt-shot holes are excluded since only a team score exists for those."}
          </div>
          {individual.map((p, i) => (
            <div
              key={p.playerId}
              className={`grid grid-cols-[34px_auto_1fr_auto] items-center gap-3 p-3 rounded-xl mb-1.5 ${
                i === 0 ? "bg-surface-raised border border-[color:var(--border-strong)]" : ""
              }`}
            >
              <div className={`font-display font-extrabold text-xl text-center ${i === 0 ? "text-sand" : "text-chalk-dim"}`}>
                {i + 1}
              </div>
              <div className="w-[30px] h-[30px] rounded-full bg-surface-raised text-chalk-dim text-xs font-bold flex items-center justify-center">
                {p.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div>
                <div className="text-[15px] font-semibold">{p.name}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(grossSkinsByPlayer[p.playerId] ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-flag/15 text-flag">
                      {grossSkinsByPlayer[p.playerId]} gross skin{grossSkinsByPlayer[p.playerId] === 1 ? "" : "s"}
                    </span>
                  )}
                  {(netSkinsByPlayer[p.playerId] ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-turf/15 text-turf">
                      {netSkinsByPlayer[p.playerId]} net skin{netSkinsByPlayer[p.playerId] === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`font-mono font-semibold text-lg ${scoreColor(
                    scoreMode === "net" ? p.netRelativeToPar : p.relativeToPar
                  )}`}
                >
                  {formatScore(scoreMode === "net" ? p.netRelativeToPar : p.relativeToPar)}
                </div>
                <div className="text-[11px] text-chalk-dim">{p.holesPlayed} holes</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
