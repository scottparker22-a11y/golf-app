-- One-time fix for existing projects: rounds.status only allowed
-- 'upcoming' | 'in_progress' | 'completed'. Archiving a round (see
-- lib/rounds.ts archiveRound/restoreRound, RoundsList.tsx) sets
-- status to 'archived', which needs to be a valid value. Safe to
-- re-run.

alter table rounds drop constraint if exists rounds_status_check;
alter table rounds add constraint rounds_status_check
  check (status in ('upcoming', 'in_progress', 'completed', 'archived'));
