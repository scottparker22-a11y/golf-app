-- ─────────────────────────────────────────────────────────────
-- CORE SCHEMA — golf scoring app
-- Everything downstream (leaderboards, game results) is derived
-- from hole_scores + games.config. Nothing is pre-computed here;
-- calculation lives in the app layer (see scoring-engine-sketch.ts)
-- so game logic can evolve without migrations.
-- ─────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- A buddy trip can span multiple rounds/courses/days
create table trips (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  start_date date,
  end_date date,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Course + hole data, reusable across rounds if you replay a course
create table courses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  location text
);

-- One row per hole per tee, since stroke index and yardage can
-- differ by tee even though par usually doesn't. tee_name matches
-- whatever the course database calls it ('Blue', 'White', 'Red'...).
create table holes (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references courses(id) on delete cascade,
  tee_name text not null default 'default',
  number int not null check (number between 1 and 18),
  par int not null,
  stroke_index int not null check (stroke_index between 1 and 18),
  yardage int,
  unique (course_id, tee_name, number)
);

-- One round = one day's play at one course, part of a trip.
-- Course/hole data (par, stroke index) is autofilled from the golf
-- course database (e.g. golfapi.io) once course + tee are picked —
-- see holes.tee_name below for the per-tee stroke index/par set.
create table rounds (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade,
  course_id uuid references courses(id),
  tee_name text not null default 'default', -- which tee this round's group played, joins to holes.tee_name
  date date not null,
  tee_time time,
  status text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'completed'))
);

-- Players — kept trip-scoped rather than global users for v1 simplicity.
-- Can link to an auth.users row later if players get their own logins.
create table players (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade,
  name text not null,
  handicap_index numeric(4,1)
);

-- Groups within a round (a foursome, a twosome, etc.)
create table groups (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid references rounds(id) on delete cascade,
  name text,
  scorer_player_id uuid references players(id)
);

create table group_players (
  group_id uuid references groups(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  primary key (group_id, player_id)
);

-- The single source of truth. team_id is nullable — set it only
-- for team-recorded formats (scramble, alt-shot) where one score
-- represents the whole team rather than an individual.
create table hole_scores (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references groups(id) on delete cascade,
  player_id uuid references players(id),
  team_id text, -- free-form team key, scoped to the round's game config
  hole_number int not null check (hole_number between 1 and 18),
  strokes int not null check (strokes > 0),
  entered_by uuid references auth.users(id),
  entered_at timestamptz default now(),
  unique (group_id, player_id, hole_number)
);

-- A Ryder Cup spans multiple rounds of the trip, unlike other games
-- which live entirely within one round. total_rounds is set by the
-- group (real Ryder Cups use 5 sessions over 3 days — most buddy
-- trips won't have that many rounds, so this is configurable).
create table ryder_cup_tournaments (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade,
  team_a_name text not null default 'Team A',
  team_b_name text not null default 'Team B',
  total_rounds int not null check (total_rounds > 0),
  created_at timestamptz default now()
);

-- One row per game active in a round. config holds everything
-- game-specific: stakes, teams, handicap toggle, etc.
-- ryder_cup config shape:
--   { sessions: [{ format: 'stroke_play'|'best_ball'|'scramble'|'alt_shot',
--                   sideA: [playerId,...], sideB: [playerId,...] }] }
-- Each session is worth 1 point (0.5/0.5 on a halve) toward the
-- team totals — computed in the app layer, not stored here.
-- For ryder_cup games, tournament_id links this round's sessions to
-- the cross-round tournament so points accumulate correctly.
create table games (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid references rounds(id) on delete cascade,
  type text not null check (type in
    ('skins', 'nassau', 'stableford', 'scramble', 'match_play', 'ryder_cup')),
  name text, -- display label, e.g. "$5 Skins" or "Saturday Nassau"
  tournament_id uuid references ryder_cup_tournaments(id), -- only set when type = 'ryder_cup'
  config jsonb not null default '{}'::jsonb
);

-- ── Realtime ─────────────────────────────────────────────────
-- Enable realtime on hole_scores so the leaderboard updates live
-- as the scorer enters strokes. Subscribe client-side per round
-- (filter on group_id in [...groups for this round]).
alter publication supabase_realtime add table hole_scores;

-- ── RLS (sketch — tighten before real users touch this) ───────
-- Supabase enables RLS by default on every new table (even ones this
-- file doesn't explicitly enable it on), so every table needs an
-- explicit read policy or the anon key sees nothing from it.
alter table trips enable row level security;
alter table courses enable row level security;
alter table holes enable row level security;
alter table rounds enable row level security;
alter table players enable row level security;
alter table groups enable row level security;
alter table group_players enable row level security;
alter table hole_scores enable row level security;
alter table games enable row level security;
alter table ryder_cup_tournaments enable row level security;

-- v1: anyone with a trip link can read/write (buddy trip, low stakes
-- on data security). Tighten to created_by / invited-player checks
-- before this goes beyond your friend group.
create policy "open read" on trips for select using (true);
create policy "open read" on courses for select using (true);
create policy "open read" on holes for select using (true);
create policy "open read" on rounds for select using (true);
create policy "open read" on players for select using (true);
create policy "open read" on groups for select using (true);
create policy "open read" on group_players for select using (true);
create policy "open read" on hole_scores for select using (true);
create policy "open read" on games for select using (true);
create policy "open read" on ryder_cup_tournaments for select using (true);

create policy "open write" on hole_scores for insert with check (true);
create policy "open update" on hole_scores for update using (true);
create policy "open delete" on hole_scores for delete using (true);

-- Starting a new round (see lib/rounds.ts) inserts a round + groups +
-- group_players, and marks the previous round completed. Finishing
-- the Setup Wizard also inserts new players for the roster entered.
create policy "open write" on rounds for insert with check (true);
create policy "open update" on rounds for update using (true);
create policy "open write" on groups for insert with check (true);
create policy "open write" on group_players for insert with check (true);
create policy "open write" on players for insert with check (true);
create policy "open update" on players for update using (true);

-- Adding a course to the queue (see lib/rounds.ts createCourse())
-- inserts a course + its standard 18 holes.
create policy "open write" on courses for insert with check (true);
create policy "open write" on holes for insert with check (true);
