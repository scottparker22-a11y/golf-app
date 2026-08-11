"use client";

// ─────────────────────────────────────────────────────────────
// Real shared live scoring, backed by Supabase — this replaces the
// old browser-local-storage version (lib/tripStore.ts) now that a
// real database is wired up. Every device reading the same round
// sees the same scores, and Supabase Realtime pushes any player's
// entered stroke to every other device within about a second.
//
// The demo trip's round/course/players/groups are pre-seeded with
// fixed IDs (see supabase/seed.sql) — DEMO_ROUND_ID below matches
// that seed. A future "create your own trip" flow would look up the
// real round id for a given tripId instead of using this constant.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Hole, HoleScore, Player } from "./types";
import { DEMO_ROUND_ID } from "./rounds";

export type TeamDef = { id: string; name: string; playerIds: string[] };

type StaticRoundData = {
  players: Player[];
  holes: Hole[];
  teams: TeamDef[];
  groupIds: string[];
};

type GroupRow = {
  id: string;
  name: string | null;
  group_players: { player_id: string }[] | null;
};

async function fetchStaticRoundData(roundId: string): Promise<StaticRoundData> {
  const { data: round, error: roundErr } = await supabase
    .from("rounds")
    .select("id, course_id, tee_name, trip_id")
    .eq("id", roundId)
    .single();
  if (roundErr) throw new Error(`Couldn't load round: ${roundErr.message}`);
  if (!round) throw new Error("Round not found — has supabase/seed.sql been run?");

  const [holesRes, groupsRes, playersRes] = await Promise.all([
    supabase
      .from("holes")
      .select("number, par, stroke_index")
      .eq("course_id", round.course_id)
      .eq("tee_name", round.tee_name)
      .order("number"),
    supabase
      .from("groups")
      .select("id, name, group_players(player_id)")
      .eq("round_id", roundId),
    supabase.from("players").select("id, name, handicap_index").eq("trip_id", round.trip_id),
  ]);

  if (holesRes.error) throw new Error(`Couldn't load holes: ${holesRes.error.message}`);
  if (groupsRes.error) throw new Error(`Couldn't load groups: ${groupsRes.error.message}`);
  if (playersRes.error) throw new Error(`Couldn't load players: ${playersRes.error.message}`);

  const holes: Hole[] = (holesRes.data ?? []).map(h => ({
    number: h.number,
    par: h.par,
    strokeIndex: h.stroke_index,
  }));

  const teams: TeamDef[] = ((groupsRes.data ?? []) as GroupRow[]).map(g => ({
    id: g.id,
    name: g.name ?? "Group",
    playerIds: (g.group_players ?? []).map(gp => gp.player_id),
  }));

  // Players are stored trip-wide (the standing roster spans every
  // round), but this round is only played by whoever's actually in
  // its groups — scope down to that, or the leaderboard/skins would
  // include everyone who's ever played the trip, not just this round.
  const roundPlayerIds = new Set(teams.flatMap(t => t.playerIds));
  const players: Player[] = (playersRes.data ?? [])
    .filter(p => roundPlayerIds.has(p.id))
    .map(p => ({ id: p.id, name: p.name, handicapIndex: p.handicap_index ?? 0 }));

  return { players, holes, teams, groupIds: teams.map(t => t.id) };
}

async function fetchHoleScores(groupIds: string[]): Promise<HoleScore[]> {
  if (groupIds.length === 0) return [];
  const { data, error } = await supabase
    .from("hole_scores")
    .select("group_id, player_id, hole_number, strokes")
    .in("group_id", groupIds);
  if (error) throw new Error(`Couldn't load scores: ${error.message}`);
  return (data ?? []).map(r => ({
    groupId: r.group_id,
    playerId: r.player_id,
    holeNumber: r.hole_number,
    strokes: r.strokes,
  }));
}

/**
 * Live round data + live scoring, shared across every device viewing
 * the same round. Fetches players/holes/groups once, then keeps
 * hole_scores in sync via a Supabase Realtime subscription.
 */
export function useLiveRound(roundId: string = DEMO_ROUND_ID) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [teams, setTeams] = useState<TeamDef[]>([]);
  const [holeScores, setHoleScores] = useState<HoleScore[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      try {
        const staticData = await fetchStaticRoundData(roundId);
        if (cancelled) return;
        setPlayers(staticData.players);
        setHoles(staticData.holes);
        setTeams(staticData.teams);
        setGroupIds(staticData.groupIds);

        const scores = await fetchHoleScores(staticData.groupIds);
        if (cancelled) return;
        setHoleScores(scores);
        setLoading(false);

        // Live updates: any device writing a score for this round
        // pushes here — no refresh needed.
        channel = supabase
          .channel(`hole_scores:${roundId}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "hole_scores" },
            payload => {
              const row = (payload.new ?? payload.old) as {
                group_id?: string;
                player_id?: string | null;
                hole_number?: number;
                strokes?: number;
              } | null;
              if (!row?.group_id || !staticData.groupIds.includes(row.group_id)) return;

              setHoleScores(prev => {
                if (payload.eventType === "DELETE") {
                  return prev.filter(
                    s => !(s.playerId === row.player_id && s.holeNumber === row.hole_number)
                  );
                }
                const next: HoleScore = {
                  groupId: row.group_id!,
                  playerId: row.player_id ?? null,
                  holeNumber: row.hole_number!,
                  strokes: row.strokes!,
                };
                const idx = prev.findIndex(
                  s => s.playerId === next.playerId && s.holeNumber === next.holeNumber
                );
                return idx === -1 ? [...prev, next] : prev.map((s, i) => (i === idx ? next : s));
              });
            }
          )
          .subscribe();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load round");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [roundId]);

  const setStroke = useCallback(
    (groupId: string, playerId: string, holeNumber: number, strokes: number) => {
      // Optimistic local update — the realtime echo reconciles it,
      // and other devices get it the moment the write lands.
      setHoleScores(prev => {
        const idx = prev.findIndex(s => s.playerId === playerId && s.holeNumber === holeNumber);
        const next: HoleScore = { groupId, playerId, holeNumber, strokes };
        return idx === -1 ? [...prev, next] : prev.map((s, i) => (i === idx ? next : s));
      });
      supabase
        .from("hole_scores")
        .upsert(
          { group_id: groupId, player_id: playerId, hole_number: holeNumber, strokes },
          { onConflict: "group_id,player_id,hole_number" }
        )
        .then(({ error }) => {
          if (error) console.error("Failed to save score:", error.message);
        });
    },
    []
  );

  const clearStroke = useCallback((playerId: string, holeNumber: number) => {
    setHoleScores(prev => prev.filter(s => !(s.playerId === playerId && s.holeNumber === holeNumber)));
    supabase
      .from("hole_scores")
      .delete()
      .eq("player_id", playerId)
      .eq("hole_number", holeNumber)
      .then(({ error }) => {
        if (error) console.error("Failed to clear score:", error.message);
      });
  }, []);

  return { loading, error, players, holes, teams, holeScores, groupIds, setStroke, clearStroke };
}
