"use client";

// First step of the wizard — picks how this round fits into the trip.
// A round can count toward a multi-round Tournament (Stroke Play,
// see lib/scoring.ts calculateTournamentLeaderboard), a Ryder Cup
// (match play, see components/RyderCupBoard.tsx), both, or neither —
// they're independent toggles. When SetupWizard detects either is
// already running for this trip (see lib/rounds.ts
// fetchActiveTournament/fetchActiveRyderCupTournament), it defaults
// this round to joining it; either can still be opted out of here.
// The Ryder Cup toggle itself used to live in TeamsStep.tsx — it
// moved here so both cross-round formats are picked in one place;
// TeamsStep still owns team names/matches, just reads `ryderCup.enabled`.
import type { ActiveRyderCupTournament, ActiveTournament } from "@/lib/rounds";
import type { RyderCupWizardConfig } from "./TeamsStep";

export default function FormatStep({
  roundType,
  setRoundType,
  activeTournament,
  tournamentTotalRounds,
  setTournamentTotalRounds,
  usesHandicap,
  setUsesHandicap,
  ryderCup,
  setRyderCup,
  activeRyderCup,
  ryderCupTotalRounds,
  setRyderCupTotalRounds,
}: {
  roundType: "individual" | "tournament";
  setRoundType: (t: "individual" | "tournament") => void;
  activeTournament: ActiveTournament | null;
  tournamentTotalRounds: number;
  setTournamentTotalRounds: (n: number) => void;
  usesHandicap: boolean;
  setUsesHandicap: (v: boolean) => void;
  ryderCup: RyderCupWizardConfig;
  setRyderCup: (r: RyderCupWizardConfig) => void;
  activeRyderCup: ActiveRyderCupTournament | null;
  ryderCupTotalRounds: number;
  setRyderCupTotalRounds: (n: number) => void;
}) {
  return (
    <div className="px-5 pt-4">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        Pick how this round fits into the trip. It can count toward a multi-round Tournament, a Ryder
        Cup, both, or neither.
      </p>

      <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-2">Round type</div>
      <div className="flex gap-2 mb-3">
        {(["individual", "tournament"] as const).map(t => (
          <button
            key={t}
            onClick={() => setRoundType(t)}
            className={`flex-1 text-[13px] font-bold py-2.5 rounded-xl border ${
              roundType === t
                ? "bg-turf text-fairway-950 border-turf"
                : "bg-surface text-chalk-dim border-[color:var(--border)]"
            }`}
          >
            {t === "individual" ? "Individual Round" : "Tournament"}
          </button>
        ))}
      </div>

      {roundType === "tournament" && (
        <div className="mb-5 p-3.5 bg-surface border border-[color:var(--border)] rounded-xl">
          {activeTournament ? (
            <>
              <div className="text-[13.5px] font-semibold mb-1">
                Joining: Round {activeTournament.roundsPlayed + 1} of {activeTournament.totalRounds}
              </div>
              <p className="text-[11px] text-chalk-dim leading-relaxed mb-2.5">
                A Tournament is already running for this trip — this round&apos;s scores will add to its
                leaderboard.
              </p>
              <button
                onClick={() => setRoundType("individual")}
                className="text-[11px] font-bold text-chalk-dim underline"
              >
                Don&apos;t count this round toward it
              </button>
            </>
          ) : (
            <>
              <div className="text-[13.5px] font-semibold mb-2.5">Starting a new Tournament</div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim">
                  How many rounds?
                </span>
                <input
                  type="number"
                  min={1}
                  value={tournamentTotalRounds}
                  onChange={e => setTournamentTotalRounds(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2 py-1.5 text-sm font-mono"
                />
              </div>
              <p className="text-[11px] text-chalk-dim leading-relaxed mb-2.5">
                Just a display target (&quot;Round 2 of {tournamentTotalRounds}&quot;) — later rounds can still
                join even after this many have already been played.
              </p>
              <button
                onClick={() => setUsesHandicap(!usesHandicap)}
                className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border text-left ${
                  usesHandicap ? "bg-turf/15 border-turf" : "bg-surface-raised border-[color:var(--border)]"
                }`}
              >
                <span
                  className={`w-[16px] h-[16px] rounded-md border-2 flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                    usesHandicap ? "bg-turf border-turf text-fairway-950" : "border-chalk-dim"
                  }`}
                >
                  {usesHandicap ? "✓" : ""}
                </span>
                <span className="text-[12.5px] font-semibold">Use handicap (net) for the Tournament leaderboard</span>
              </button>
            </>
          )}
        </div>
      )}

      <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-2">
        Ryder Cup — independent of the Tournament above
      </div>
      <button
        onClick={() => setRyderCup({ ...ryderCup, enabled: !ryderCup.enabled })}
        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left mb-3 ${
          ryderCup.enabled ? "bg-turf/15 border-turf" : "bg-surface border-[color:var(--border)]"
        }`}
      >
        <span
          className={`w-[18px] h-[18px] rounded-md border-2 flex-shrink-0 flex items-center justify-center text-[11px] font-bold ${
            ryderCup.enabled ? "bg-turf border-turf text-fairway-950" : "border-chalk-dim"
          }`}
        >
          {ryderCup.enabled ? "✓" : ""}
        </span>
        <span>
          <div className="text-[13.5px] font-semibold">Also play Ryder Cup</div>
          <div className="text-[11px] text-chalk-dim">
            Team match play, built from the same scores everyone enters on the Scorecard. Set up teams
            and matches on the Ryder Cup step.
          </div>
        </span>
      </button>

      {ryderCup.enabled && (
        <div className="p-3.5 bg-surface border border-[color:var(--border)] rounded-xl">
          {activeRyderCup ? (
            <>
              <div className="text-[13.5px] font-semibold mb-1">
                Joining: Round {activeRyderCup.roundsPlayed + 1} of {activeRyderCup.totalRounds}
              </div>
              <p className="text-[11px] text-chalk-dim leading-relaxed mb-2.5">
                A Ryder Cup ({activeRyderCup.teamAName} vs {activeRyderCup.teamBName}) is already running
                for this trip — this round&apos;s matches will add to its overall score.
              </p>
              <button
                onClick={() => setRyderCup({ ...ryderCup, enabled: false })}
                className="text-[11px] font-bold text-chalk-dim underline"
              >
                Don&apos;t count this round toward it
              </button>
            </>
          ) : (
            <>
              <div className="text-[13.5px] font-semibold mb-2.5">Starting a new Ryder Cup</div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim">
                  How many rounds?
                </span>
                <input
                  type="number"
                  min={1}
                  value={ryderCupTotalRounds}
                  onChange={e => setRyderCupTotalRounds(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2 py-1.5 text-sm font-mono"
                />
              </div>
              <p className="text-[11px] text-chalk-dim leading-relaxed mt-2.5">
                Team names and matches are set up on the Ryder Cup step next.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
