-- Lets an admin manually pin which round the un-scoped "Live
-- Leaderboard"/"Enter Scores" links (app/trip/[tripId]/leaderboard
-- and .../scorecard) land on, overriding the automatic
-- in_progress/upcoming-based pick in lib/rounds.ts fetchCurrentRoundId.
-- `on delete set null` so deleting the pinned round just clears the
-- pin instead of being blocked by it.
--
-- Written by an admin-only API route (service-role client, bypasses
-- RLS — see app/api/admin/current-round/route.ts), same as every
-- other trips write. Read access needs its own grant since trips
-- moved to column-level allowlisting for anon/authenticated (see
-- fix-hide-admin-pin-column.sql) — any new column is invisible to the
-- public API until explicitly granted. Safe to re-run.

alter table trips add column if not exists current_round_id uuid references rounds(id) on delete set null;

grant select (current_round_id) on public.trips to anon, authenticated;

notify pgrst, 'reload schema';
