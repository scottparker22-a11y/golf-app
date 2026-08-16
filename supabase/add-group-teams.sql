-- Wires up data the Setup Wizard's Foursomes step (FoursomesStep.tsx)
-- already collects but never persisted: each foursome's format
-- (Stroke Play/Best Ball/Scramble/Alt Shot), whether Stroke Play
-- opted into "Teams of 2", and which of the two teammate pairs each
-- player is on. Used by the Leaderboard's Team view and the
-- Scorecard's Players/Teams toggle to show 2-man team scores instead
-- of a whole-foursome blob, for Best Ball and Stroke Play (+ pairs)
-- — see lib/scoring.ts calculateTwoManTeamStandings.
--
-- No RLS/grant changes needed: groups/group_players writes already
-- go through the admin API (service-role client, bypasses RLS), and
-- reads are already row-level "open" (using (true)), which covers
-- new columns automatically. Safe to re-run.

alter table groups add column if not exists format text not null default 'stroke_play'
  check (format in ('stroke_play', 'best_ball', 'scramble', 'alt_shot'));

alter table groups add column if not exists stroke_play_teams text not null default 'none'
  check (stroke_play_teams in ('none', 'pairs'));

alter table group_players add column if not exists pairing text
  check (pairing in ('1', '2'));
