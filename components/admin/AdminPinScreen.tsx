"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIsAdmin } from "@/lib/useIsAdmin";
import PageNav from "@/components/PageNav";

// 4-digit numeric PIN entry — one input, letter-spaced to read as 4
// digit slots. Simpler and more robust than a 4-box OTP widget, and
// matches the scorecard's existing plain numeric inputs
// (components/Scorecard.tsx) rather than introducing a new pattern.
function PinInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-1.5">
        {label}
      </label>
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autoComplete="off"
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="w-full bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-3 py-3 text-center font-mono text-[26px] tracking-[0.6em] outline-none focus:border-turf"
      />
    </div>
  );
}

export default function AdminPinScreen({ tripId }: { tripId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || `/trip/${tripId}/setup`;

  const { pinSet, loading } = useIsAdmin();

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetPin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, confirmPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't set the PIN");
      router.push(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't set the PIN");
      setSubmitting(false);
    }
  };

  const handleLogin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Wrong PIN");
      router.push(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wrong PIN");
      setPin("");
      setSubmitting(false);
    }
  };

  const canSubmit = pinSet ? pin.length === 4 : pin.length === 4 && confirmPin.length === 4;

  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <PageNav />
      <div className="px-5 pt-10 flex flex-col items-center text-center">
        <h1 className="font-display font-extrabold text-2xl mb-1.5">
          {loading ? "Admin" : pinSet ? "Enter admin PIN" : "Set admin PIN"}
        </h1>
        <p className="text-[13px] text-chalk-dim leading-relaxed mb-6 max-w-[320px]">
          {loading
            ? "Checking…"
            : pinSet
              ? "Unlock this browser to manage Trip Setup — courses, players, foursomes, and games."
              : "No admin PIN exists yet for this trip. Set one now — anyone who knows it can manage Trip Setup from their own browser."}
        </p>

        {!loading && (
          <div className="w-full max-w-[280px]">
            <PinInput value={pin} onChange={setPin} label={pinSet ? "PIN" : "New PIN"} />
            {!pinSet && <PinInput value={confirmPin} onChange={setConfirmPin} label="Confirm PIN" />}

            {error && <p className="text-[12.5px] text-flag mb-3 leading-relaxed">{error}</p>}

            <button
              onClick={pinSet ? handleLogin : handleSetPin}
              disabled={!canSubmit || submitting}
              className="w-full py-3.5 rounded-xl bg-turf text-fairway-950 font-bold text-[15px] disabled:opacity-60"
            >
              {submitting ? "…" : pinSet ? "Unlock" : "Set PIN"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
