-- One-time fix for existing projects: the new Course step (add a
-- course to the queue) inserts into courses + holes, and editing an
-- existing roster player's handicap updates players — none of which
-- had a write policy yet. Safe to re-run.

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'courses' and policyname = 'open write') then
    create policy "open write" on courses for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'holes' and policyname = 'open write') then
    create policy "open write" on holes for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'players' and policyname = 'open update') then
    create policy "open update" on players for update using (true);
  end if;
end $$;
