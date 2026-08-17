"use client";

// ─────────────────────────────────────────────────────────────
// Multi-round Tournament data — the first cross-round data-fetching
// pattern in the app (everything else, see lib/liveRound.ts, is
// scoped to a single round_id). Deliberately fetch-once rather than
// realtime-subscribed: this is a supplementary/summary view, not the
// primary live-scoring surface, and subscribing across N rounds'
// worth of hole_scores is a meaningfully bigger lift than one round's
// — see the plan note in this feature's PR description.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Hole, HoleScore, Player } from "./types";
import {
  approxCourseHandicap,
  calculateTournamentLeaderboard,
  type TournamentRoundInput,
  type TournamentStanding,
} from "./scoring";

export type TournamentRoundMeta = {
  roundId: string;
  date: string;
};

type TournamentDataState = {
  loading: boolean;
  error: string | null;
  standings: TournamentStanding[];
  roundsMeta: TournamentRoundMeta[]; // ordered oldest-first, for the R1..Rn columns
  usesHandicap: boolean;
  totalRounds: number;
};

const EMPTY_STATE: TournamentDataState = {
  loading: true,
  error: null,
  standings: [],
  roundsMeta: [],
  usesHandicap: false,
  totalRounds: 0,
};

async function fetchTournamentRounds(
  tournamentId: string
): Promise<{ id: string; date: string }[]> {
  const { data, error } = await supabase
    .from("rounds")
    .select("id, date, created_at")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Couldn't load the tournament's rounds: ${error.message}`);
  return (data ?? []).map(r => ({ id: r.id, date: r.date }));
}

async function fetchRoundHolesAndScores(roundId: string): Promise<{ holes: Hole[]; scores: HoleScore[] }> {
  const { data: round, error: roundErr } = await supabase
    .from("rounds")
    .select("course_id, tee_name")
    .eq("id", roundId)
    .single();
  if (roundErr || !round) throw new Error(roundErr?.message ?? "Round not found");

  const [holesRes, groupsRes] = await Promise.all([
    supabase
      .from("holes")
      .select("number, par, stroke_index")
      .eq("course_id", round.course_id)
      .eq("tee_name", round.tee_name)
      .order("number"),
    supabase.from("groups").select("id").eq("round_id", roundId),
  ]);
  if (holesRes.error) throw new Error(`Couldn't load holes: ${holesRes.error.message}`);
  if (groupsRes.error) throw new Error(`Couldn't load groups: ${groupsRes.error.message}`);

  const holes: Hole[] = (holesRes.data ?? []).map(h => ({
    number: h.number,
    par: h.par,
    strokeIndex: h.stroke_index,
  }));

  const groupIds = (groupsRes.data ?? []).map(g => g.id);
  if (groupIds.length === 0) return { holes, scores: [] };

  const { data: scoresData, error: scoresErr } = await supabase
    .from("hole_scores")
    .select("group_id, player_id, hole_number, strokes")
    .in("group_id", groupIds);
  if (scoresErr) throw new Error(`Couldn't load scores: ${scoresErr.message}`);

  const scores: HoleScore[] = (scoresData ?? []).map(r => ({
    groupId: r.group_id,
    playerId: r.player_id,
    holeNumber: r.hole_number,
    strokes: r.strokes,
  }));

  return { holes, scores };
}

/**
 * Fetch-once leaderboard for a multi-round Tournament — sums
 * hole_scores across every round linked to it (rounds.tournament_id)
 * per player. Pass null while the active tournament id is still being
 * resolved (see app/trip/[tripId]/tournament/page.tsx); the hook just
 * sits in its initial loading state until a real id shows up.
 */
export function useTournamentData(tournamentId: string | null): TournamentDataState {
  const [state, setState] = useState<TournamentDataState>(EMPTY_STATE);

  useEffect(() => {
    if (!tournamentId) {
      setState(EMPTY_STATE);
      return;
    }

    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const { data: tournament, error: tErr } = await supabase
          .from("tournaments")
          .select("trip_id, total_rounds, uses_handicap")
          .eq("id", tournamentId)
          .single();
        if (tErr || !tournament) throw new Error(tErr?.message ?? "Tournament not found");

        const roundRows = await fetchTournamentRounds(tournamentId);

        const { data: playersData, error: playersErr } = await supabase
          .from("players")
          .select("id, name, handicap_index")
          .eq("trip_id", tournament.trip_id)
          .order("name");
        if (playersErr) throw new Error(`Couldn't load the roster: ${playersErr.message}`);
        const players: Player[] = (playersData ?? []).map(p => ({
          id: p.id,
          name: p.name,
          handicapIndex: p.handicap_index ?? 0,
        }));

        const roundsData: TournamentRoundInput[] = await Promise.all(
          roundRows.map(async r => {
            const { holes, scores } = await fetchRoundHolesAndScores(r.id);
            return { roundId: r.id, holes, scores };
          })
        );

        const courseHandicaps: Record<string, number> = {};
        for (const p of players) courseHandicaps[p.id] = approxCourseHandicap(p.handicapIndex);

        const standings = calculateTournamentLeaderboard(
          roundsData,
          players,
          courseHandicaps,
          tournament.uses_handicap
        );

        if (cancelled) return;
        setState({
          loading: false,
          error: null,
          standings,
          roundsMeta: roundRows.map(r => ({ roundId: r.id, date: r.date })),
          usesHandicap: tournament.uses_handicap,
          totalRounds: tournament.total_rounds,
        });
      } catch (e) {
        if (!cancelled) {
          setState(s => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Failed to load tournament" }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  return state;
}
