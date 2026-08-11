-- One-time fix for existing projects: "Start new round" needs to
-- insert/update rounds and insert groups/group_players, and the
-- Setup Wizard needs to insert players — the original schema.sql
-- only ever gave these tables a read policy. Safe to re-run.

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'rounds' and policyname = 'open write') then
    create policy "open write" on rounds for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'rounds' and policyname = 'open update') then
    create policy "open update" on rounds for update using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'groups' and policyname = 'open write') then
    create policy "open write" on groups for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'group_players' and policyname = 'open write') then
    create policy "open write" on group_players for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'players' and policyname = 'open write') then
    create policy "open write" on players for insert with check (true);
  end if;
end $$;
