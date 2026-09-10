-- ─────────────────────────────────────────────────────────────
-- AUTH, ROLES, SCOREKEEPER PERMISSIONS — Phase 2 (assignment UI)
--
-- Lets a real logged-in admin manage scorekeeper_assignments directly
-- from their own session (is_admin(), from add-auth-and-roles.sql) —
-- unlike the legacy PIN-gated tables, this is a brand-new table, so
-- there's no separate /api/admin/* route needed for it; the admin's
-- own RLS-checked session is the enforcement, same idea as
-- "admin reads all profiles" from Phase 1.
--
-- hole_scores/games write access is untouched here — Scorekeeper
-- assignments can be created and tested well before Phase 3 actually
-- makes them mean anything for score entry.
--
-- Run this once in the Supabase SQL editor, after
-- add-auth-phase1-policies.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'scorekeeper_assignments' and policyname = 'admin manages scorekeeper_assignments'
  ) then
    create policy "admin manages scorekeeper_assignments" on scorekeeper_assignments
      for all using (is_admin()) with check (is_admin());
  end if;
end $$;
