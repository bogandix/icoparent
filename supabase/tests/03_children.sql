begin;

select plan(9);

select test_support.create_user('ca@example.test', '66666666-6666-4666-8666-666666666661', 'Parent A');
select test_support.create_user('cb@example.test', '66666666-6666-4666-8666-666666666662', 'Parent B');
select test_support.create_user('cc@example.test', '66666666-6666-4666-8666-666666666663', 'Child');
select test_support.create_user('co@example.test', '66666666-6666-4666-8666-666666666664', 'Outsider');

select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666661', true);
select set_config('request.jwt.claims', '{"sub":"66666666-6666-4666-8666-666666666661","role":"authenticated"}', true);
set local role authenticated;
select public.create_family('Children family', 'Europe/Bucharest', 'RON') as family_id \gset

reset role;
insert into public.family_members (family_id, user_id, role, display_name, color, status) values
  (:'family_id', '66666666-6666-4666-8666-666666666662', 'parent', 'Parent B', 'amber', 'active'),
  (:'family_id', '66666666-6666-4666-8666-666666666663', 'child', 'Logged-in child', 'sky', 'active');

-- Parent A adds a child.
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666661', true);
select set_config('request.jwt.claims', '{"sub":"66666666-6666-4666-8666-666666666661","role":"authenticated"}', true);
set local role authenticated;
select public.add_child(:'family_id', 'Ana', null, 'sky') as ana_id \gset

select throws_ok(
  format('select public.add_child(%L, %L, null, %L)', :'family_id', '  ana ', 'sky'),
  'P0001',
  'child_duplicate',
  'a duplicate name (case and spaces ignored) is rejected'
);

-- Parent B can remove the child; it is marked left, not deleted.
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666662', true);
select set_config('request.jwt.claims', '{"sub":"66666666-6666-4666-8666-666666666662","role":"authenticated"}', true);
select lives_ok(
  format('select public.remove_child(%L, %L)', :'family_id', :'ana_id'),
  'the other parent can remove a child'
);
select throws_ok(
  format('select public.remove_child(%L, %L)', :'family_id', :'ana_id'),
  'P0001',
  'child_not_found',
  'removing twice is rejected'
);
select throws_ok(
  format('select public.remove_child(%L, public.current_member_id(%L))', :'family_id', :'family_id'),
  'P0001',
  'child_not_found',
  'a parent cannot be removed with remove_child'
);

-- After removal the name can be used again.
select lives_ok(
  format('select public.add_child(%L, %L, null, %L)', :'family_id', 'Ana', 'sky'),
  'a removed child name can be added again'
);

-- Child and outsider cannot add or remove.
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666663', true);
select set_config('request.jwt.claims', '{"sub":"66666666-6666-4666-8666-666666666663","role":"authenticated"}', true);
select throws_ok(
  format('select public.add_child(%L, %L, null, %L)', :'family_id', 'Ion', 'sky'),
  'P0001',
  'not_family_parent',
  'a child cannot add a child'
);
select throws_ok(
  format('select public.remove_child(%L, %L)', :'family_id', :'ana_id'),
  'P0001',
  'not_family_parent',
  'a child cannot remove a child'
);

select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666664', true);
select set_config('request.jwt.claims', '{"sub":"66666666-6666-4666-8666-666666666664","role":"authenticated"}', true);
select throws_ok(
  format('select public.remove_child(%L, %L)', :'family_id', :'ana_id'),
  'P0001',
  'not_family_parent',
  'an outsider cannot remove a child'
);

reset role;
select is(
  (select status from public.family_members where id = :'ana_id'),
  'left',
  'the removed child row still exists with status left'
);

select * from finish();
rollback;
