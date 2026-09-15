-- ─────────────────────────────────────────────────────────────
-- AUTH, ROLES, SCOREKEEPER PERMISSIONS — Phase 3a (open self-signup
-- + login required to view anything)
--
-- Two things:
--
-- 1. Anyone can create their own account (see app/signup) — a
--    Postgres trigger auto-creates their `profiles` row the moment
--    Supabase Auth creates the underlying user, always as role
--    'player' (never trusted from the signup form itself — see
--    components/auth/SignupScreen.tsx). Covers both self-signup and
--    an admin creating someone directly in the Supabase Dashboard.
--    This makes the profiles-provisioning half of
--    app/api/admin/invite-player's own upsert redundant for brand
--    new accounts, but harmless — that route still runs afterward
--    and corrects display_name to the actual player's name.
--
-- 2. Every table that was "open read using (true)" now requires a
--    real logged-in session (auth.uid() is not null) — this is the
--    actual enforcement behind the new site-wide login wall
--    (components/auth/AuthGate.tsx); the wall alone is just UI, this
--    is what stops a direct, unauthenticated API call. There's only
--    one trip in this app in practice, so "logged in at all" and
--    "a member of this trip" are the same thing for now — a full
--    per-trip trip_members check can replace this later if the app
--    ever hosts more than one trip.
--
-- hole_scores INSERT/UPDATE/DELETE and games UPDATE are NOT touched
-- here — still open to any authenticated write, same as before. That
-- lockdown (Scorekeeper-only writes) is a separate, later migration,
-- deliberately held until a real Scorekeeper account has been tested.
--
-- Run this once in the Supabase SQL editor, after
-- add-auth-phase2-policies.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Auto-provision a profile for every new Supabase Auth user ──
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer as $$
begin
  insert into public.profiles (auth_user_id, display_name, email, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    'player',
    true
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ── 2. Reads require a real session ────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'trips', 'courses', 'holes', 'rounds', 'players', 'groups',
    'group_players', 'hole_scores', 'games', 'ryder_cup_tournaments',
    'tournaments'
  ]
  loop
    execute format('drop policy if exists %I on %I', 'open read', t);
    if not exists (
      select 1 from pg_policies where tablename = t and policyname = 'authenticated read'
    ) then
      execute format(
        'create policy %I on %I for select using (auth.uid() is not null)',
        'authenticated read', t
      );
    end if;
  end loop;
end $$;
