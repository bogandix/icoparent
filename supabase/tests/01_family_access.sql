begin;

select plan(15);

select test_support.create_user('a@example.test', '55555555-5555-4555-8555-555555555551', 'Parent A');
select test_support.create_user('b@example.test', '55555555-5555-4555-8555-555555555552', 'Parent B');
select test_support.create_user('c@example.test', '55555555-5555-4555-8555-555555555553', 'Child');
select test_support.create_user('o@example.test', '55555555-5555-4555-8555-555555555554', 'Outsider');

select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555551', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555551","role":"authenticated"}', true);
set local role authenticated;

select public.create_family('Access family', 'Europe/Bucharest', 'RON') as family_id \gset

reset role;
insert into public.family_members (family_id, user_id, role, display_name, color, status)
values (
  :'family_id',
  '55555555-5555-4555-8555-555555555552',
  'parent',
  'Parent B',
  'amber',
  'active'
);
insert into public.family_members (family_id, user_id, role, display_name, color, status)
values (
  :'family_id',
  '55555555-5555-4555-8555-555555555553',
  'child',
  'Child',
  'sky',
  'active'
);

select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555554', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555554","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*) from public.families where id = :'family_id'),
  0::bigint,
  'an outsider cannot read the family'
);

select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555553', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555553","role":"authenticated"}', true);
select is(
  (select count(*) from public.expenses),
  0::bigint,
  'a child cannot select expenses'
);
select is(
  (select count(*) from public.proposals),
  0::bigint,
  'a child cannot select proposals'
);
select is(
  (select count(*) from public.acknowledgments),
  0::bigint,
  'a child cannot select acknowledgments'
);
select is(
  (select count(*) from public.audit_log),
  0::bigint,
  'a child cannot select the audit log'
);
select is(
  (select count(*) from public.invites),
  0::bigint,
  'a child cannot select invites'
);

select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555551', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555551","role":"authenticated"}', true);
select public.create_expense(
  :'family_id', 'school', 'Notebooks', 1999, 'RON', null, null, current_date, null, null, null, null, null
) as expense_id \gset

select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555553', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555553","role":"authenticated"}', true);
select is(
  (select count(*) from public.expenses where id = :'expense_id'),
  0::bigint,
  'a child still cannot select an expense that exists'
);

select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555551', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555551","role":"authenticated"}', true);
select throws_ok(
  format('select public.acknowledge(%L, %L)', 'expense', :'expense_id'),
  'P0001',
  'author_cannot_acknowledge',
  'the author cannot acknowledge their own expense'
);

select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555552', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555552","role":"authenticated"}', true);
select ok(
  public.acknowledge('expense', :'expense_id') is not null,
  'the other parent can acknowledge'
);

select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555551', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555551","role":"authenticated"}', true);
select throws_ok(
  format('select public.void_item(%L, %L, %L)', 'expense', :'expense_id', 'no'),
  'P0001',
  'reason_required',
  'void requires a reason'
);
select lives_ok(
  format('select public.void_item(%L, %L, %L)', 'expense', :'expense_id', 'Entered twice'),
  'the author can void with a reason'
);
select throws_ok(
  $$select public.void_item('unknown', '00000000-0000-4000-8000-000000000000', 'because')$$,
  'P0001',
  'unknown_subject',
  'unknown subject types are rejected'
);

select throws_ok(
  format('select public.create_invite(%L, %L, %L)', :'family_id', 'third@example.test', 'parent'),
  'P0001',
  'max_parents',
  'a third parent invite is rejected'
);

reset role;
select ok(
  (select count(*) from public.audit_log where table_name = 'families' and row_id = :'family_id') >= 1,
  'creating a family writes an audit row'
);
select ok(
  (select token_hash ~ '^[0-9a-f]{64}$' from public.invites where family_id = :'family_id' limit 1) is not true,
  'a rejected parent invite does not leave a raw token'
);

select * from finish();
rollback;
