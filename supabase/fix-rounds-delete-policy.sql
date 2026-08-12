-- One-time fix for existing projects: `rounds` had no delete policy
-- (deliberately, at first — rounds used to only ever be archived, not
-- deleted). Round History now has a Delete button for rounds created
-- by mistake (see lib/rounds.ts deleteRound, RoundsList.tsx), which
-- needs this policy or PostgREST just silently no-ops the delete.
-- Safe to re-run.

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'rounds' and policyname = 'open delete') then
    create policy "open delete" on rounds for delete using (true);
  end if;
end $$;
