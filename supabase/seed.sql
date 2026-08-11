-- ─────────────────────────────────────────────────────────────
-- DEMO TRIP SEED DATA
-- Fixed IDs so the app's code can reference this exact trip/round
-- without needing a full "create a trip" flow yet. Run this once,
-- after schema.sql, in the Supabase SQL editor.
--
-- Safe to re-run: each insert is ON CONFLICT DO NOTHING, so running
-- it twice won't create duplicates.
-- ─────────────────────────────────────────────────────────────

-- schema.sql originally shipped without a delete policy for
-- hole_scores (needed for clearing a mis-entered score). Add it here
-- so existing projects pick it up; harmless if it already exists.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'hole_scores' and policyname = 'open delete'
  ) then
    create policy "open delete" on hole_scores for delete using (true);
  end if;
end $$;

insert into trips (id, name, start_date, end_date) values
  ('a0000000-0000-0000-0000-000000000001', 'Demo Trip', current_date, current_date)
on conflict (id) do nothing;

insert into courses (id, name, location) values
  ('c0000000-0000-0000-0000-000000000001', 'Demo Course', 'Nowhere, USA')
on conflict (id) do nothing;

insert into rounds (id, trip_id, course_id, tee_name, date, status) values
  ('d0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'default', current_date, 'in_progress')
on conflict (id) do nothing;

-- 18 holes, front 9 odd stroke indexes / back 9 even — same layout
-- as the old lib/demoData.ts.
insert into holes (course_id, tee_name, number, par, stroke_index) values
  ('c0000000-0000-0000-0000-000000000001', 'default', 1, 4, 7),
  ('c0000000-0000-0000-0000-000000000001', 'default', 2, 3, 15),
  ('c0000000-0000-0000-0000-000000000001', 'default', 3, 5, 3),
  ('c0000000-0000-0000-0000-000000000001', 'default', 4, 4, 11),
  ('c0000000-0000-0000-0000-000000000001', 'default', 5, 4, 1),
  ('c0000000-0000-0000-0000-000000000001', 'default', 6, 3, 17),
  ('c0000000-0000-0000-0000-000000000001', 'default', 7, 4, 9),
  ('c0000000-0000-0000-0000-000000000001', 'default', 8, 5, 5),
  ('c0000000-0000-0000-0000-000000000001', 'default', 9, 4, 13),
  ('c0000000-0000-0000-0000-000000000001', 'default', 10, 4, 8),
  ('c0000000-0000-0000-0000-000000000001', 'default', 11, 3, 16),
  ('c0000000-0000-0000-0000-000000000001', 'default', 12, 5, 4),
  ('c0000000-0000-0000-0000-000000000001', 'default', 13, 4, 12),
  ('c0000000-0000-0000-0000-000000000001', 'default', 14, 4, 2),
  ('c0000000-0000-0000-0000-000000000001', 'default', 15, 3, 18),
  ('c0000000-0000-0000-0000-000000000001', 'default', 16, 4, 10),
  ('c0000000-0000-0000-0000-000000000001', 'default', 17, 5, 6),
  ('c0000000-0000-0000-0000-000000000001', 'default', 18, 4, 14)
on conflict (course_id, tee_name, number) do nothing;

-- Players — same roster/handicaps as the old demo data.
insert into players (id, trip_id, name, handicap_index) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'Mike Reyes', 8.4),
  ('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000001', 'Tom Wagner', 12.1),
  ('33333333-3333-3333-3333-333333333333', 'a0000000-0000-0000-0000-000000000001', 'Scott Parker', 10.6),
  ('44444444-4444-4444-4444-444444444444', 'a0000000-0000-0000-0000-000000000001', 'Will Robinson', 14.2),
  ('55555555-5555-5555-5555-555555555555', 'a0000000-0000-0000-0000-000000000001', 'Dave Chen', 6.9),
  ('66666666-6666-6666-6666-666666666666', 'a0000000-0000-0000-0000-000000000001', 'Jake Pruitt', 7.8)
on conflict (id) do nothing;

-- Groups (twosomes) for the round.
insert into groups (id, round_id, name) values
  ('77777777-7777-7777-7777-777777777771', 'd0000000-0000-0000-0000-000000000001', 'Mike & Tom'),
  ('77777777-7777-7777-7777-777777777772', 'd0000000-0000-0000-0000-000000000001', 'Scott & Will'),
  ('77777777-7777-7777-7777-777777777773', 'd0000000-0000-0000-0000-000000000001', 'Dave & Jake')
on conflict (id) do nothing;

insert into group_players (group_id, player_id) values
  ('77777777-7777-7777-7777-777777777771', '11111111-1111-1111-1111-111111111111'),
  ('77777777-7777-7777-7777-777777777771', '22222222-2222-2222-2222-222222222222'),
  ('77777777-7777-7777-7777-777777777772', '33333333-3333-3333-3333-333333333333'),
  ('77777777-7777-7777-7777-777777777772', '44444444-4444-4444-4444-444444444444'),
  ('77777777-7777-7777-7777-777777777773', '55555555-5555-5555-5555-555555555555'),
  ('77777777-7777-7777-7777-777777777773', '66666666-6666-6666-6666-666666666666')
on conflict (group_id, player_id) do nothing;

-- No hole_scores seeded — the round starts fresh with nobody's
-- strokes entered yet, ready for live scoring.
