"use client";

import { useState } from "react";
import Link from "next/link";
import type { Player } from "@/lib/types";
import PlayersStep from "./PlayersStep";
import TeamsStep from "./TeamsStep";
import FoursomesStep, { type Group } from "./FoursomesStep";
import ScorekeeperStep from "./ScorekeeperStep";
import RoundsStep, { type RoundDraft } from "./RoundsStep";

const TABS = [
  { id: "players", label: "1 · Players" },
  { id: "teams", label: "2 · Ryder Cup Teams" },
  { id: "foursomes", label: "3 · Foursomes" },
  { id: "scorer", label: "4 · Scorekeeper" },
  { id: "rounds", label: "5 · Rounds" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const LAST_TAB: TabId = "rounds";

export default function SetupWizard({ tripId }: { tripId: string }) {
  const [tripName, setTripName] = useState(`Trip ${tripId}`);
  const [tab, setTab] = useState<TabId>("players");

  const [players, setPlayers] = useState<Player[]>([]);
  const [teamAssignment, setTeamAssignment] = useState<Record<string, "A" | "B">>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [scorekeepers, setScorekeepers] = useState<Record<string, string>>({});
  const [rounds, setRounds] = useState<RoundDraft[]>([]);

  const tabIndex = TABS.findIndex(t => t.id === tab);
  const isLastTab = tab === LAST_TAB;

  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
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

      {tab === "players" && <PlayersStep players={players} setPlayers={setPlayers} />}
      {tab === "teams" && (
        <TeamsStep players={players} assignment={teamAssignment} setAssignment={setTeamAssignment} />
      )}
      {tab === "foursomes" && <FoursomesStep players={players} groups={groups} setGroups={setGroups} />}
      {tab === "scorer" && (
        <ScorekeeperStep
          players={players}
          groups={groups}
          scorekeepers={scorekeepers}
          setScorekeepers={setScorekeepers}
        />
      )}
      {tab === "rounds" && <RoundsStep rounds={rounds} setRounds={setRounds} />}

      <div className="px-5 pt-6">
        {isLastTab ? (
          <>
            <Link
              href={`/trip/${tripId}/leaderboard`}
              className="block w-full text-center py-3.5 rounded-xl bg-turf text-fairway-950 font-bold text-[15px]"
            >
              Finish setup → View scorecard
            </Link>
            <p className="text-[11.5px] text-chalk-dim text-center mt-2 leading-relaxed">
              Heads up: this demo build doesn't save your setup yet, so the scorecard shows
              sample data rather than what you just entered.
            </p>
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
