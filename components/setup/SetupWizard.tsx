"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Player } from "@/lib/types";
import type { SkinsGameConfig } from "@/lib/scoring";
import {
  createRoundWithRoster,
  createRyderCupTournament,
  createTournament,
  deletePlayer,
  deleteRyderCupTournament,
  deleteTournament,
  DEMO_TRIP_ID,
  fetchActiveRyderCupTournament,
  fetchActiveTournament,
  fetchLastRoundPlayerIds,
  fetchTripRoster,
  updateRyderCupTournamentTeams,
  type ActiveRyderCupTournament,
  type ActiveTournament,
  type RosterGroup,
  type RosterPlayer,
} from "@/lib/rounds";
import CourseStep from "./CourseStep";
import PlayersStep from "./PlayersStep";
import FormatStep from "./FormatStep";
import { DEFAULT_RYDER_CUP_CONFIG, type RyderCupWizardConfig } from "./TeamsStep";
import FoursomesStep, { type Group } from "./FoursomesStep";
import SkinsStep from "./SkinsStep";
import RoundsStep from "./RoundsStep";
import ScorekeeperStep from "./ScorekeeperStep";
import PageNav from "@/components/PageNav";

const DEFAULT_SKINS_CONFIG: SkinsGameConfig = {
  gross: false,
  net: false,
  rollover: true,
  pricing: { model: "per_skin", amountPerSkin: 5 },
};

function groupDisplayName(players: Player[], group: Group, index: number): string {
  const names = group.playerIds
    .map(id => players.find(p => p.id === id)?.name.trim())
    .filter((n): n is string => !!n);
  return names.length > 0 ? names.join(" & ") : `Group ${index + 1}`;
}

const TABS = [
  { id: "format", label: "1 · Format" },
  { id: "course", label: "2 · Course" },
  { id: "players", label: "3 · Players" },
  { id: "foursomes", label: "4 · Foursomes" },
  { id: "skins", label: "5 · Skins" },
  { id: "stats", label: "6 · Stats" },
  { id: "scorer", label: "7 · Scorekeeper" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const LAST_TAB: TabId = "scorer";

export default function SetupWizard({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [tripName, setTripName] = useState(`Trip ${tripId}`);
  const [tab, setTab] = useState<TabId>("format");

  const [courseId, setCourseId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamAssignment, setTeamAssignment] = useState<Record<string, "A" | "B">>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [skinsConfig, setSkinsConfig] = useState<SkinsGameConfig>(DEFAULT_SKINS_CONFIG);
  const [ryderCup, setRyderCup] = useState<RyderCupWizardConfig>(DEFAULT_RYDER_CUP_CONFIG);
  const [trackStats, setTrackStats] = useState(false);
  const [scorekeepers, setScorekeepers] = useState<Record<string, string>>({});

  // Multi-round Tournament + Ryder Cup — independent of each other
  // (see components/setup/FormatStep.tsx). Detection defaults this
  // round to joining whatever's already active for the trip; either
  // can still be opted out of on the Format step.
  const [roundType, setRoundType] = useState<"individual" | "tournament">("individual");
  const [activeTournament, setActiveTournament] = useState<ActiveTournament | null>(null);
  const [tournamentTotalRounds, setTournamentTotalRounds] = useState(4);
  const [usesHandicap, setUsesHandicap] = useState(false);
  // Which course is played each round of a brand-new Tournament, set
  // once up front on the Format step (index 0 = this round) instead of
  // picking one course at a time every time a new round starts — see
  // FormatStep.tsx's "Course order" section. Index i holds a course id
  // or null (not decided yet); later rounds joining this tournament
  // auto-fill their course from activeTournament.courseOrder instead.
  const [tournamentCourseOrder, setTournamentCourseOrderState] = useState<(string | null)[]>([]);
  const [activeRyderCup, setActiveRyderCup] = useState<ActiveRyderCupTournament | null>(null);
  const [ryderCupTotalRounds, setRyderCupTotalRounds] = useState(4);
  // Same idea as tournamentCourseOrder above, for a brand-new Ryder
  // Cup — see FormatStep.tsx's "Course order" section (now shared by
  // both the Tournament and Ryder Cup blocks on that one tab).
  const [ryderCupCourseOrder, setRyderCupCourseOrderState] = useState<(string | null)[]>([]);

  const [roster, setRoster] = useState<Player[]>([]);
  const rosterIds = new Set(roster.map(r => r.id));
  // Who played the trip's last round — powers the Players step's "Use
  // last round's players" shortcut so a new round with the same group
  // doesn't mean re-adding everyone one at a time (see
  // components/setup/PlayersStep.tsx). Groups are re-picked fresh
  // every round via FoursomesStep.tsx, not reused from here.
  const [lastRoundPlayerIds, setLastRoundPlayerIds] = useState<string[]>([]);

  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  useEffect(() => {
    // The trip's standing roster, so Players can offer "pick from
    // roster" instead of retyping everyone every round.
    fetchTripRoster(DEMO_TRIP_ID)
      .then(setRoster)
      .catch(() => {
        // Non-fatal — Players step still works for typing names in.
      });
    fetchLastRoundPlayerIds(DEMO_TRIP_ID)
      .then(setLastRoundPlayerIds)
      .catch(() => {
        // Non-fatal — the "use last round's players" shortcut just won't show.
      });
    // Auto-detect an already-running Tournament/Ryder Cup and default
    // this round to joining it (confirmed with the user over asking
    // fresh every round) — either can still be opted out of below.
    fetchActiveTournament(DEMO_TRIP_ID)
      .then(t => {
        setActiveTournament(t);
        if (t) {
          setRoundType("tournament");
          // This round's slot in the tournament's pre-planned course
          // order (see FormatStep.tsx) — auto-fill the Course step
          // instead of asking again, same as the round-type/Ryder Cup
          // auto-join above. Leaves courseId alone if that slot was
          // never set (null) or the tournament's already past it.
          const nextCourseId = t.courseOrder[t.roundsPlayed];
          if (nextCourseId) setCourseId(nextCourseId);
        }
      })
      .catch(() => {
        // Non-fatal — falls back to "no active tournament detected".
      });
    fetchActiveRyderCupTournament(DEMO_TRIP_ID)
      .then(rc => {
        setActiveRyderCup(rc);
        if (rc) {
          setRyderCup(prev => ({ ...prev, enabled: true }));
          // Carry over round 1's team split so this round starts
          // locked to the same teams instead of re-splitting the
          // roster (see components/setup/TeamsStep.tsx). Anyone new
          // to the trip just won't have an entry yet — TeamsStep's
          // "Unassigned" section handles them.
          if (Object.keys(rc.teamAssignment).length > 0) {
            setTeamAssignment(prev => ({ ...rc.teamAssignment, ...prev }));
          }
          // This round's slot in the Cup's pre-planned course order —
          // same auto-fill as the Tournament's above.
          const nextCourseId = rc.courseOrder[rc.roundsPlayed];
          if (nextCourseId) setCourseId(nextCourseId);
        }
      })
      .catch(() => {
        // Non-fatal — falls back to "no active Ryder Cup detected".
      });
  }, []);

  // Locked once the active Ryder Cup already has a saved team split —
  // TeamsStep.tsx hides the reshuffle controls in that state so teams
  // genuinely stay the same all tournament, not just "usually".
  const ryderCupTeamsLocked = !!activeRyderCup && Object.keys(activeRyderCup.teamAssignment).length > 0;

  const tabIndex = TABS.findIndex(t => t.id === tab);
  const isLastTab = tab === LAST_TAB;

  // Round 1 of a brand-new tournament's course order IS this round's
  // course — keep them in sync so picking it here also fills in the
  // Course step, instead of asking the user to pick it twice.
  const setTournamentCourseOrderAt = (index: number, id: string | null) => {
    setTournamentCourseOrderState(prev => {
      const next = [...prev];
      while (next.length <= index) next.push(null);
      next[index] = id;
      return next;
    });
    if (index === 0) setCourseId(id);
  };

  // Same idea, for a brand-new Ryder Cup's course order. If both a
  // Tournament and a Ryder Cup are being created for the same round
  // (independent, per FormatStep.tsx) and both set round 1's course,
  // whichever was picked more recently wins — an edge case worth
  // noting, not worth blocking on.
  const setRyderCupCourseOrderAt = (index: number, id: string | null) => {
    setRyderCupCourseOrderState(prev => {
      const next = [...prev];
      while (next.length <= index) next.push(null);
      next[index] = id;
      return next;
    });
    if (index === 0) setCourseId(id);
  };

  const handleDeleteFromRoster = async (player: Player) => {
    await deletePlayer(player.id);
    setRoster(roster.filter(r => r.id !== player.id));
    setPlayers(players.filter(p => p.id !== player.id));
  };

  // Deletes the trip-wide Tournament/Ryder Cup wrapper this round was
  // about to join (see FormatStep.tsx's "Delete this Tournament/Ryder
  // Cup" button) — its own rounds/scores are untouched server-side,
  // this just clears local state so the Format tab falls back to
  // "start a new one" instead of "joining" a wrapper that no longer
  // exists.
  const handleDeleteTournament = async () => {
    if (!activeTournament) return;
    await deleteTournament(activeTournament.id);
    setActiveTournament(null);
    setRoundType("individual");
  };

  const handleDeleteRyderCup = async () => {
    if (!activeRyderCup) return;
    await deleteRyderCupTournament(activeRyderCup.id);
    setActiveRyderCup(null);
    setRyderCup(prev => ({ ...prev, enabled: false }));
  };

  const handleFinish = async () => {
    if (!courseId) {
      setFinishError("Pick a course on the first step.");
      return;
    }
    setFinishing(true);
    setFinishError(null);
    try {
      const rosterPlayers: RosterPlayer[] = players.map(p => ({
        localId: p.id,
        name: p.name,
        handicapIndex: p.handicapIndex,
        existingId: rosterIds.has(p.id) ? p.id : undefined,
      }));
      const rosterGroups: RosterGroup[] = groups.map((g, i) => ({
        name: groupDisplayName(players, g, i),
        localPlayerIds: g.playerIds,
        scorekeeperLocalPlayerId: scorekeepers[g.id],
        format: g.format,
        strokePlayTeams: g.strokePlayTeams,
        pairings: g.pairings,
      }));

      // Resolve to a concrete tournament id — join the one already
      // detected for the trip, or create a fresh one (see
      // components/setup/FormatStep.tsx for the join/create UI).
      let tournamentId: string | null = null;
      if (roundType === "tournament") {
        tournamentId = activeTournament
          ? activeTournament.id
          : await createTournament(
              DEMO_TRIP_ID,
              tournamentTotalRounds,
              usesHandicap,
              tournamentCourseOrder
            );
      }
      let ryderCupTournamentId: string | null = null;
      if (ryderCup.enabled) {
        ryderCupTournamentId = activeRyderCup
          ? activeRyderCup.id
          : await createRyderCupTournament(
              DEMO_TRIP_ID,
              ryderCup.teamAName,
              ryderCup.teamBName,
              ryderCupTotalRounds,
              undefined,
              ryderCupCourseOrder
            );
      }

      const { roundId: newRoundId, idMap } = await createRoundWithRoster(
        DEMO_TRIP_ID,
        courseId,
        rosterPlayers,
        rosterGroups,
        skinsConfig,
        ryderCup.enabled ? ryderCup : null,
        trackStats,
        tournamentId,
        ryderCupTournamentId
      );

      // Persist team_assignment only now, using the real DB player ids
      // (idMap) instead of this wizard session's local ones — brand-new
      // players don't get a real id until the round above actually
      // inserts them. Only ever sends entries not already saved (empty
      // for a fresh Cup, so this covers round 1 too), so an in-progress
      // Cup's earlier rounds' locked-in teams are never touched.
      if (ryderCup.enabled && ryderCupTournamentId) {
        const existingAssignment = activeRyderCup?.teamAssignment ?? {};
        const newAssignments = Object.fromEntries(
          Object.entries(teamAssignment)
            .map(([localId, side]) => [idMap[localId] ?? localId, side] as const)
            .filter(([playerId]) => !(playerId in existingAssignment))
        );
        if (Object.keys(newAssignments).length > 0) {
          await updateRyderCupTournamentTeams(ryderCupTournamentId, newAssignments);
        }
      }

      router.push(`/trip/${tripId}/round/${newRoundId}/scorecard`);
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : "Couldn't finish setup");
      setFinishing(false);
    }
  };

  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <PageNav />
      <div className="px-5 pt-6 pb-4 border-b border-[color:var(--border)]">
        <div className="text-xs font-semibold uppercase tracking-wide text-chalk-dim mb-1.5">Trip setup</div>
        <div className="flex items-center gap-2">
          <input
            className="font-display font-extrabold text-[28px] bg-transparent border-b border-dashed border-[color:var(--border-strong)] focus:border-turf outline-none flex-1 min-w-0 py-0.5"
            value={tripName}
            onChange={e => setTripName(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-1.5 px-4 py-3.5 overflow-x-auto border-b border-[color:var(--border)]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 text-[12.5px] font-semibold px-3.5 py-2 rounded-full border whitespace-nowrap ${
              tab === t.id
                ? "bg-turf text-fairway-950 border-turf"
                : "bg-surface text-chalk-dim border-[color:var(--border)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "format" && (
        <FormatStep
          roundType={roundType}
          setRoundType={setRoundType}
          activeTournament={activeTournament}
          onDeleteTournament={handleDeleteTournament}
          tournamentTotalRounds={tournamentTotalRounds}
          setTournamentTotalRounds={setTournamentTotalRounds}
          usesHandicap={usesHandicap}
          setUsesHandicap={setUsesHandicap}
          tournamentCourseOrder={tournamentCourseOrder}
          setTournamentCourseOrderAt={setTournamentCourseOrderAt}
          players={players}
          ryderCup={ryderCup}
          setRyderCup={setRyderCup}
          assignment={teamAssignment}
          setAssignment={setTeamAssignment}
          ryderCupLocked={ryderCupTeamsLocked}
          activeRyderCup={activeRyderCup}
          onDeleteRyderCup={handleDeleteRyderCup}
          ryderCupTotalRounds={ryderCupTotalRounds}
          setRyderCupTotalRounds={setRyderCupTotalRounds}
          ryderCupCourseOrder={ryderCupCourseOrder}
          setRyderCupCourseOrderAt={setRyderCupCourseOrderAt}
        />
      )}
      {tab === "course" && <CourseStep courseId={courseId} setCourseId={setCourseId} />}
      {tab === "players" && (
        <PlayersStep
          players={players}
          setPlayers={setPlayers}
          roster={roster}
          onDeleteFromRoster={handleDeleteFromRoster}
          lastRoundPlayerIds={lastRoundPlayerIds}
        />
      )}
      {tab === "foursomes" && <FoursomesStep players={players} groups={groups} setGroups={setGroups} />}
      {tab === "skins" && (
        <SkinsStep config={skinsConfig} setConfig={setSkinsConfig} playerCount={players.length} />
      )}
      {tab === "stats" && <RoundsStep trackStats={trackStats} setTrackStats={setTrackStats} />}
      {tab === "scorer" && (
        <ScorekeeperStep
          players={players}
          groups={groups}
          scorekeepers={scorekeepers}
          setScorekeepers={setScorekeepers}
        />
      )}

      <div className="px-5 pt-6">
        {isLastTab ? (
          <>
            <button
              onClick={handleFinish}
              disabled={finishing || players.length === 0}
              className="block w-full text-center py-3.5 rounded-xl bg-turf text-fairway-950 font-bold text-[15px] disabled:opacity-60"
            >
              {finishing ? "Saving…" : "Finish setup → View scorecard"}
            </button>
            {finishError ? (
              <p className="text-[11.5px] text-flag text-center mt-2 leading-relaxed">{finishError}</p>
            ) : players.length === 0 ? (
              <p className="text-[11.5px] text-chalk-dim text-center mt-2 leading-relaxed">
                Add at least one player on the Players step first.
              </p>
            ) : (
              <p className="text-[11.5px] text-chalk-dim text-center mt-2 leading-relaxed">
                This saves your course, players, and foursomes as a real round.
              </p>
            )}
          </>
        ) : (
          <button
            onClick={() => setTab(TABS[tabIndex + 1].id)}
            className="w-full py-3.5 rounded-xl bg-turf text-fairway-950 font-bold text-[15px]"
          >
            Next: {TABS[tabIndex + 1].label} →
          </button>
        )}
      </div>
    </main>
  );
}
