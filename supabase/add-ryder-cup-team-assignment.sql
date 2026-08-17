-- Lets a Ryder Cup's team split (who's on Team A vs Team B) carry
-- over automatically to every round of the tournament instead of
-- being re-picked each round — see components/setup/TeamsStep.tsx
-- (locked once this is set) and lib/rounds.ts
-- fetchActiveRyderCupTournament. Run this once in the Supabase SQL
-- editor. Safe to re-run.

alter table ryder_cup_tournaments add column if not exists team_assignment jsonb;
