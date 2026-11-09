-- Fictional local demo family. Never put real names, schedules, or expenses here.
-- Password for every seeded login is local-dev-password. It is for local Docker only.

select test_support.create_user(
  'parent.a@example.com',
  '11111111-1111-4111-8111-111111111111',
  'Parent A'
);
select test_support.create_user(
  'parent.b@example.com',
  '22222222-2222-4222-8222-222222222222',
  'Parent B'
);
select test_support.create_user(
  'child@example.com',
  '33333333-3333-4333-8333-333333333333',
  'Child'
);
select test_support.create_user(
  'outsider@example.com',
  '44444444-4444-4444-8444-444444444444',
  'Outsider'
);

insert into public.families (id, name, timezone, default_currency, children_can_post, created_by)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Demo family',
  'Europe/Bucharest',
  'RON',
  true,
  '11111111-1111-4111-8111-111111111111'
);

insert into public.family_members (id, family_id, user_id, role, display_name, color, birthdate, status)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'parent', 'Parent A', 'teal', null, 'active'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'parent', 'Parent B', 'amber', null, 'active'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'child', 'Child', 'sky', '2018-04-12', 'active'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null, 'child', 'Younger child', 'violet', '2021-09-03', 'active');

insert into public.custody_patterns (
  family_id, name, starts_on, cycle_length_days, segments, handover_time, handover_location, is_active, created_by
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'week_on_week_off',
  date_trunc('week', now())::date,
  14,
  public.custody_preset_segments(
    'week_on_week_off',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02'
  ),
  '18:00',
  'School gate',
  true,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'
);

select public.generate_handovers(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  now()::date,
  now()::date + 60
);

insert into public.events (
  id, family_id, kind, title, starts_at, ends_at, all_day, visibility, status, created_by
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'child_event',
  'Football practice',
  date_trunc('day', now()) + interval '16 hours',
  date_trunc('day', now()) + interval '17 hours',
  false,
  'family',
  'confirmed',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'
);

insert into public.event_children (family_id, event_id, child_member_id)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03'
);

insert into public.expenses (
  id, family_id, created_by, category, title, amount_minor, currency, spent_on, paid_by_member_id
) values (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
  'activities',
  'Football boots',
  25000,
  'RON',
  now()::date,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'
);

insert into public.posts (id, family_id, author_member_id, body, audience, happened_on)
values (
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
  'A quiet afternoon at the park.',
  'family',
  now()::date
);
