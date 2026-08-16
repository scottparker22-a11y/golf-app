-- Adds optional per-round stats tracking — Fairways Hit, Greens in
-- Regulation, and Putts — set per round in the Setup Wizard's new
-- Stats step (components/setup/RoundsStep.tsx) and entered per hole
-- on the Scorecard (components/Scorecard.tsx) when it's on. Rolled up
-- for an end-of-round summary by lib/scoring.ts calculateRoundStats.
--
-- No RLS/grant changes needed: hole_scores already has fully open
-- insert/update policies, and rounds writes already go through the
-- admin-gated /api/admin/round route (service-role client, bypasses
-- RLS) — both tables just get new columns, covered automatically.
-- Safe to re-run.

alter table rounds add column if not exists track_stats boolean not null default false;

alter table hole_scores add column if not exists fairway_hit boolean;
alter table hole_scores add column if not exists gir boolean;
alter table hole_scores add column if not exists putts int;
