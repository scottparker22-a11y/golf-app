-- ─────────────────────────────────────────────────────────────
-- AUTH, ROLES, SCOREKEEPER PERMISSIONS — Phase 0 (schema only)
--
-- Purely additive: new tables, new nullable columns, new helper
-- functions. Nothing here changes how the app behaves today — no
-- existing RLS policy is touched, the shared admin PIN keeps working
-- exactly as before, and hole_scores stays open-write until Phase 3
-- (a separate migration file, run only once real Scorekeeper accounts
-- exist and have been tested — see the plan this came from).
--
-- Run this once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- One row per logged-in person. auth_user_id is the Supabase Auth
-- identity (email/password, handled entirely by Supabase — no
-- password ever touches this or any other app table). username/
-- display_name are cosmetic only; login is by email (see the plan's
-- note on why "username or email" resolves to email under the hood).
create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null,
  email text,
  role text not null default 'player' check (role in ('admin', 'player')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Nullable — an existing golfer with no login keeps scoring/appearing
-- exactly as today. Only set once an admin links/invites them.
alter table players add column if not exists profile_id uuid references profiles(id);

-- Which trips a logged-in person belongs to. player_id is optional —
-- lets a login be linked to "the golfer named Mike" for display/
-- history purposes without requiring it (e.g. a future admin-only
-- account with no golfer record at all).
create table if not exists trip_members (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid not null references trips(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'invited', 'removed')),
  created_at timestamptz not null default now(),
  unique (trip_id, profile_id)
);

-- Scorekeeper is a permission tied to a round (and optionally one
-- group within it), not a global role — see groups.scorer_player_id,
-- the existing cosmetic-only precursor to this, which stays as-is.
-- group_id null = may score the whole round; set = only that group.
-- "active" lets an admin revoke access immediately (every write
-- re-checks this live — see can_score() below) without deleting the
-- assignment's history.
create table if not exists scorekeeper_assignments (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references rounds(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  assigned_by uuid references profiles(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Basic audit trail for who entered/last touched a score. The
-- existing `entered_by uuid references auth.users(id)` column is left
-- in place, unused (harmless) — these new profile-scoped columns are
-- what Phase 3's app code actually writes to, for consistency with
-- the rest of the app's identity model (profiles, not raw auth.users).
alter table hole_scores add column if not exists entered_by_profile uuid references profiles(id);
alter table hole_scores add column if not exists updated_by_profile uuid references profiles(id);
alter table hole_scores add column if not exists updated_at timestamptz;

-- High-value action log (score changes/deletes, scorekeeper assigned/
-- removed, admin added, round/player deleted, tournament config
-- changed, ...). No UI yet — the goal for now is just that the data
-- exists to query when something needs troubleshooting.
create table if not exists audit_log (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

-- ── RLS ─────────────────────────────────────────────────────────
-- Enabled with NO anon/authenticated policy at all for now — every
-- one of these tables is untouched by any app code until later
-- phases, so the safest default is "only the service-role key (used
-- server-side) can see or write these," full stop. Phase 1+ adds the
-- specific, narrow policies each table actually needs (a person
-- reading their own profile, an admin managing assignments, etc.).
alter table profiles enable row level security;
alter table trip_members enable row level security;
alter table scorekeeper_assignments enable row level security;
alter table audit_log enable row level security;

-- ── Role helper functions ────────────────────────────────────────
-- security definer: these run with the privileges of the function's
-- owner (not the calling user), so they can read profiles/
-- trip_members/scorekeeper_assignments regardless of those tables'
-- own (currently nonexistent) RLS policies for the calling role.
-- This is the standard, centralized way to keep role logic out of
-- every individual policy — nothing calls these yet (added now so
-- Phase 3's RLS policies have something ready to reference).

create or replace function is_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from profiles
    where auth_user_id = auth.uid() and role = 'admin' and active
  );
$$;

create or replace function current_profile_id() returns uuid
language sql security definer stable as $$
  select id from profiles where auth_user_id = auth.uid();
$$;

create or replace function is_trip_member(p_trip_id uuid) returns boolean
language sql security definer stable as $$
  select is_admin() or exists (
    select 1 from trip_members
    where trip_id = p_trip_id and profile_id = current_profile_id() and status = 'active'
  );
$$;

-- p_group_id may be null (a round with no groups yet, or a caller
-- checking round-level access only) — a whole-round assignment
-- (group_id is null on the assignment row) always covers it either way.
create or replace function can_score(p_round_id uuid, p_group_id uuid) returns boolean
language sql security definer stable as $$
  select is_admin() or exists (
    select 1 from scorekeeper_assignments sa
    where sa.round_id = p_round_id
      and sa.profile_id = current_profile_id()
      and sa.active
      and (sa.group_id is null or sa.group_id = p_group_id)
  );
$$;
