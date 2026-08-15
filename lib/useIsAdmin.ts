"use client";

// The single reusable client-side admin flag — the Admin button and
// the PIN screen both use this instead of scattering their own
// fetch()/cookie checks. Deliberately kept in its own file, separate
// from lib/adminAuth.ts (which pulls in Node's `crypto` and is
// server-only) so nothing here ever risks getting bundled into
// client JS.
//
// Swapping to real Supabase Auth later: point this at
// supabase.auth.getSession() (or similar) instead of
// /api/admin/status — every consumer (AdminButton, AdminPinScreen)
// keeps working unchanged since they only ever see { isAdmin, loading }.

import { useEffect, useState } from "react";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinSet, setPinSet] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/status")
      .then(res => res.json())
      .then((data: { isAdmin: boolean; pinSet: boolean }) => {
        if (cancelled) return;
        setIsAdmin(!!data.isAdmin);
        setPinSet(!!data.pinSet);
      })
      .catch(() => {
        // Non-fatal — treat as "not admin" and let the PIN screen
        // handle it from there.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { isAdmin, pinSet, loading };
}
