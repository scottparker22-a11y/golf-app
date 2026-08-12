-- One-time fix for existing projects: `games` had no update policy
-- (Skins config is written once and never edited, so it was never
-- needed before). The new Ryder Cup feature edits its games row for
-- manual match overrides and pairing changes (see lib/rounds.ts
-- updateRyderCupGame). Safe to re-run.

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'games' and policyname = 'open update') then
    create policy "open update" on games for update using (true);
  end if;
end $$;
