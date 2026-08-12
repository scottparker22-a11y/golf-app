"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { archiveRound, deleteRound, fetchRounds, restoreRound, type RoundSummary } from "@/lib/rounds";

const STATUS_STYLE: Record<string, string> = {
  in_progress: "bg-turf/15 text-turf",
  completed: "bg-surface-raised text-chalk-dim",
  upcoming: "bg-sand/15 text-sand",
  archived: "bg-surface-raised text-chalk-dim",
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
  completed: "Completed",
  upcoming: "Upcoming",
  archived: "Archived",
};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type PendingConfirm = { id: string; action: "archive" | "delete" };

export default function RoundsList({ tripId, tripDbId }: { tripId: string; tripDbId: string }) {
  const [rounds, setRounds] = useState<RoundSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetchRounds(tripDbId)
      .then(setRounds)
      .catch(e => setError(e instanceof Error ? e.message : "Couldn't load rounds"));
  }, [tripDbId]);

  const handleArchive = async (roundId: string) => {
    setBusyId(roundId);
    setError(null);
    try {
      await archiveRound(roundId);
      setRounds(prev => prev && prev.map(r => (r.id === roundId ? { ...r, status: "archived" } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't archive the round");
    } finally {
      setBusyId(null);
      setPending(null);
    }
  };

  const handleRestore = async (roundId: string) => {
    setBusyId(roundId);
    setError(null);
    try {
      await restoreRound(roundId);
      setRounds(prev => prev && prev.map(r => (r.id === roundId ? { ...r, status: "completed" } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't restore the round");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (roundId: string) => {
    setBusyId(roundId);
    setError(null);
    try {
      await deleteRound(roundId);
      setRounds(prev => prev && prev.filter(r => r.id !== roundId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the round");
    } finally {
      setBusyId(null);
      setPending(null);
    }
  };

  if (error) {
    return (
      <div className="mx-5 mt-4 p-3 bg-flag/10 border border-flag/30 rounded-xl text-[12.5px] text-flag">
        {error}
      </div>
    );
  }

  if (!rounds) {
    return <div className="px-5 pt-8 text-sm text-chalk-dim">Loading rounds…</div>;
  }

  const activeRounds = rounds.filter(r => r.status !== "archived");
  const archivedRounds = rounds.filter(r => r.status === "archived");

  const renderRow = (r: RoundSummary, opts: { faded?: boolean; onRestore?: boolean } = {}) => {
    const isPendingHere = pending?.id === r.id;
    return (
      <div key={r.id} className="flex items-center gap-2 mb-2">
        <Link
          href={`/trip/${tripId}/round/${r.id}/leaderboard`}
          className={`flex-1 flex items-center justify-between p-3.5 bg-surface border border-[color:var(--border)] rounded-xl min-w-0 ${
            opts.faded ? "opacity-70" : ""
          }`}
        >
          <div className="font-semibold text-[14px]">{formatDate(r.date)}</div>
          <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${STATUS_STYLE[r.status] ?? ""}`}>
            {STATUS_LABEL[r.status] ?? r.status}
          </span>
        </Link>

        {isPendingHere ? (
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => (pending.action === "archive" ? handleArchive(r.id) : handleDelete(r.id))}
              disabled={busyId === r.id}
              className="text-[11px] font-bold px-2.5 py-2 rounded-lg bg-flag/15 text-flag disabled:opacity-60"
            >
              {busyId === r.id ? "…" : pending.action === "archive" ? "Confirm" : "Delete"}
            </button>
            <button
              onClick={() => setPending(null)}
              className="text-[11px] font-bold px-2.5 py-2 rounded-lg bg-surface border border-[color:var(--border)] text-chalk-dim"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-1 flex-shrink-0">
            {opts.onRestore && (
              <button
                onClick={() => handleRestore(r.id)}
                disabled={busyId === r.id}
                className="text-[11px] font-bold px-2.5 py-2 rounded-lg bg-surface border border-[color:var(--border)] text-chalk-dim disabled:opacity-60"
              >
                {busyId === r.id ? "…" : "Restore"}
              </button>
            )}
            {!opts.onRestore && (
              <button
                onClick={() => setPending({ id: r.id, action: "archive" })}
                className="text-[11px] font-bold px-2.5 py-2 rounded-lg bg-surface border border-[color:var(--border)] text-chalk-dim"
              >
                Archive
              </button>
            )}
            <button
              onClick={() => setPending({ id: r.id, action: "delete" })}
              className="text-[11px] font-bold px-2.5 py-2 rounded-lg bg-surface border border-[color:var(--border)] text-flag"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="px-5 pt-4 pb-8">
      {activeRounds.length === 0 ? (
        <p className="text-[13px] text-chalk-dim text-center py-6">No rounds yet.</p>
      ) : (
        activeRounds.map(r => renderRow(r))
      )}

      {archivedRounds.length > 0 && (
        <div className="mt-5">
          <button
            onClick={() => setShowArchived(s => !s)}
            className="text-[12.5px] font-semibold text-chalk-dim underline"
          >
            {showArchived ? "Hide" : "Show"} archived ({archivedRounds.length})
          </button>

          {showArchived && (
            <div className="mt-3">
              {archivedRounds.map(r => renderRow(r, { faded: true, onRestore: true }))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
