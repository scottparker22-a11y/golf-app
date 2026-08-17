"use client";

// Lets an admin add (or edit) a round's Ryder Cup game after the
// round already exists — for a round that was set up as Ryder Cup but
// never got any matches built during setup (createRyderCupGame skips
// the insert entirely when matches is empty), so it never got a
// `games` row and never showed up as a Leaderboard view. Reached from
// the "this round hasn't set up its Ryder Cup matches yet" prompt on
// Leaderboard.tsx. Reuses components/setup/TeamsStep.tsx as-is — the
// players here are the round's real DB players (via useLiveRound), so
// unlike the Setup Wizard there's no wizard-local-id remapping needed.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveRound } from "@/lib/liveRound";
import {
  createRyderCupGameForRound,
  fetchActiveRyderCupTournament,
  fetchRyderCupGame,
  updateRyderCupGame,
  updateRyderCupTournamentTeams,
  type ActiveRyderCupTournament,
} from "@/lib/rounds";
import TeamsStep, { DEFAULT_RYDER_CUP_CONFIG, type RyderCupWizardConfig } from "./setup/TeamsStep";

export default function RyderCupSetupPanel({ tripId, roundId }: { tripId: string; roundId: string }) {
  const router = useRouter();
  const { loading, error, players } = useLiveRound(roundId);

  const [activeCup, setActiveCup] = useState<ActiveRyderCupTournament | null>(null);
  const [existingGameId, setExistingGameId] = useState<string | null>(null);
  const [ryderCup, setRyderCup] = useState<RyderCupWizardConfig>(DEFAULT_RYDER_CUP_CONFIG);
  const [assignment, setAssignment] = useState<Record<string, "A" | "B">>({});
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [cup, game] = await Promise.all([
          fetchActiveRyderCupTournament(tripId),
          fetchRyderCupGame(roundId),
        ]);
        setActiveCup(cup);
        if (cup) setAssignment(cup.teamAssignment);

        if (game) {
          setExistingGameId(game.gameId);
          setRyderCup({ ...game.config, enabled: true });
        } else {
          setRyderCup({
            ...DEFAULT_RYDER_CUP_CONFIG,
            enabled: true,
            teamAName: cup?.teamAName ?? DEFAULT_RYDER_CUP_CONFIG.teamAName,
            teamBName: cup?.teamBName ?? DEFAULT_RYDER_CUP_CONFIG.teamBName,
          });
        }
      } catch (e) {
        setInitError(e instanceof Error ? e.message : "Couldn't load the Ryder Cup setup");
      } finally {
        setInitializing(false);
      }
    })();
  }, [tripId, roundId]);

  // Same locking rule as the Setup Wizard's Ryder Cup tab — only
  // meaningful once round 1's split has actually been saved somewhere.
  const locked = !!activeCup && Object.keys(activeCup.teamAssignment).length > 0;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (existingGameId) {
        await updateRyderCupGame(existingGameId, ryderCup);
      } else {
        await createRyderCupGameForRound(roundId, ryderCup, activeCup?.id ?? null);
      }

      // Anyone newly assigned a team here (e.g. via the Unassigned
      // section) who wasn't part of the Cup's original split — merge
      // them in so they're locked to that team going forward too,
      // same as the Setup Wizard does when finishing a round.
      if (activeCup) {
        const newAssignments = Object.fromEntries(
          Object.entries(assignment).filter(([playerId]) => !(playerId in activeCup.teamAssignment))
        );
        if (Object.keys(newAssignments).length > 0) {
          await updateRyderCupTournamentTeams(activeCup.id, newAssignments);
        }
      }

      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save the Ryder Cup matches");
    } finally {
      setSaving(false);
    }
  };

  if (loading || initializing) {
    return <div className="px-5 pt-8 text-sm text-chalk-dim">Loading…</div>;
  }
  if (error || initError) {
    return (
      <div className="mx-5 mt-4 p-3 bg-flag/10 border border-flag/30 rounded-xl text-[12.5px] text-flag">
        {error ?? initError}
      </div>
    );
  }

  return (
    <div className="pb-10">
      {saveError && (
        <div className="mx-5 mt-4 p-3 bg-flag/10 border border-flag/30 rounded-xl text-[12.5px] text-flag">
          {saveError}
        </div>
      )}
      {saved && (
        <div className="mx-5 mt-4 p-3 bg-turf/15 border border-turf/30 rounded-xl text-[12.5px] text-turf leading-relaxed">
          Saved — the Ryder Cup view is now live on this round&apos;s Leaderboard.
        </div>
      )}

      <TeamsStep
        players={players}
        assignment={assignment}
        setAssignment={setAssignment}
        ryderCup={ryderCup}
        setRyderCup={setRyderCup}
        locked={locked}
      />

      <div className="px-5">
        <button
          onClick={handleSave}
          disabled={saving || ryderCup.matches.length === 0}
          className="w-full py-3.5 rounded-xl bg-turf text-fairway-950 font-bold text-[15px] disabled:opacity-60"
        >
          {saving ? "Saving…" : existingGameId ? "Save changes" : "Save & show on Leaderboard"}
        </button>
        {ryderCup.matches.length === 0 && (
          <p className="text-[11.5px] text-chalk-dim text-center mt-2">Add at least one match above first.</p>
        )}
        <button
          onClick={() => router.push(`/trip/${tripId}/round/${roundId}/leaderboard`)}
          className="w-full py-2.5 mt-2 text-[12.5px] font-bold text-chalk-dim"
        >
          ← Back to Leaderboard
        </button>
      </div>
    </div>
  );
}
