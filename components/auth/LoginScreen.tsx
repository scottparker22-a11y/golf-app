"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { requestPasswordReset, signInWithPassword } from "@/lib/auth";
import PageNav from "@/components/PageNav";

// Mobile-friendly login screen — same visual language as the rest of
// the app (font-display headline, turf primary button, PageNav up
// top) rather than a generic auth-library look. Login is by email —
// see lib/auth.ts's file comment for why "username" stays a cosmetic
// display name instead of a second login path. Accounts themselves
// are admin-provisioned (see the Scorekeeper/invite flow) — this
// screen only signs an existing account in, it doesn't create one.
export default function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await signInWithPassword(email.trim(), password);
      router.push(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't log in");
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email above first, then tap Forgot Password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setResetSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the reset email");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <PageNav />
      <div className="px-5 pt-10 flex flex-col items-center text-center">
        <h1 className="font-display font-extrabold text-3xl mb-1">PAR-ker</h1>
        <p className="text-[13px] text-chalk-dim leading-relaxed mb-8">Score Keeper</p>

        <div className="w-full max-w-[300px] text-left">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-1.5">
            Email
          </label>
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full mb-4 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-3 py-3 text-[15px] outline-none focus:border-turf"
          />

          <label className="block text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-1.5">
            Password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && canSubmit && !submitting) handleLogin();
            }}
            className="w-full mb-4 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-3 py-3 text-[15px] outline-none focus:border-turf"
          />

          {error && <p className="text-[12.5px] text-flag mb-3 leading-relaxed">{error}</p>}
          {resetSent && (
            <p className="text-[12.5px] text-turf mb-3 leading-relaxed">
              Check your email for a password reset link.
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={!canSubmit || submitting}
            className="w-full py-3.5 rounded-xl bg-turf text-fairway-950 font-bold text-[15px] disabled:opacity-60 mb-3"
          >
            {submitting ? "…" : "Log In"}
          </button>

          <button
            onClick={handleForgotPassword}
            disabled={submitting}
            className="w-full text-center text-[12.5px] font-semibold text-chalk-dim underline disabled:opacity-60 mb-4"
          >
            Forgot Password
          </button>

          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            className="block text-center text-[12.5px] font-semibold text-turf underline"
          >
            New here? Create an account
          </Link>
        </div>
      </div>
    </main>
  );
}
