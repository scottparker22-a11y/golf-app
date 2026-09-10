"use client";

// Lets an admin grant/revoke real, enforced Scorekeeper access per
// group for a round — works on any round, live or not, reached from
// its own route (app/trip/[tripId]/round/[roundId]/scorekeepers) same
// as components/RyderCupSetupPanel.tsx's pattern. Players without a
// linked login get an inline "Invite" flow instead of a toggle —
// Scorekeeper access requires a real account, so that has to happen
// first (see lib/scorekeepers.ts).
import { useEffect, useState } from "react";
import { useLiveRound } from "@/lib/liveRound";
import {
  assignScorekeeper,
  fetchPlayerProfiles,
  fetchScorekeepers,
  invitePlayer,
  removeScorekeeper,
  type PlayerProfile,
  type ScorekeeperAssignment,
} from "@/lib/scorekeepers";

export default function ScorekeeperAssignmentPanel({ roundId }: { roundId: string }) {
  const { loading, error, players, teams } = useLiveRound(roundId);

  const [profiles, setProfiles] = useState<Record<string, PlayerProfile>>({});
  const [assignments, setAssignments] = useState<ScorekeeperAssignment[]>([]);
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [invitingPlayerId, setInvitingPlayerId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");

  const reload = async () => {
    const [profileMap, assigned] = await Promise.all([
      fetchPlayerProfiles(players.map(p => p.id)),
      fetchScorekeepers(roundId),
    ]);
    setProfiles(profileMap);
    setAssignments(assigned);
  };

  useEffect(() => {
    if (loading || error || players.length === 0) return;
    (async () => {
      try {
        await reload();
      } catch (e) {
        setInitError(e instanceof Error ? e.message : "Couldn't load scorekeepers");
      } finally {
        setInitializing(false);
      }
    })();
    // Only once the round's real players are in — re-running on every
    // players/teams reference change would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, players.length, roundId]);

  const assignmentFor = (groupId: string, profileId: string) =>
    assignments.find(a => a.groupId === groupId && a.profileId === profileId);

  const handleToggle = async (groupId: string, playerId: string, profileId: string) => {
    setBusyPlayerId(playerId);
    setActionError(null);
    try {
      const existing = assignmentFor(groupId, profileId);
      if (existing) {
        await removeScorekeeper(existing.id);
      } else {
        await assignScorekeeper(roundId, groupId, profileId);
      }
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't update the scorekeeper");
    } finally {
      setBusyPlayerId(null);
    }
  };

  const handleInvite = async (playerId: string) => {
    if (!inviteEmail.trim()) return;
    setBusyPlayerId(playerId);
    setActionError(null);
    try {
      await invitePlayer(playerId, inviteEmail.trim());
      setInvitingPlayerId(null);
      setInviteEmail("");
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't send the invite");
    } finally {
      setBusyPlayerId(null);
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
    <div className="px-5 pt-4 pb-10">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        Toggle who can enter and correct scores for each group. Removing someone takes effect
        immediately — no re-login needed.
      </p>

      {actionError && (
        <div className="mb-4 p-3 bg-flag/10 border border-flag/30 rounded-xl text-[12.5px] text-flag">
          {actionError}
        </div>
      )}

      {teams.map((team, gi) => (
        <div key={team.id} className="bg-surface border border-[color:var(--border)] rounded-xl p-3.5 mb-3">
          <div className="font-display font-extrabold text-[17px] mb-2.5">{team.name || `Group ${gi + 1}`}</div>
          {team.playerIds.map(playerId => {
            const p = players.find(pl => pl.id === playerId);
            if (!p) return null;
            const profile = profiles[playerId];
            const isBusy = busyPlayerId === playerId;

            if (!profile) {
              return (
                <div
                  key={playerId}
                  className="rounded-lg px-2.5 py-2 mb-1.5 border bg-surface-raised border-[color:var(--border-strong)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-semibold">{p.name}</span>
                    {invitingPlayerId === playerId ? (
                      <button
                        onClick={() => setInvitingPlayerId(null)}
                        className="text-[10px] font-bold text-chalk-dim uppercase flex-shrink-0"
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        onClick={() => setInvitingPlayerId(playerId)}
                        className="text-[10px] font-bold text-sand uppercase flex-shrink-0"
                      >
                        No account · Invite
                      </button>
                    )}
                  </div>
                  {invitingPlayerId === playerId && (
                    <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                      <input
                        type="email"
                        inputMode="email"
                        placeholder="their email"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        className="flex-1 min-w-0 bg-surface border border-[color:var(--border-strong)] rounded-lg px-2.5 py-2 text-[12.5px] outline-none focus:border-turf"
                      />
                      <button
                        onClick={() => handleInvite(playerId)}
                        disabled={isBusy || !inviteEmail.trim()}
                        className="flex-shrink-0 text-[11px] font-bold px-2.5 py-2 rounded-lg bg-turf text-fairway-950 disabled:opacity-60"
                      >
                        {isBusy ? "…" : "Send"}
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            const selected = !!assignmentFor(team.id, profile.profileId);
            return (
              <button
                key={playerId}
                onClick={() => handleToggle(team.id, playerId, profile.profileId)}
                disabled={isBusy}
                className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 mb-1.5 border text-left disabled:opacity-60 ${
                  selected ? "bg-sand/15 border-sand" : "bg-surface-raised border-[color:var(--border-strong)]"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    selected ? "bg-sand border-sand" : "border-chalk-dim"
                  }`}
                />
                <span className="text-[12.5px] font-semibold flex-1">{p.name}</span>
                {selected && <span className="text-[10px] font-bold text-sand uppercase">Scorekeeper</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
