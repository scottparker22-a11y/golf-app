-- Lets a Tournament's course be planned per round up front (see
-- components/setup/FormatStep.tsx's "Course order" section) instead
-- of picking one course at a time every round. Run this once in the
-- Supabase SQL editor. Safe to re-run.

alter table tournaments add column if not exists course_order uuid[];
