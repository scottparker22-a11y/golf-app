"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createRound, fetchRounds, type RoundSummary } from "@/lib/rounds";

const STATUS_STYLE: Record<string, string> = {
  in_progress: "bg-turf/15 text-turf",
  completed: "bg-surface-raised text-chalk-dim",
  upcoming: "bg-sand/15 text-sand",
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
  completed: "Completed",
  upcoming: "Upcoming",
};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function RoundsList({ tripId, tripDbId }: { tripId: string; tripDbId: string }) {
  const router = useRouter();
  const [rounds, setRounds] = useState<RoundSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchRounds(tripDbId)
      .then(setRounds)
      .catch(e => setError(e instanceof Error ? e.message : "Couldn't load rounds"));
  }, [tripDbId]);

  const startNewRound = async () => {
    if (!rounds || rounds.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const newRoundId = await createRound(tripDbId, rounds[0].id);
      router.push(`/trip/${tripId}/round/${newRoundId}/scorecard`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start a new round");
      setCreating(false);
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

  return (
    <div className="px-5 pt-4 pb-8">
      <button
        onClick={startNewRound}
        disabled={creating || rounds.length === 0}
        className="w-full mb-4 py-3.5 rounded-xl bg-turf text-fairway-950 font-bold text-[15px] disabled:opacity-60"
      >
        {creating ? "Starting…" : "+ Start new round"}
      </button>

      {rounds.length === 0 ? (
        <p className="text-[13px] text-chalk-dim text-center py-6">No rounds yet.</p>
      ) : (
        rounds.map(r => (
          <Link
            key={r.id}
            href={`/trip/${tripId}/round/${r.id}/leaderboard`}
            className="flex items-center justify-between p-3.5 bg-surface border border-[color:var(--border)] rounded-xl mb-2"
          >
            <div className="font-semibold text-[14px]">{formatDate(r.date)}</div>
            <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${STATUS_STYLE[r.status] ?? ""}`}>
              {STATUS_LABEL[r.status] ?? r.status}
            </span>
          </Link>
        ))
      )}
    </div>
  );
}
