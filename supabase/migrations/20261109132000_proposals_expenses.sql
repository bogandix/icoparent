-- Proposal engine, expenses, and the effects of an accepted proposal.

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  kind text not null check (kind in ('blocker_request', 'custody_swap', 'decision', 'event_change')),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  body text,
  payload jsonb not null default '{}'::jsonb,
  amount_minor bigint,
  currency char(3),
  subject_type text,
  subject_id uuid,
  created_by uuid not null references public.family_members (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'countered', 'expired', 'withdrawn')),
  expires_at timestamptz not null,
  parent_proposal_id uuid references public.proposals (id),
  resolved_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.proposal_responses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  proposal_id uuid not null references public.proposals (id),
  member_id uuid not null references public.family_members (id),
  response text not null check (response in ('accept', 'decline', 'counter')),
  comment text,
  counter_proposal_id uuid references public.proposals (id),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  created_by uuid not null references public.family_members (id),
  category text not null check (category in ('school', 'clothes', 'health', 'activities', 'toys', 'trips', 'food', 'other')),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null,
  original_amount_minor bigint,
  original_currency char(3),
  spent_on date not null,
  merchant text,
  note text,
  paid_by_member_id uuid references public.family_members (id),
  status text not null default 'recorded' check (status in ('recorded', 'voided')),
  version int not null default 1,
  supersedes_id uuid,
  superseded_by uuid,
  decision_proposal_id uuid references public.proposals (id),
  void_reason text,
  created_at timestamptz not null default now(),
  unique (id, family_id)
);

create table public.expense_children (
  family_id uuid not null,
  expense_id uuid not null,
  child_member_id uuid not null,
  primary key (expense_id, child_member_id),
  foreign key (expense_id, family_id) references public.expenses (id, family_id),
  foreign key (child_member_id, family_id) references public.family_members (id, family_id)
);

alter table public.proposals enable row level security;
alter table public.proposals force row level security;
alter table public.proposal_responses enable row level security;
alter table public.proposal_responses force row level security;
alter table public.expenses enable row level security;
alter table public.expenses force row level security;
alter table public.expense_children enable row level security;
alter table public.expense_children force row level security;

create policy proposals_select_parents on public.proposals
  for select to authenticated using (public.is_family_parent(family_id));
create policy proposal_responses_select_parents on public.proposal_responses
  for select to authenticated using (public.is_family_parent(family_id));
create policy expenses_select_parents on public.expenses
  for select to authenticated using (public.is_family_parent(family_id));
create policy expense_children_select_parents on public.expense_children
  for select to authenticated using (public.is_family_parent(family_id));

create trigger audit_proposals after insert or update on public.proposals
  for each row execute function public.write_audit_log();
create trigger audit_proposal_responses after insert on public.proposal_responses
  for each row execute function public.write_audit_log();
create trigger audit_expenses after insert or update on public.expenses
  for each row execute function public.write_audit_log();

create or replace function public.other_parent_member(p_family uuid, p_me uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.family_members
  where family_id = p_family and role = 'parent' and status = 'active' and id <> p_me
  limit 1;
$$;

create or replace function public.apply_proposal_effect(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals%rowtype;
  range jsonb;
  patch jsonb;
begin
  select * into prop from public.proposals where id = p_id;
  if prop.kind = 'blocker_request' then
    update public.events
    set status = 'confirmed'
    where id = (prop.payload->>'event_id')::uuid;
    insert into public.custody_exceptions (family_id, starts_at, ends_at, parent_member_id, proposal_id, reason)
    values (
      prop.family_id,
      (prop.payload->>'starts_at')::timestamptz,
      (prop.payload->>'ends_at')::timestamptz,
      public.other_parent_member(prop.family_id, prop.created_by),
      prop.id,
      'blocker_request'
    );
    perform public.generate_handovers(prop.family_id, ((prop.payload->>'starts_at')::timestamptz)::date, ((prop.payload->>'ends_at')::timestamptz)::date + 1);
  elsif prop.kind = 'custody_swap' then
    for range in select value from jsonb_array_elements(coalesce(prop.payload->'ranges', '[]'::jsonb)) loop
      insert into public.custody_exceptions (family_id, starts_at, ends_at, parent_member_id, proposal_id, reason)
      values (
        prop.family_id,
        (range->>'starts_at')::timestamptz,
        (range->>'ends_at')::timestamptz,
        (range->>'parent_member_id')::uuid,
        prop.id,
        'custody_swap'
      );
    end loop;
    perform public.generate_handovers(prop.family_id, now()::date, now()::date + 60);
  elsif prop.kind = 'event_change' then
    patch := coalesce(prop.payload->'patch', '{}'::jsonb);
    update public.events
    set title = coalesce(patch->>'title', title),
        location = coalesce(patch->>'location', location),
        starts_at = coalesce((patch->>'starts_at')::timestamptz, starts_at),
        ends_at = coalesce((patch->>'ends_at')::timestamptz, ends_at),
        status = coalesce(patch->>'status', status)
    where id = (prop.payload->>'event_id')::uuid;
  elsif prop.kind = 'decision' and prop.payload->>'action' = 'set_custody_pattern' then
    perform public.apply_custody_pattern(
      prop.family_id,
      prop.payload->>'name',
      (prop.payload->>'starts_on')::date,
      prop.payload->>'preset',
      prop.payload->'segments',
      (prop.payload->>'handover_time')::time,
      prop.payload->>'handover_location',
      prop.created_by
    );
  end if;
end;
$$;

create or replace function public.create_proposal(
  p_family_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_payload jsonb,
  p_amount_minor bigint,
  p_currency text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_member_id(p_family_id);
  pid uuid;
  eid uuid;
  event_author uuid;
begin
  if not public.is_family_parent(p_family_id) then
    perform public.raise_app('not_family_parent');
  end if;
  if p_kind not in ('blocker_request', 'custody_swap', 'decision', 'event_change') then
    perform public.raise_app('invalid_proposal_kind');
  end if;

  if p_kind = 'blocker_request' then
    eid := public.create_event(
      p_family_id,
      'parent_blocker',
      btrim(p_title),
      p_body,
      (p_payload->>'starts_at')::timestamptz,
      (p_payload->>'ends_at')::timestamptz,
      false,
      null,
      p_payload->>'location',
      'parents',
      coalesce(
        (select array_agg(value::uuid) from jsonb_array_elements_text(coalesce(p_payload->'child_ids', '[]'::jsonb))),
        '{}'::uuid[]
      )
    );
    update public.events set status = 'pending' where id = eid;
    p_payload := coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('event_id', eid);
  elsif p_kind = 'event_change' then
    select created_by into event_author from public.events where id = (p_payload->>'event_id')::uuid;
    if event_author is null then
      perform public.raise_app('not_found');
    end if;
    if event_author = me then
      perform public.raise_app('author_edits_directly');
    end if;
  end if;

  insert into public.proposals (
    family_id, kind, title, body, payload, amount_minor, currency, created_by, status, expires_at,
    subject_type, subject_id
  ) values (
    p_family_id, p_kind, btrim(p_title), p_body, coalesce(p_payload, '{}'::jsonb),
    p_amount_minor, nullif(p_currency, '')::char(3), me, 'pending', now() + interval '7 days',
    case when p_kind = 'event_change' then 'event' when p_kind = 'blocker_request' then 'event' else null end,
    coalesce(eid, nullif(p_payload->>'event_id', '')::uuid)
  )
  returning id into pid;

  perform public.notify_member(
    p_family_id,
    public.other_parent_member(p_family_id, me),
    'proposal.pending',
    '/agreements/' || pid::text,
    jsonb_build_object('proposalId', pid, 'kind', p_kind, 'title', btrim(p_title))
  );
  return pid;
end;
$$;

create or replace function public.respond_to_proposal(
  p_id uuid,
  p_response text,
  p_comment text,
  p_counter jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals%rowtype;
  me uuid;
  new_id uuid;
  event_author uuid;
begin
  select * into prop from public.proposals where id = p_id for update;
  if not found then
    perform public.raise_app('not_found');
  end if;
  if not public.is_family_parent(prop.family_id) then
    perform public.raise_app('not_family_parent');
  end if;
  me := public.current_member_id(prop.family_id);
  if me = prop.created_by then
    perform public.raise_app('author_cannot_respond');
  end if;
  if prop.status <> 'pending' then
    perform public.raise_app('proposal_not_pending');
  end if;
  if prop.expires_at <= now() then
    update public.proposals set status = 'expired', resolved_at = now() where id = prop.id;
    perform public.raise_app('proposal_expired');
  end if;
  if p_response not in ('accept', 'decline', 'counter') then
    perform public.raise_app('invalid_response');
  end if;
  if prop.parent_proposal_id is not null and p_response = 'counter' then
    perform public.raise_app('counter_of_counter');
  end if;
  if prop.kind = 'event_change' then
    select created_by into event_author from public.events where id = (prop.payload->>'event_id')::uuid;
    if event_author <> me then
      perform public.raise_app('event_author_must_approve');
    end if;
  end if;

  if p_response = 'counter' then
    if p_counter is null then
      perform public.raise_app('counter_required');
    end if;
    insert into public.proposals (
      family_id, kind, title, body, payload, amount_minor, currency, subject_type, subject_id,
      created_by, status, expires_at, parent_proposal_id
    ) values (
      prop.family_id, prop.kind,
      coalesce(p_counter->>'title', prop.title),
      coalesce(p_counter->>'body', prop.body),
      coalesce(p_counter->'payload', prop.payload),
      coalesce((p_counter->>'amount_minor')::bigint, prop.amount_minor),
      coalesce(nullif(p_counter->>'currency', '')::char(3), prop.currency),
      prop.subject_type, prop.subject_id, me, 'pending', now() + interval '7 days', prop.id
    )
    returning id into new_id;
  end if;

  insert into public.proposal_responses (family_id, proposal_id, member_id, response, comment, counter_proposal_id)
  values (prop.family_id, prop.id, me, p_response, nullif(btrim(coalesce(p_comment, '')), ''), new_id);

  if p_response = 'accept' then
    update public.proposals set status = 'accepted', resolved_at = now() where id = prop.id;
    perform public.apply_proposal_effect(prop.id);
  elsif p_response = 'decline' then
    update public.proposals set status = 'declined', resolved_at = now() where id = prop.id;
    if prop.kind = 'blocker_request' then
      update public.events set status = 'voided', void_reason = 'proposal_declined'
      where id = (prop.payload->>'event_id')::uuid;
    end if;
  else
    update public.proposals set status = 'countered', resolved_at = now() where id = prop.id;
  end if;

  perform public.notify_member(
    prop.family_id, prop.created_by, 'proposal.' || p_response,
    '/agreements/' || coalesce(new_id, prop.id)::text,
    jsonb_build_object('proposalId', coalesce(new_id, prop.id), 'kind', prop.kind, 'title', prop.title)
  );
  return coalesce(new_id, prop.id);
end;
$$;

create or replace function public.withdraw_proposal(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals%rowtype;
  me uuid;
begin
  select * into prop from public.proposals where id = p_id for update;
  if not found then
    perform public.raise_app('not_found');
  end if;
  me := public.current_member_id(prop.family_id);
  if me is null or me <> prop.created_by then
    perform public.raise_app('author_only');
  end if;
  if prop.status <> 'pending' then
    perform public.raise_app('proposal_not_pending');
  end if;
  update public.proposals set status = 'withdrawn', resolved_at = now() where id = prop.id;
  if prop.kind = 'blocker_request' then
    update public.events set status = 'voided', void_reason = 'proposal_withdrawn'
    where id = (prop.payload->>'event_id')::uuid;
  end if;
  perform public.notify_member(
    prop.family_id,
    public.other_parent_member(prop.family_id, me),
    'proposal.withdrawn',
    '/agreements/' || prop.id::text,
    jsonb_build_object('proposalId', prop.id, 'kind', prop.kind, 'title', prop.title)
  );
end;
$$;

create or replace function public.create_expense(
  p_family_id uuid,
  p_category text,
  p_title text,
  p_amount_minor bigint,
  p_currency text,
  p_original_amount_minor bigint,
  p_original_currency text,
  p_spent_on date,
  p_merchant text,
  p_note text,
  p_paid_by uuid,
  p_child_ids uuid[],
  p_decision_proposal_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_member_id(p_family_id);
  eid uuid;
  child uuid;
begin
  if not public.is_family_parent(p_family_id) then
    perform public.raise_app('not_family_parent');
  end if;
  if p_category not in ('school', 'clothes', 'health', 'activities', 'toys', 'trips', 'food', 'other') then
    perform public.raise_app('invalid_category');
  end if;
  insert into public.expenses (
    family_id, created_by, category, title, amount_minor, currency, original_amount_minor, original_currency,
    spent_on, merchant, note, paid_by_member_id, decision_proposal_id
  ) values (
    p_family_id, me, p_category, btrim(p_title), p_amount_minor, upper(p_currency)::char(3),
    p_original_amount_minor, nullif(upper(coalesce(p_original_currency, '')), '')::char(3),
    p_spent_on, p_merchant, p_note, coalesce(p_paid_by, me), p_decision_proposal_id
  )
  returning id into eid;
  if p_child_ids is not null then
    foreach child in array p_child_ids loop
      insert into public.expense_children (family_id, expense_id, child_member_id)
      values (p_family_id, eid, child);
    end loop;
  end if;
  perform public.notify_member(
    p_family_id, public.other_parent_member(p_family_id, me), 'expense.created',
    '/money/' || eid::text, jsonb_build_object('expenseId', eid, 'title', btrim(p_title), 'amountMinor', p_amount_minor, 'currency', upper(p_currency))
  );
  return eid;
end;
$$;

create or replace function public.edit_expense(p_id uuid, p_patch jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  exp public.expenses%rowtype;
  me uuid;
  new_id uuid;
  acknowledged boolean;
begin
  select * into exp from public.expenses where id = p_id for update;
  if not found then
    perform public.raise_app('not_found');
  end if;
  me := public.current_member_id(exp.family_id);
  if me is null or me <> exp.created_by then
    perform public.raise_app('author_only');
  end if;
  select exists (
    select 1 from public.acknowledgments where subject_type = 'expense' and subject_id = exp.id
  ) into acknowledged;

  if not acknowledged then
    update public.expenses
    set title = coalesce(p_patch->>'title', title),
        category = coalesce(p_patch->>'category', category),
        amount_minor = coalesce((p_patch->>'amount_minor')::bigint, amount_minor),
        note = coalesce(p_patch->>'note', note),
        merchant = coalesce(p_patch->>'merchant', merchant),
        spent_on = coalesce((p_patch->>'spent_on')::date, spent_on)
    where id = exp.id;
    return exp.id;
  end if;

  insert into public.expenses (
    family_id, created_by, category, title, amount_minor, currency, original_amount_minor, original_currency,
    spent_on, merchant, note, paid_by_member_id, status, version, supersedes_id, decision_proposal_id
  ) values (
    exp.family_id, exp.created_by,
    coalesce(p_patch->>'category', exp.category),
    coalesce(p_patch->>'title', exp.title),
    coalesce((p_patch->>'amount_minor')::bigint, exp.amount_minor),
    exp.currency, exp.original_amount_minor, exp.original_currency,
    coalesce((p_patch->>'spent_on')::date, exp.spent_on),
    coalesce(p_patch->>'merchant', exp.merchant),
    coalesce(p_patch->>'note', exp.note),
    exp.paid_by_member_id, 'recorded', exp.version + 1, exp.id, exp.decision_proposal_id
  )
  returning id into new_id;
  update public.expenses set superseded_by = new_id where id = exp.id;
  insert into public.expense_children (family_id, expense_id, child_member_id)
  select family_id, new_id, child_member_id from public.expense_children where expense_id = exp.id;
  return new_id;
end;
$$;

revoke all on function public.other_parent_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.apply_proposal_effect(uuid) from public, anon, authenticated;
revoke all on function public.create_proposal(uuid, text, text, text, jsonb, bigint, text) from public, anon;
revoke all on function public.respond_to_proposal(uuid, text, text, jsonb) from public, anon;
revoke all on function public.withdraw_proposal(uuid) from public, anon;
revoke all on function public.create_expense(uuid, text, text, bigint, text, bigint, text, date, text, text, uuid, uuid[], uuid) from public, anon;
revoke all on function public.edit_expense(uuid, jsonb) from public, anon;
grant execute on function public.create_proposal(uuid, text, text, text, jsonb, bigint, text) to authenticated;
grant execute on function public.respond_to_proposal(uuid, text, text, jsonb) to authenticated;
grant execute on function public.withdraw_proposal(uuid) to authenticated;
grant execute on function public.create_expense(uuid, text, text, bigint, text, bigint, text, date, text, text, uuid, uuid[], uuid) to authenticated;
grant execute on function public.edit_expense(uuid, jsonb) to authenticated;
