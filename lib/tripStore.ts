"use client";

// ─────────────────────────────────────────────────────────────
// Interim score storage — saves hole-by-hole strokes to the
// browser's local storage, scoped per trip, so the Scorecard and
// Leaderboard pages agree on scores without a backend.
//
// This is NOT shared across devices — each phone/browser has its
// own copy. Real cross-device live sync needs the Supabase wiring
// described in lib/supabase.ts (see subscribeToHoleScores) and the
// TODOs in app/trip/[tripId]/leaderboard/page.tsx. Swap this file
// out for real Supabase reads/writes at that point; the HoleScore
// shape already matches the hole_scores table, so call sites here
// (setStroke/clearStroke) shouldn't need to change much.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import type { HoleScore } from "./types";

function storageKey(tripId: string) {
  return `golf-app:trip:${tripId}:holeScores`;
}

function readFromStorage(tripId: string): HoleScore[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(tripId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeToStorage(tripId: string, scores: HoleScore[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(tripId), JSON.stringify(scores));
  } catch {
    // storage full or unavailable — scores still work for this page
    // load, just won't persist across reloads.
  }
}

/**
 * Live-editable hole scores for a trip, backed by local storage.
 * Starts from `seedScores` (e.g. demo data) until the scorekeeper
 * enters real strokes, at which point local storage takes over.
 */
export function useHoleScores(tripId: string, seedScores: HoleScore[]) {
  const [holeScores, setHoleScores] = useState<HoleScore[]>(seedScores);

  // Local storage isn't available during server rendering, so load
  // the real saved scores after mount.
  useEffect(() => {
    const stored = readFromStorage(tripId);
    if (stored) setHoleScores(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const setStroke = useCallback(
    (groupId: string, playerId: string, holeNumber: number, strokes: number) => {
      setHoleScores(prev => {
        const idx = prev.findIndex(s => s.playerId === playerId && s.holeNumber === holeNumber);
        const next =
          idx === -1
            ? [...prev, { groupId, playerId, holeNumber, strokes }]
            : prev.map((s, i) => (i === idx ? { ...s, strokes } : s));
        writeToStorage(tripId, next);
        return next;
      });
    },
    [tripId]
  );

  const clearStroke = useCallback(
    (playerId: string, holeNumber: number) => {
      setHoleScores(prev => {
        const next = prev.filter(s => !(s.playerId === playerId && s.holeNumber === holeNumber));
        writeToStorage(tripId, next);
        return next;
      });
    },
    [tripId]
  );

  const resetToSeed = useCallback(() => {
    setHoleScores(seedScores);
    writeToStorage(tripId, seedScores);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, seedScores]);

  return { holeScores, setStroke, clearStroke, resetToSeed };
}
