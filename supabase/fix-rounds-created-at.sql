-- One-time fix for existing projects: `rounds` had no created_at
-- column, so several same-day rounds had no reliable "most recent"
-- ordering — this is what let "Start new round" grab the wrong round
-- to copy foursomes from. Safe to re-run.

alter table rounds add column if not exists created_at timestamptz not null default now();
