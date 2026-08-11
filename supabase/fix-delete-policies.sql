-- One-time fix for existing projects: deleting a player or course
-- from the Setup Wizard needs delete permission on players, courses,
-- and holes (holes needs it too so a course's cascade-delete of its
-- holes actually goes through). Safe to re-run.

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'players' and policyname = 'open delete') then
    create policy "open delete" on players for delete using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'courses' and policyname = 'open delete') then
    create policy "open delete" on courses for delete using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'holes' and policyname = 'open delete') then
    create policy "open delete" on holes for delete using (true);
  end if;
end $$;
