-- One-time fix for existing projects: setting up the Skins game
-- (Trip Setup's new Skins step) inserts into `games`, which only had
-- a read policy so far. Safe to re-run.

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'games' and policyname = 'open write') then
    create policy "open write" on games for insert with check (true);
  end if;
end $$;
