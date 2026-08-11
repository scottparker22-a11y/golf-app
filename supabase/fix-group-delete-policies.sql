-- One-time fix for existing projects: fixing a broken round's
-- foursomes requires deleting groups/group_players, which had no
-- delete policy yet. Safe to re-run.

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'groups' and policyname = 'open delete') then
    create policy "open delete" on groups for delete using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'group_players' and policyname = 'open delete') then
    create policy "open delete" on group_players for delete using (true);
  end if;
end $$;
