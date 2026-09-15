"use client";

// Thin wrapper around Supabase Auth — email/password login, logout,
// password reset, plus the two hooks the rest of the app needs:
// useSession() (raw auth state) and useProfile() (the logged-in
// person's row in `profiles`, including their role). Session
// persistence/refresh is handled entirely by the supabase-js client
// itself (localStorage + autoRefreshToken, both on by default in
// lib/supabase.ts) — nothing extra to wire up for that.
//
// See lib/useIsAdmin.ts for how this combines with the (still-active,
// during the migration) admin-PIN cookie to decide "is this person an
// admin" without regressing anyone before their account exists.

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Profile = {
  id: string;
  authUserId: string;
  username: string | null;
  displayName: string;
  email: string | null;
  role: "admin" | "player";
  active: boolean;
};

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

/**
 * Open self-signup — anyone can create their own account (role
 * defaults to 'player', set server-side by the on_auth_user_created
 * trigger in supabase/add-auth-phase3-self-signup.sql, never trusted
 * from the client). Returns true if a session was created
 * immediately (email confirmation off), false if Supabase requires
 * confirming the email first.
 */
export async function signUpWithPassword(
  email: string,
  password: string,
  displayName: string
): Promise<{ confirmedImmediately: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw new Error(error.message);
  return { confirmedImmediately: !!data.session };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
  });
  if (error) throw new Error(error.message);
}

/** Raw Supabase Auth session — null while logged out or still loading. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

/**
 * The logged-in person's `profiles` row — null while logged out, has
 * no profile yet, or still loading. Requires the "read own profile"
 * RLS policy (see supabase/add-auth-phase1-policies.sql) since this
 * reads with the user's own session, not a service-role key.
 */
export function useProfile() {
  const { session, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("profiles")
      .select("id, auth_user_id, username, display_name, email, role, active")
      .eq("auth_user_id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setProfile(null);
        } else {
          setProfile({
            id: data.id,
            authUserId: data.auth_user_id,
            username: data.username,
            displayName: data.display_name,
            email: data.email,
            role: data.role,
            active: data.active,
          });
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, sessionLoading]);

  return { profile, loading: sessionLoading || loading };
}
