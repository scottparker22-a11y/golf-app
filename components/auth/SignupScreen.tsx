"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signUpWithPassword } from "@/lib/auth";
import PageNav from "@/components/PageNav";

// Open self-signup — anyone landing here without a login can create
// their own account on the spot (name, email, password). The account
// starts as a plain 'player' (see the on_auth_user_created trigger in
// supabase/add-auth-phase3-self-signup.sql — role is set server-side,
// never trusted from this form). Being able to actually enter scores
// still requires an admin to grant Scorekeeper access separately (see
// the Scorekeepers page) — this screen only gets someone logged in.
export default function SignupScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const { confirmedImmediately } = await signUpWithPassword(email.trim(), password, displayName);
      if (confirmedImmediately) {
        router.push(next);
      } else {
        setNeedsConfirmation(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the account");
      setSubmitting(false);
    }
  };

  const canSubmit =
    firstName.trim().length > 0 && lastName.trim().length > 0 && email.trim().length > 0 && password.length > 0;

  if (needsConfirmation) {
    return (
      <main className="max-w-[460px] mx-auto min-h-screen pb-10">
        <PageNav />
        <div className="px-5 pt-10 flex flex-col items-center text-center">
          <h1 className="font-display font-extrabold text-2xl mb-3">Check your email</h1>
          <p className="text-[13px] text-chalk-dim leading-relaxed max-w-[300px]">
            We sent a confirmation link to {email}. Tap it, then come back and log in.
          </p>
          <Link href="/login" className="mt-6 text-[13px] font-bold text-turf underline">
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-[460px] mx-auto min-h-screen pb-10">
      <PageNav />
      <div className="px-5 pt-10 flex flex-col items-center text-center">
        <h1 className="font-display font-extrabold text-3xl mb-1">PAR-ker</h1>
        <p className="text-[13px] text-chalk-dim leading-relaxed mb-8">Create your account</p>

        <div className="w-full max-w-[300px] text-left">
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-1.5">
                First Name
              </label>
              <input
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-3 py-3 text-[15px] outline-none focus:border-turf"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-3 py-3 text-[15px] outline-none focus:border-turf"
              />
            </div>
          </div>

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
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full mb-4 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-3 py-3 text-[15px] outline-none focus:border-turf"
          />

          <label className="block text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-1.5">
            Confirm Password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && canSubmit && !submitting) handleSignup();
            }}
            className="w-full mb-4 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-3 py-3 text-[15px] outline-none focus:border-turf"
          />

          {error && <p className="text-[12.5px] text-flag mb-3 leading-relaxed">{error}</p>}

          <button
            onClick={handleSignup}
            disabled={!canSubmit || submitting}
            className="w-full py-3.5 rounded-xl bg-turf text-fairway-950 font-bold text-[15px] disabled:opacity-60 mb-3"
          >
            {submitting ? "…" : "Create Account"}
          </button>

          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="block text-center text-[12.5px] font-semibold text-chalk-dim underline"
          >
            Already have an account? Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
