-- Corrected follow-up to add-admin-pin.sql. The column-level revoke
-- didn't work because `anon`/`authenticated` hold a TABLE-level
-- SELECT grant on trips (visible in information_schema.table_privileges)
-- — a table-level grant already implies every column, and a
-- column-level REVOKE can't carve an exception out of that; it only
-- matters for roles that *don't* already have table-wide access.
--
-- The correct fix goes the other direction: revoke the blanket
-- table-level SELECT, then re-grant it column-by-column, leaving
-- trip_admin_pin out of the list. RLS's "open read" policy still
-- governs row visibility as before — this only narrows which columns
-- are selectable at all. Safe to re-run.

revoke select on public.trips from anon, authenticated;

grant select (id, name, start_date, end_date, created_by, created_at)
  on public.trips to anon, authenticated;

notify pgrst, 'reload schema';

-- Verify — first two should return `false` (pin hash hidden), the
-- third should return `true` (everything else on trips still
-- readable, just not this column).
select
  has_column_privilege('anon', 'public.trips', 'trip_admin_pin', 'select') as anon_can_still_read_pin,
  has_column_privilege('authenticated', 'public.trips', 'trip_admin_pin', 'select') as authenticated_can_still_read_pin,
  has_column_privilege('anon', 'public.trips', 'name', 'select') as anon_can_still_read_name;
