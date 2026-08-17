// Server-only — the actual DB work behind POST /api/admin/round.
// This is createRoundWithRoster's old body (see lib/rounds.ts's git
// history), moved here and re-pointed at the service-role client so
// it can still write to players/rounds/groups/group_players/games
// now that RLS blocks the anon key from doing so (see
// supabase/add-admin-pin.sql). lib/rounds.ts's createRoundWithRoster
// is now just a fetch() wrapper around this route — every call site
// (SetupWizard.tsx) is unchanged.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TEE_NAME, type RosterGroup, type RosterPlayer } from "@/lib/rounds";
import type { RyderCupGameConfig, SkinsGameConfig } from "@/lib/scoring";

async function createSkinsGame(admin: SupabaseClient, roundId: string, config: SkinsGameConfig): Promise<void> {
  if (!config.gross && !config.net) return;
  const { error } = await admin.from("games").insert({ round_id: roundId, type: "skins", name: "Skins", config });
  if (error) throw new Error(`Couldn't save the skins game: ${error.message}`);
}

async function createRyderCupGame(
  admin: SupabaseClient,
  roundId: string,
  config: RyderCupGameConfig,
  tournamentId?: string | null
): Promise<void> {
  if (config.matches.length === 0) return;
  const { error } = await admin
    .from("games")
    .insert({ round_id: roundId, type: "ryder_cup", name: "Ryder Cup", config, tournament_id: tournamentId ?? null });
  if (error) throw new Error(`Couldn't save the Ryder Cup game: ${error.message}`);
}

export type CreateRoundResult = {
  roundId: string;
  /**
   * Wizard-local player id -> real DB player id, for every player in
   * this round (both newly-inserted and existing-roster reuses).
   * Callers that hold their own wizard-local-id-keyed data structure
   * built before the round existed (see SetupWizard.tsx's
   * teamAssignment, resolved into Ryder Cup team_assignment after the
   * round is created) need this to translate to real ids — mirrors
   * the remapping already done inline for ryderCupConfig.matches below.
   */
  idMap: Record<string, string>;
};

export async function runCreateRoundWithRoster(
  admin: SupabaseClient,
  tripId: string,
  courseId: string,
  players: RosterPlayer[],
  groups: RosterGroup[],
  skinsConfig?: SkinsGameConfig | null,
  ryderCupConfig?: RyderCupGameConfig | null,
  trackStats?: boolean,
  tournamentId?: string | null,
  ryderCupTournamentId?: string | null
): Promise<CreateRoundResult> {
  const namedPlayers = players.filter(p => p.name.trim().length > 0);
  if (namedPlayers.length === 0) {
    throw new Error("Add at least one player before finishing setup.");
  }

  const idMap = new Map<string, string>();

  const toInsert = namedPlayers.filter(p => !p.existingId);
  if (toInsert.length > 0) {
    const { data: insertedPlayers, error: playersErr } = await admin
      .from("players")
      .insert(toInsert.map(p => ({ trip_id: tripId, name: p.name.trim(), handicap_index: p.handicapIndex })))
      .select("id");
    if (playersErr || !insertedPlayers || insertedPlayers.length !== toInsert.length) {
      throw new Error(playersErr?.message ?? "Couldn't save players");
    }
    toInsert.forEach((p, i) => idMap.set(p.localId, insertedPlayers[i].id));
  }

  for (const p of namedPlayers) {
    if (!p.existingId) continue;
    idMap.set(p.localId, p.existingId);
    const { error: updateErr } = await admin
      .from("players")
      .update({ handicap_index: p.handicapIndex, name: p.name.trim() })
      .eq("id", p.existingId);
    if (updateErr) throw new Error(`Couldn't update ${p.name}: ${updateErr.message}`);
  }

  const { error: closeErr } = await admin
    .from("rounds")
    .update({ status: "completed" })
    .eq("trip_id", tripId)
    .eq("status", "in_progress");
  if (closeErr) throw new Error(`Couldn't close out the previous round: ${closeErr.message}`);

  const { data: newRound, error: roundErr } = await admin
    .from("rounds")
    .insert({
      trip_id: tripId,
      course_id: courseId,
      tee_name: DEMO_TEE_NAME,
      date: new Date().toISOString().slice(0, 10),
      status: "in_progress",
      track_stats: !!trackStats,
      tournament_id: tournamentId ?? null,
    })
    .select("id")
    .single();
  if (roundErr || !newRound) throw new Error(roundErr?.message ?? "Couldn't create the round");

  const effectiveGroups: RosterGroup[] =
    groups.length > 0
      ? groups
      : [
          {
            name: "All players",
            localPlayerIds: namedPlayers.map(p => p.localId),
            format: "stroke_play",
            strokePlayTeams: "none",
            pairings: {},
          },
        ];

  for (const g of effectiveGroups) {
    const dbPlayerIds = g.localPlayerIds.map(lid => idMap.get(lid)).filter((id): id is string => !!id);
    if (dbPlayerIds.length === 0) continue;

    // Scorekeeper was picked in the wizard's last step (by wizard-local
    // player id) — resolve through the same idMap used for
    // group_players so it points at the real DB player row.
    const scorerPlayerId = g.scorekeeperLocalPlayerId ? idMap.get(g.scorekeeperLocalPlayerId) ?? null : null;

    const { data: newGroup, error: groupErr } = await admin
      .from("groups")
      .insert({
        round_id: newRound.id,
        name: g.name,
        scorer_player_id: scorerPlayerId,
        format: g.format,
        stroke_play_teams: g.strokePlayTeams,
      })
      .select("id")
      .single();
    if (groupErr || !newGroup) throw new Error(groupErr?.message ?? "Couldn't set up a foursome");

    // Pairings were picked by wizard-local player id (see
    // FoursomesStep.tsx Group.pairings) — resolve each through the
    // same idMap used everywhere else in this function.
    const groupPlayerRows: { group_id: string; player_id: string; pairing: "1" | "2" | null }[] = [];
    for (const lid of g.localPlayerIds) {
      const playerId = idMap.get(lid);
      if (!playerId) continue;
      groupPlayerRows.push({ group_id: newGroup.id, player_id: playerId, pairing: g.pairings[lid] ?? null });
    }
    const { error: gpErr } = await admin.from("group_players").insert(groupPlayerRows);
    if (gpErr) throw new Error(`Couldn't add players to a foursome: ${gpErr.message}`);
  }

  if (skinsConfig) {
    await createSkinsGame(admin, newRound.id, skinsConfig);
  }

  if (ryderCupConfig) {
    const remapped: RyderCupGameConfig = {
      ...ryderCupConfig,
      matches: ryderCupConfig.matches.map(m => ({
        ...m,
        teamAPlayerIds: m.teamAPlayerIds.map(lid => idMap.get(lid) ?? lid),
        teamBPlayerIds: m.teamBPlayerIds.map(lid => idMap.get(lid) ?? lid),
      })),
    };
    await createRyderCupGame(admin, newRound.id, remapped, ryderCupTournamentId);
  }

  return { roundId: newRound.id, idMap: Object.fromEntries(idMap) };
}
