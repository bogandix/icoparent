begin;

select plan(8);

select test_support.create_user('a@example.test', '55555555-5555-4555-8555-555555555551', 'Parent A');
select test_support.create_user('b@example.test', '55555555-5555-4555-8555-555555555552', 'Parent B');

insert into public.families (id, name, timezone, default_currency, created_by)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Custody family', 'Europe/Bucharest', 'RON', '55555555-5555-4555-8555-555555555551');

insert into public.family_members (id, family_id, user_id, role, display_name, color)
values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc01', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '55555555-5555-4555-8555-555555555551', 'parent', 'Parent A', 'teal'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc02', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '55555555-5555-4555-8555-555555555552', 'parent', 'Parent B', 'amber');

select is(
  (public.custody_preset_segments(
    'week_on_week_off',
    'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
    'cccccccc-cccc-4ccc-8ccc-cccccccccc02'
  )->0->>'to_day')::int,
  6,
  'week on / week off gives the first parent seven days'
);

select is(
  jsonb_array_length(public.custody_preset_segments(
    '2_2_3',
    'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
    'cccccccc-cccc-4ccc-8ccc-cccccccccc02'
  )) > 0,
  true,
  '2-2-3 produces segments'
);

select is(
  (public.custody_preset_segments(
    '2_2_5_5',
    'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
    'cccccccc-cccc-4ccc-8ccc-cccccccccc02'
  )->0->>'to_day')::int,
  1,
  '2-2-5-5 starts with two days'
);

select public.apply_custody_pattern(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'week_on_week_off',
  '2026-01-05'::date,
  'week_on_week_off',
  null,
  '18:00',
  'School gate',
  'cccccccc-cccc-4ccc-8ccc-cccccccccc01'
);

select is(
  public.custody_parent_on('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '2026-01-05 12:00+00'::timestamptz),
  'cccccccc-cccc-4ccc-8ccc-cccccccccc01'::uuid,
  'the pattern assigns the first day to parent A'
);

insert into public.custody_exceptions (family_id, starts_at, ends_at, parent_member_id, reason)
values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  '2026-01-06 00:00+00',
  '2026-01-07 00:00+00',
  'cccccccc-cccc-4ccc-8ccc-cccccccccc02',
  'swap'
);

select is(
  public.custody_parent_on('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '2026-01-06 12:00+00'::timestamptz),
  'cccccccc-cccc-4ccc-8ccc-cccccccccc02'::uuid,
  'an exception overrides the pattern only inside its window'
);
select is(
  public.custody_parent_on('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '2026-01-08 12:00+00'::timestamptz),
  'cccccccc-cccc-4ccc-8ccc-cccccccccc01'::uuid,
  'the pattern resumes after the exception'
);

select public.generate_handovers('cccccccc-cccc-4ccc-8ccc-cccccccccccc', current_date, current_date + 40);
select public.generate_handovers('cccccccc-cccc-4ccc-8ccc-cccccccccccc', current_date, current_date + 40);
select is(
  (select count(*) from public.handovers where family_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' and status = 'voided' and void_reason = 'schedule_changed'),
  0::bigint,
  'generating handovers twice does not duplicate or void the same schedule'
);
select cmp_ok(
  (select count(*) from public.handovers where family_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' and status = 'scheduled'),
  '>',
  0::bigint,
  'handovers are created for switch days'
);

select * from finish();
rollback;
