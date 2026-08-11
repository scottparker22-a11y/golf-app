-- One-time fix for existing projects: Supabase enables Row Level
-- Security by default on new tables, but the original schema.sql
-- only added read policies for some tables. This adds the missing
-- ones for courses, holes, and group_players. Safe to re-run.

alter table courses enable row level security;
alter table holes enable row level security;
alter table group_players enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'courses' and policyname = 'open read') then
    create policy "open read" on courses for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'holes' and policyname = 'open read') then
    create policy "open read" on holes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'group_players' and policyname = 'open read') then
    create policy "open read" on group_players for select using (true);
  end if;
end $$;
