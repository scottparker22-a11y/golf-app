"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Player } from "@/lib/types";
import type { SkinsGameConfig } from "@/lib/scoring";
import {
  createRoundWithRoster,
  deletePlayer,
  DEMO_TRIP_ID,
  fetchTripRoster,
  type RosterGroup,
  type RosterPlayer,
} from "@/lib/rounds";
import CourseStep from "./CourseStep";
import PlayersStep from "./PlayersStep";
import TeamsStep, { DEFAULT_RYDER_CUP_CONFIG, type RyderCupWizardConfig } from "./TeamsStep";
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
  { id: "course", label: "1 · Course" },
  { id: "players", label: "2 · Players" },
  { id: "teams", label: "3 · Ryder Cup" },
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
  const [tab, setTab] = useState<TabId>("course");

  const [courseId, setCourseId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamAssignment, setTeamAssignment] = useState<Record<string, "A" | "B">>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [skinsConfig, setSkinsConfig] = useState<SkinsGameConfig>(DEFAULT_SKINS_CONFIG);
  const [ryderCup, setRyderCup] = useState<RyderCupWizardConfig>(DEFAULT_RYDER_CUP_CONFIG);
  const [trackStats, setTrackStats] = useState(false);
  const [scorekeepers, setScorekeepers] = useState<Record<string, string>>({});

  const [roster, setRoster] = useState<Player[]>([]);
  const rosterIds = new Set(roster.map(r => r.id));

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
  }, []);

  const tabIndex = TABS.findIndex(t => t.id === tab);
  const isLastTab = tab === LAST_TAB;

  const handleDeleteFromRoster = async (player: Player) => {
    await deletePlayer(player.id);
    setRoster(roster.filter(r => r.id !== player.id));
    setPlayers(players.filter(p => p.id !== player.id));
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
      const newRoundId = await createRoundWithRoster(
        DEMO_TRIP_ID,
        courseId,
        rosterPlayers,
        rosterGroups,
        skinsConfig,
        ryderCup.enabled ? ryderCup : null,
        trackStats
      );
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

      {tab === "course" && <CourseStep courseId={courseId} setCourseId={setCourseId} />}
      {tab === "players" && (
        <PlayersStep
          players={players}
          setPlayers={setPlayers}
          roster={roster}
          onDeleteFromRoster={handleDeleteFromRoster}
        />
      )}
      {tab === "teams" && (
        <TeamsStep
          players={players}
          assignment={teamAssignment}
          setAssignment={setTeamAssignment}
          ryderCup={ryderCup}
          setRyderCup={setRyderCup}
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
