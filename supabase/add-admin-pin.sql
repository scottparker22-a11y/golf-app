-- Adds admin-PIN gating for Trip Setup. trip_admin_pin stores a
-- bcrypt hash of a 4-digit PIN — never plaintext — set via the app's
-- "Set admin PIN" screen (see app/api/admin/set-pin/route.ts).
--
-- This also locks down every admin-only table (players, groups,
-- group_players, rounds, courses, holes, and games' insert policy —
-- games' update policy is deliberately left alone, since Ryder Cup
-- mid-round overrides stay open) so the anon key the browser uses can
-- no longer write to them directly. From here on, the only way to
-- write to these tables is through the app's own /api/admin/* Route
-- Handlers, which check the signed admin session cookie (see
-- lib/adminAuth.ts) and then write using the service-role key — that
-- key never reaches the browser.
--
-- hole_scores is untouched — stays open to whoever's scorekeeping, as
-- before (see lib/liveRound.ts). ryder_cup_tournaments already had no
-- write policy and no code writes to it, so there's nothing to change
-- there. Safe to re-run.

alter table trips add column if not exists trip_admin_pin text;

-- Hide the PIN hash from the public API entirely. RLS is row-level
-- only — it can't hide a single column — so even with "open read" on
-- trips, a leaked bcrypt hash of a 4-digit PIN is trivially
-- brute-forced offline. Only the service-role key (used server-side
-- in app/api/admin/*) can still read this column.
revoke select (trip_admin_pin) on trips from anon, authenticated;

drop policy if exists "open write" on players;
drop policy if exists "open update" on players;
drop policy if exists "open delete" on players;

drop policy if exists "open write" on groups;
drop policy if exists "open delete" on groups;

drop policy if exists "open write" on group_players;
drop policy if exists "open delete" on group_players;

drop policy if exists "open write" on rounds;
drop policy if exists "open update" on rounds;
drop policy if exists "open delete" on rounds;

drop policy if exists "open write" on courses;
drop policy if exists "open delete" on courses;

drop policy if exists "open write" on holes;
drop policy if exists "open update" on holes;
drop policy if exists "open delete" on holes;

-- games' "open update" policy is intentionally NOT dropped — the
-- Ryder Cup board's mid-round match overrides (updateRyderCupGame in
-- lib/rounds.ts) still write directly with the anon key.
drop policy if exists "open write" on games;
