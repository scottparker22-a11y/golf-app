-- Multi-round Tournament support (Stroke Play / Stableford), alongside
-- the existing Ryder Cup (ryder_cup_tournaments, unchanged by this file).
-- Run this once in the Supabase SQL editor. Safe to re-run.

create table if not exists tournaments (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id) on delete cascade,
  format text not null default 'stroke_play' check (format in ('stroke_play', 'stableford')),
  total_rounds int not null check (total_rounds > 0),
  uses_handicap boolean not null default false,
  created_at timestamptz default now()
);

alter table rounds add column if not exists tournament_id uuid references tournaments(id);

alter table tournaments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'tournaments' and policyname = 'open read'
  ) then
    create policy "open read" on tournaments for select using (true);
  end if;
end $$;
