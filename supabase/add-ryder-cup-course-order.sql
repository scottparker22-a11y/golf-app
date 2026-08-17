-- Lets a Ryder Cup's course be planned per round up front (see
-- components/setup/FormatStep.tsx's "Course order" section), same as
-- the Tournament's course order. Run this once in the Supabase SQL
-- editor. Safe to re-run.

alter table ryder_cup_tournaments add column if not exists course_order uuid[];
