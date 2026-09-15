"use client";

// The single reusable client-side admin flag — every consumer
// (AdminButton, ScorekeepersLink, RoundsList's pin-toggle, ...) just
// sees { isAdmin, loading }. Now purely profiles.role = 'admin' on
// the logged-in Supabase Auth session — the legacy shared PIN cookie
// this used to also check has been retired now that every admin has
// their own real login (see lib/auth.ts's useProfile()).

import { useProfile } from "./auth";

export function useIsAdmin() {
  const { profile, loading } = useProfile();
  const isAdmin = !!profile && profile.role === "admin" && profile.active;
  return { isAdmin, loading };
}
