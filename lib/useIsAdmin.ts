"use client";

// The single reusable client-side admin flag — the Admin button and
// the PIN screen both use this instead of scattering their own
// fetch()/cookie checks. Deliberately kept in its own file, separate
// from lib/adminAuth.ts (which pulls in Node's `crypto` and is
// server-only) so nothing here ever risks getting bundled into
// client JS.
//
// Mid-migration to real Supabase Auth (see lib/auth.ts): isAdmin is
// true if EITHER the legacy shared PIN cookie says so, OR a real
// logged-in Supabase Auth session has a profiles.role of 'admin'.
// Every consumer (AdminButton, AdminPinScreen) keeps working
// unchanged since they only ever see { isAdmin, loading } — once every
// admin has a real account and the PIN is retired, this drops the
// /api/admin/status half and keeps only the profile check.

import { useEffect, useState } from "react";
import { useProfile } from "./auth";

export function useIsAdmin() {
  const [pinAdmin, setPinAdmin] = useState(false);
  const [pinSet, setPinSet] = useState(true);
  const [pinLoading, setPinLoading] = useState(true);
  const { profile, loading: profileLoading } = useProfile();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/status")
      .then(res => res.json())
      .then((data: { isAdmin: boolean; pinSet: boolean }) => {
        if (cancelled) return;
        setPinAdmin(!!data.isAdmin);
        setPinSet(!!data.pinSet);
      })
      .catch(() => {
        // Non-fatal — treat as "not admin via PIN" and fall back to
        // the profile check below.
      })
      .finally(() => {
        if (!cancelled) setPinLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const profileAdmin = !!profile && profile.role === "admin" && profile.active;

  return {
    isAdmin: pinAdmin || profileAdmin,
    pinSet,
    loading: pinLoading || profileLoading,
  };
}
