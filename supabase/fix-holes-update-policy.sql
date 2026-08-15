-- One-time fix for existing projects: `holes` only had "insert" and
-- "delete" policies (set up when a course is created/removed) — never
-- an "update" one, since editing a hole's par/stroke index after the
-- fact was never needed before. Needed now to correct par values on
-- an existing course (e.g. Royal St. Patrick) without deleting and
-- recreating it. Safe to re-run.

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'holes' and policyname = 'open update') then
    create policy "open update" on holes for update using (true);
  end if;
end $$;
