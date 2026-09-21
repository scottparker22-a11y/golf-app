"use client";

// Per-round Ryder Cup editor — format, scoring basis, and pairings for
// ONE round, reachable any time (not just during initial trip setup)
// from the Ryder Cup Rounds screen (components/RyderCupRoundsScreen.tsx)
// or the "this round hasn't set up its Ryder Cup matches yet" prompt on
// Leaderboard.tsx. Team A/B membership itself is set once, on round 1
// (components/setup/TeamsStep.tsx), and just displayed/merged-into here
// — see the "Unassigned" section below for a player new to the Cup.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveRound } from "@/lib/liveRound";
import {
  DEMO_TRIP_ID,
  createRyderCupGameForRound,
  fetchActiveRyderCupTournament,
  fetchRoundStatus,
  fetchRyderCupGame,
  updateRyderCupGame,
  updateRyderCupTournamentTeams,
  type ActiveRyderCupTournament,
  type RoundStatus,
} from "@/lib/rounds";
import type { RyderCupGameConfig, RyderCupMatchConfig, RyderCupRoundFormat, RyderCupScoringBasis } from "@/lib/scoring";
import RyderCupFormatAndPairings from "./setup/RyderCupFormatAndPairings";

const DEFAULT_CONFIG: RyderCupGameConfig = {
  teamAName: "USA",
  teamBName: "Europe",
  format: "singles",
  scoringBasis: "net",
  matches: [],
};

export default function RyderCupSetupPanel({ tripId, roundId }: { tripId: string; roundId: string }) {
  const router = useRouter();
  const { loading, error, players } = useLiveRound(roundId);

  const [activeCup, setActiveCup] = useState<ActiveRyderCupTournament | null>(null);
  const [existingGameId, setExistingGameId] = useState<string | null>(null);
  const [roundStatus, setRoundStatus] = useState<RoundStatus | null>(null);
  const [config, setConfig] = useState<RyderCupGameConfig>(DEFAULT_CONFIG);
  const [assignment, setAssignment] = useState<Record<string, "A" | "B">>({});
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [overrideUnlocked, setOverrideUnlocked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // DEMO_TRIP_ID, not the tripId prop — that's the cosmetic
        // "demo" URL slug, never a real trip_id to query by (see
        // lib/rounds.ts and the same fix in Leaderboard.tsx).
        const [cup, game, status] = await Promise.all([
          fetchActiveRyderCupTournament(DEMO_TRIP_ID),
          fetchRyderCupGame(roundId),
          fetchRoundStatus(roundId).catch(() => null),
        ]);
        setActiveCup(cup);
        if (cup) setAssignment(cup.teamAssignment);
        setRoundStatus(status?.status ?? null);

        if (game) {
          setExistingGameId(game.gameId);
          setConfig(game.config);
        } else {
          setConfig({
            ...DEFAULT_CONFIG,
            teamAName: cup?.teamAName ?? DEFAULT_CONFIG.teamAName,
            teamBName: cup?.teamBName ?? DEFAULT_CONFIG.teamBName,
          });
        }
      } catch (e) {
        setInitError(e instanceof Error ? e.message : "Couldn't load the Ryder Cup setup");
      } finally {
        setInitializing(false);
      }
    })();
  }, [tripId, roundId]);

  // Pairings are locked the moment this round is actually underway —
  // no unlock escape, unlike format/scoring basis below, since
  // rebuilding pairings after strokes are already tied to specific
  // players/groups would orphan real scores. A round that doesn't
  // exist as a real round yet, or is still "upcoming", stays fully
  // editable.
  const pairingsLocked = roundStatus === "in_progress" || roundStatus === "completed";
  // Format/scoring basis can still be corrected after the round has
  // started — e.g. it was mislabeled Four-Ball when it was really
  // Singles — but only as a deliberate, flagged override, never a
  // casual edit alongside everyone else's live scores.
  const formatLocked = pairingsLocked && !overrideUnlocked;

  const teamA = players.filter(p => assignment[p.id] === "A");
  const teamB = players.filter(p => assignment[p.id] === "B");
  const unassigned = players.filter(p => !assignment[p.id]);

  const setFormat = (format: RyderCupRoundFormat) =>
    setConfig(prev => ({ ...prev, format, matches: format === "stableford" ? [] : prev.matches }));
  const setScoringBasis = (scoringBasis: RyderCupScoringBasis) => setConfig(prev => ({ ...prev, scoringBasis }));
  const setMatches = (matches: RyderCupMatchConfig[]) => setConfig(prev => ({ ...prev, matches }));

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (existingGameId) {
        await updateRyderCupGame(existingGameId, config);
      } else {
        await createRyderCupGameForRound(roundId, config, activeCup?.id ?? null);
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
      setSaveError(e instanceof Error ? e.message : "Couldn't save the Ryder Cup round");
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

  const canSave = config.format === "stableford" || config.matches.length > 0;

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

      <div className="px-5">
        {pairingsLocked && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-sand/10 border border-sand/30 rounded-xl">
            <span className="text-sand text-sm flex-shrink-0">🔒</span>
            <span className="text-[12px] text-chalk-dim flex-1">
              This round is {roundStatus === "completed" ? "completed" : "already underway"} — pairings are
              locked.{" "}
              {!overrideUnlocked && "Format and scoring basis can still be corrected if genuinely needed."}
            </span>
            {!overrideUnlocked && (
              <button
                onClick={() => setOverrideUnlocked(true)}
                className="text-[11px] font-bold text-turf underline flex-shrink-0"
              >
                Override format
              </button>
            )}
          </div>
        )}
        {overrideUnlocked && (
          <div className="mb-4 p-3 bg-flag/10 border border-flag/30 rounded-xl text-[11.5px] text-flag leading-relaxed">
            Overriding format/scoring basis on a round already underway — this only changes how it&apos;s
            scored going forward, it won&apos;t rebuild pairings or touch any strokes already entered.
          </div>
        )}

        {unassigned.length > 0 && (
          <div className="mb-5 p-3 bg-surface border border-dashed border-[color:var(--border-strong)] rounded-xl">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-2">
              Unassigned — new to this Cup
            </div>
            {unassigned.map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-surface-raised rounded-lg px-2.5 py-1.5 mb-1.5">
                <div className="text-[12.5px] font-semibold flex-1">{p.name || "Unnamed"}</div>
                <button
                  onClick={() => setAssignment(prev => ({ ...prev, [p.id]: "A" }))}
                  className="text-[11px] font-bold px-2 py-1 rounded-md bg-turf/15 text-turf"
                >
                  → {config.teamAName}
                </button>
                <button
                  onClick={() => setAssignment(prev => ({ ...prev, [p.id]: "B" }))}
                  className="text-[11px] font-bold px-2 py-1 rounded-md bg-flag/15 text-flag"
                >
                  → {config.teamBName}
                </button>
              </div>
            ))}
          </div>
        )}

        <RyderCupFormatAndPairings
          format={config.format}
          setFormat={setFormat}
          scoringBasis={config.scoringBasis}
          setScoringBasis={setScoringBasis}
          matches={config.matches}
          setMatches={setMatches}
          teamAPlayers={teamA}
          teamBPlayers={teamB}
          teamAName={config.teamAName}
          teamBName={config.teamBName}
          formatDisabled={formatLocked}
          pairingsDisabled={pairingsLocked}
        />
      </div>

      <div className="px-5 mt-5">
        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          className="w-full py-3.5 rounded-xl bg-turf text-fairway-950 font-bold text-[15px] disabled:opacity-60"
        >
          {saving ? "Saving…" : existingGameId ? "Save changes" : "Save & show on Leaderboard"}
        </button>
        {!canSave && (
          <p className="text-[11.5px] text-chalk-dim text-center mt-2">
            Build at least one pairing above first.
          </p>
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
