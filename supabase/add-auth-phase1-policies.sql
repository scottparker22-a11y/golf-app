-- ─────────────────────────────────────────────────────────────
-- AUTH, ROLES, SCOREKEEPER PERMISSIONS — Phase 1 (login)
--
-- Adds the one thing a logged-in person actually needs to read for
-- login to work end to end: their own profiles row (for lib/auth.ts's
-- useProfile(), which drives role-based nav/useIsAdmin). Everything
-- else about profiles stays locked to the service-role key — an
-- authenticated user can see their own row and nothing else's, and
-- cannot write to profiles at all (role changes, invites, and
-- deactivation stay strictly server-side via the service-role key,
-- same as every other admin-gated table in this app).
--
-- Run this once in the Supabase SQL editor, after
-- add-auth-and-roles.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'profiles' and policyname = 'read own profile'
  ) then
    create policy "read own profile" on profiles for select using (auth_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'profiles' and policyname = 'admin reads all profiles'
  ) then
    create policy "admin reads all profiles" on profiles for select using (is_admin());
  end if;
end $$;
