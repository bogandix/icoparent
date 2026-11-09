-- Calendar events, custody pattern, generated handovers, and check-ins.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  kind text not null check (kind in ('child_event', 'parent_blocker', 'family_event')),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  notes text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  rrule text,
  location text,
  visibility text not null default 'family' check (visibility in ('family', 'parents')),
  status text not null default 'confirmed' check (status in ('confirmed', 'pending', 'voided')),
  created_by uuid not null references public.family_members (id),
  void_reason text,
  version int not null default 1,
  supersedes_id uuid,
  superseded_by uuid,
  created_at timestamptz not null default now(),
  unique (id, family_id),
  check (ends_at > starts_at)
);

create table public.event_children (
  family_id uuid not null,
  event_id uuid not null,
  child_member_id uuid not null,
  primary key (event_id, child_member_id),
  foreign key (event_id, family_id) references public.events (id, family_id),
  foreign key (child_member_id, family_id) references public.family_members (id, family_id)
);

create table public.custody_patterns (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  name text not null,
  starts_on date not null,
  cycle_length_days int not null check (cycle_length_days > 0),
  segments jsonb not null,
  handover_time time not null default '18:00',
  handover_location text,
  is_active boolean not null default true,
  created_by uuid not null references public.family_members (id),
  created_at timestamptz not null default now()
);

create unique index custody_one_active_pattern
  on public.custody_patterns (family_id)
  where is_active;

create table public.custody_exceptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  parent_member_id uuid not null references public.family_members (id),
  proposal_id uuid,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.handovers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  scheduled_at timestamptz not null,
  from_parent_id uuid not null references public.family_members (id),
  to_parent_id uuid not null references public.family_members (id),
  location text,
  source text not null check (source in ('pattern', 'exception', 'manual')),
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'missed', 'voided')),
  created_by uuid references public.family_members (id),
  void_reason text,
  created_at timestamptz not null default now()
);

create unique index handovers_one_live_slot
  on public.handovers (family_id, scheduled_at)
  where status <> 'voided';

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  handover_id uuid not null references public.handovers (id),
  actor_member_id uuid not null references public.family_members (id),
  kind text not null check (kind in ('dropoff', 'pickup', 'confirm')),
  at timestamptz not null default now(),
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  note text,
  created_at timestamptz not null default now()
);

alter table public.handovers add unique (id, family_id);
alter table public.checkins
  add foreign key (handover_id, family_id) references public.handovers (id, family_id);

alter table public.events enable row level security;
alter table public.events force row level security;
alter table public.event_children enable row level security;
alter table public.event_children force row level security;
alter table public.custody_patterns enable row level security;
alter table public.custody_patterns force row level security;
alter table public.custody_exceptions enable row level security;
alter table public.custody_exceptions force row level security;
alter table public.handovers enable row level security;
alter table public.handovers force row level security;
alter table public.checkins enable row level security;
alter table public.checkins force row level security;

create policy events_select on public.events
  for select to authenticated
  using (
    public.is_family_member(family_id)
    and (
      public.is_family_parent(family_id)
      or (visibility = 'family' and kind <> 'parent_blocker')
    )
  );

create policy event_children_select on public.event_children
  for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.family_id = event_children.family_id));

create policy custody_patterns_select on public.custody_patterns
  for select to authenticated
  using (public.is_family_member(family_id));

create policy custody_exceptions_select on public.custody_exceptions
  for select to authenticated
  using (public.is_family_parent(family_id));

create policy handovers_select on public.handovers
  for select to authenticated
  using (public.is_family_member(family_id));

create policy checkins_select on public.checkins
  for select to authenticated
  using (public.is_family_member(family_id));

create trigger audit_events after insert or update on public.events
  for each row execute function public.write_audit_log();
create trigger audit_custody_patterns after insert or update on public.custody_patterns
  for each row execute function public.write_audit_log();
create trigger audit_custody_exceptions after insert or update on public.custody_exceptions
  for each row execute function public.write_audit_log();
create trigger audit_handovers after insert or update on public.handovers
  for each row execute function public.write_audit_log();
create trigger audit_checkins after insert on public.checkins
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- Custody
-- ---------------------------------------------------------------------------

create or replace function public.custody_preset_segments(
  p_preset text,
  p_parent_a uuid,
  p_parent_b uuid
)
returns jsonb
language plpgsql
as $$
declare
  days int[];
  segments jsonb := '[]'::jsonb;
  i int;
  start_day int := 0;
  current_parent int;
  parent uuid;
begin
  days := case p_preset
    when 'week_on_week_off' then array[1,1,1,1,1,1,1, 2,2,2,2,2,2,2]
    when '2_2_3' then array[1,1,2,2,1,1,1, 2,2,1,1,2,2,2]
    when '2_2_5_5' then array[1,1,2,2,1,1,1,1,1, 2,2,2,2,2]
    -- 14 days from the pattern start. Weekends alternate, plus one midweek night.
    when 'alternate_weekends' then array[1,1,2,1,1,2,2, 1,1,1,2,1,1,1]
    else null
  end;
  if days is null then
    perform public.raise_app('unknown_preset');
  end if;

  current_parent := days[1];
  for i in 2..array_length(days, 1) loop
    if days[i] <> current_parent then
      parent := case when current_parent = 1 then p_parent_a else p_parent_b end;
      segments := segments || jsonb_build_array(jsonb_build_object(
        'from_day', start_day,
        'to_day', i - 2,
        'parent_member_id', parent
      ));
      start_day := i - 1;
      current_parent := days[i];
    end if;
  end loop;
  parent := case when current_parent = 1 then p_parent_a else p_parent_b end;
  segments := segments || jsonb_build_array(jsonb_build_object(
    'from_day', start_day,
    'to_day', array_length(days, 1) - 1,
    'parent_member_id', parent
  ));
  return segments;
end;
$$;

create or replace function public.custody_parent_on(p_family uuid, p_at timestamptz)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  fam_tz text;
  local_date date;
  pat public.custody_patterns%rowtype;
  day_index int;
  seg jsonb;
  exception_parent uuid;
begin
  select parent_member_id into exception_parent
  from public.custody_exceptions
  where family_id = p_family
    and p_at >= starts_at
    and p_at < ends_at
  order by starts_at desc
  limit 1;
  if exception_parent is not null then
    return exception_parent;
  end if;

  select * into pat
  from public.custody_patterns
  where family_id = p_family and is_active
  limit 1;
  if not found then
    return null;
  end if;

  select timezone into fam_tz from public.families where id = p_family;
  local_date := (p_at at time zone fam_tz)::date;
  if local_date < pat.starts_on then
    return null;
  end if;
  day_index := (local_date - pat.starts_on) % pat.cycle_length_days;

  for seg in select value from jsonb_array_elements(pat.segments) loop
    if day_index >= (seg->>'from_day')::int and day_index <= (seg->>'to_day')::int then
      return (seg->>'parent_member_id')::uuid;
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.apply_custody_pattern(
  p_family_id uuid,
  p_name text,
  p_starts_on date,
  p_preset text,
  p_segments jsonb,
  p_handover_time time,
  p_handover_location text,
  p_actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_a uuid;
  parent_b uuid;
  segments jsonb := p_segments;
  pattern_id uuid;
begin
  select id into parent_a
  from public.family_members
  where family_id = p_family_id and role = 'parent' and status = 'active'
  order by created_at
  limit 1;
  select id into parent_b
  from public.family_members
  where family_id = p_family_id and role = 'parent' and status = 'active' and id <> parent_a
  order by created_at
  limit 1;

  if p_preset is not null then
    if parent_b is null then
      parent_b := parent_a;
    end if;
    segments := public.custody_preset_segments(p_preset, parent_a, parent_b);
  end if;
  if segments is null or jsonb_typeof(segments) <> 'array' or jsonb_array_length(segments) = 0 then
    perform public.raise_app('invalid_pattern');
  end if;

  update public.custody_patterns
  set is_active = false
  where family_id = p_family_id and is_active;

  insert into public.custody_patterns (
    family_id, name, starts_on, cycle_length_days, segments, handover_time, handover_location, is_active, created_by
  ) values (
    p_family_id,
    coalesce(nullif(btrim(p_name), ''), coalesce(p_preset, 'custom')),
    p_starts_on,
    (select max((value->>'to_day')::int) + 1 from jsonb_array_elements(segments)),
    segments,
    coalesce(p_handover_time, time '18:00'),
    p_handover_location,
    true,
    p_actor
  )
  returning id into pattern_id;

  perform public.generate_handovers(p_family_id, p_starts_on, (p_starts_on + 60));
  return pattern_id;
end;
$$;

create or replace function public.save_custody_pattern(
  p_family_id uuid,
  p_name text,
  p_starts_on date,
  p_preset text,
  p_segments jsonb,
  p_handover_time time,
  p_handover_location text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  parents int;
  me uuid := public.current_member_id(p_family_id);
  pattern_id uuid;
  proposal_id uuid;
begin
  if not public.is_family_parent(p_family_id) then
    perform public.raise_app('not_family_parent');
  end if;
  select count(*) into parents
  from public.family_members
  where family_id = p_family_id and role = 'parent' and status = 'active';

  if parents >= 2 then
    insert into public.proposals (
      family_id, kind, title, body, payload, created_by, status, expires_at
    ) values (
      p_family_id,
      'decision',
      coalesce(nullif(btrim(p_name), ''), 'Custody pattern'),
      null,
      jsonb_build_object(
        'action', 'set_custody_pattern',
        'name', p_name,
        'starts_on', p_starts_on,
        'preset', p_preset,
        'segments', p_segments,
        'handover_time', p_handover_time,
        'handover_location', p_handover_location
      ),
      me,
      'pending',
      now() + interval '7 days'
    )
    returning id into proposal_id;
    return jsonb_build_object('status', 'proposed', 'proposal_id', proposal_id);
  end if;

  pattern_id := public.apply_custody_pattern(
    p_family_id, p_name, p_starts_on, p_preset, p_segments, p_handover_time, p_handover_location, me
  );
  return jsonb_build_object('status', 'saved', 'pattern_id', pattern_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Handovers
-- ---------------------------------------------------------------------------

create or replace function public.generate_handovers(p_family uuid, p_from date, p_to date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  fam_tz text;
  pat public.custody_patterns%rowtype;
  d date;
  parent_today uuid;
  parent_next uuid;
  slot timestamptz;
  inserted int := 0;
begin
  select timezone into fam_tz from public.families where id = p_family;
  select * into pat from public.custody_patterns where family_id = p_family and is_active limit 1;
  if not found then
    return 0;
  end if;

  if to_regclass('pg_temp.desired_handovers') is not null then
    drop table desired_handovers;
  end if;
  create temporary table desired_handovers (
    scheduled_at timestamptz,
    from_parent uuid,
    to_parent uuid,
    location text
  ) on commit drop;

  d := p_from;
  while d < p_to loop
    parent_today := public.custody_parent_on(p_family, (d::timestamp + time '12:00') at time zone fam_tz);
    parent_next := public.custody_parent_on(p_family, ((d + 1)::timestamp + time '12:00') at time zone fam_tz);
    if parent_today is not null and parent_next is not null and parent_today <> parent_next then
      slot := ((d + 1)::timestamp + pat.handover_time) at time zone fam_tz;
      if slot > now() then
        insert into desired_handovers values (slot, parent_today, parent_next, pat.handover_location);
      end if;
    end if;
    d := d + 1;
  end loop;

  update public.handovers h
  set status = 'voided', void_reason = 'schedule_changed'
  where h.family_id = p_family
    and h.source = 'pattern'
    and h.status = 'scheduled'
    and h.scheduled_at > now()
    and h.scheduled_at::date between p_from and p_to
    and not exists (
      select 1 from desired_handovers d
      where d.scheduled_at = h.scheduled_at
        and d.from_parent = h.from_parent_id
        and d.to_parent = h.to_parent_id
    );

  insert into public.handovers (family_id, scheduled_at, from_parent_id, to_parent_id, location, source, status)
  select p_family, d.scheduled_at, d.from_parent, d.to_parent, d.location, 'pattern', 'scheduled'
  from desired_handovers d
  where not exists (
    select 1 from public.handovers h
    where h.family_id = p_family
      and h.scheduled_at = d.scheduled_at
      and h.status <> 'voided'
  );
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create or replace function public.create_manual_handover(
  p_family_id uuid,
  p_scheduled_at timestamptz,
  p_from_parent uuid,
  p_to_parent uuid,
  p_location text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  me uuid := public.current_member_id(p_family_id);
begin
  if not public.is_family_parent(p_family_id) then
    perform public.raise_app('not_family_parent');
  end if;
  insert into public.handovers (family_id, scheduled_at, from_parent_id, to_parent_id, location, source, status, created_by)
  values (p_family_id, p_scheduled_at, p_from_parent, p_to_parent, p_location, 'manual', 'scheduled', me)
  returning id into hid;
  return hid;
end;
$$;

create or replace function public.checkin(
  p_handover_id uuid,
  p_kind text,
  p_lat double precision,
  p_lng double precision,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ho public.handovers%rowtype;
  me uuid;
  cid uuid;
  other_member uuid;
begin
  if p_kind not in ('dropoff', 'pickup', 'confirm') then
    perform public.raise_app('invalid_checkin');
  end if;
  select * into ho from public.handovers where id = p_handover_id for update;
  if not found then
    perform public.raise_app('not_found');
  end if;
  if not public.is_family_parent(ho.family_id) then
    perform public.raise_app('not_family_parent');
  end if;
  if ho.status in ('voided', 'missed') then
    perform public.raise_app('handover_closed');
  end if;
  me := public.current_member_id(ho.family_id);

  insert into public.checkins (family_id, handover_id, actor_member_id, kind, lat, lng, note)
  values (ho.family_id, ho.id, me, p_kind, p_lat, p_lng, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into cid;

  update public.handovers
  set status = case when p_kind = 'confirm' then 'completed' else 'in_progress' end
  where id = ho.id;

  other_member := case when me = ho.from_parent_id then ho.to_parent_id else ho.from_parent_id end;
  perform public.notify_member(
    ho.family_id,
    other_member,
    'handover.checkin',
    '/',
    jsonb_build_object('handoverId', ho.id, 'kind', p_kind, 'at', now())
  );
  return cid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create or replace function public.create_event(
  p_family_id uuid,
  p_kind text,
  p_title text,
  p_notes text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_all_day boolean,
  p_rrule text,
  p_location text,
  p_visibility text,
  p_child_ids uuid[]
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
  if p_kind not in ('child_event', 'parent_blocker', 'family_event') then
    perform public.raise_app('invalid_event_kind');
  end if;
  if p_visibility not in ('family', 'parents') then
    perform public.raise_app('invalid_visibility');
  end if;
  if p_kind = 'parent_blocker' then
    p_visibility := 'parents';
  end if;

  insert into public.events (
    family_id, kind, title, notes, starts_at, ends_at, all_day, rrule, location, visibility, status, created_by
  ) values (
    p_family_id, p_kind, btrim(p_title), p_notes, p_starts_at, p_ends_at, coalesce(p_all_day, false),
    nullif(btrim(coalesce(p_rrule, '')), ''), p_location, p_visibility, 'confirmed', me
  )
  returning id into eid;

  if p_child_ids is not null then
    foreach child in array p_child_ids loop
      insert into public.event_children (family_id, event_id, child_member_id)
      values (p_family_id, eid, child);
    end loop;
  end if;
  return eid;
end;
$$;

create or replace function public.update_event(p_id uuid, p_patch jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.events%rowtype;
  me uuid;
  new_id uuid;
  acknowledged boolean;
begin
  select * into ev from public.events where id = p_id for update;
  if not found then
    perform public.raise_app('not_found');
  end if;
  me := public.current_member_id(ev.family_id);
  if me is null or me <> ev.created_by then
    perform public.raise_app('author_only');
  end if;

  select exists (
    select 1 from public.acknowledgments
    where subject_type = 'event' and subject_id = ev.id
  ) into acknowledged;

  if not acknowledged then
    update public.events
    set title = coalesce(p_patch->>'title', title),
        notes = coalesce(p_patch->>'notes', notes),
        starts_at = coalesce((p_patch->>'starts_at')::timestamptz, starts_at),
        ends_at = coalesce((p_patch->>'ends_at')::timestamptz, ends_at),
        location = coalesce(p_patch->>'location', location),
        all_day = coalesce((p_patch->>'all_day')::boolean, all_day)
    where id = ev.id;
    return ev.id;
  end if;

  insert into public.events (
    family_id, kind, title, notes, starts_at, ends_at, all_day, rrule, location, visibility, status, created_by,
    version, supersedes_id
  ) values (
    ev.family_id, ev.kind,
    coalesce(p_patch->>'title', ev.title),
    coalesce(p_patch->>'notes', ev.notes),
    coalesce((p_patch->>'starts_at')::timestamptz, ev.starts_at),
    coalesce((p_patch->>'ends_at')::timestamptz, ev.ends_at),
    coalesce((p_patch->>'all_day')::boolean, ev.all_day),
    ev.rrule,
    coalesce(p_patch->>'location', ev.location),
    ev.visibility, ev.status, ev.created_by,
    ev.version + 1, ev.id
  )
  returning id into new_id;

  update public.events set superseded_by = new_id where id = ev.id;
  insert into public.event_children (family_id, event_id, child_member_id)
  select family_id, new_id, child_member_id from public.event_children where event_id = ev.id;
  return new_id;
end;
$$;

create or replace function public.calendar_range(p_family uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  fam_tz text;
  d date;
  start_date date;
  end_date date;
  parent uuid;
  custody jsonb := '[]'::jsonb;
  is_parent boolean;
begin
  if not public.is_family_member(p_family) then
    perform public.raise_app('not_family_member');
  end if;
  is_parent := public.is_family_parent(p_family);
  select timezone into fam_tz from public.families where id = p_family;
  start_date := (p_from at time zone fam_tz)::date;
  end_date := (p_to at time zone fam_tz)::date;
  d := start_date;
  while d <= end_date loop
    parent := public.custody_parent_on(p_family, (d::timestamp + time '12:00') at time zone fam_tz);
    custody := custody || jsonb_build_array(jsonb_build_object('date', d, 'parent_member_id', parent));
    d := d + 1;
  end loop;

  return jsonb_build_object(
    'timezone', fam_tz,
    'custody', custody,
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.starts_at)
      from public.events e
      where e.family_id = p_family
        and e.superseded_by is null
        and e.status <> 'voided'
        and e.starts_at < p_to
        and e.ends_at > p_from
        and (is_parent or (e.visibility = 'family' and e.kind <> 'parent_blocker'))
    ), '[]'::jsonb),
    'handovers', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.scheduled_at)
      from public.handovers h
      where h.family_id = p_family
        and h.status <> 'voided'
        and h.scheduled_at >= p_from
        and h.scheduled_at < p_to
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.custody_preset_segments(text, uuid, uuid) from public, anon;
revoke all on function public.custody_parent_on(uuid, timestamptz) from public, anon;
revoke all on function public.apply_custody_pattern(uuid, text, date, text, jsonb, time, text, uuid) from public, anon, authenticated;
revoke all on function public.save_custody_pattern(uuid, text, date, text, jsonb, time, text) from public, anon;
revoke all on function public.generate_handovers(uuid, date, date) from public, anon, authenticated;
revoke all on function public.create_manual_handover(uuid, timestamptz, uuid, uuid, text) from public, anon;
revoke all on function public.checkin(uuid, text, double precision, double precision, text) from public, anon;
revoke all on function public.create_event(uuid, text, text, text, timestamptz, timestamptz, boolean, text, text, text, uuid[]) from public, anon;
revoke all on function public.update_event(uuid, jsonb) from public, anon;
revoke all on function public.calendar_range(uuid, timestamptz, timestamptz) from public, anon;

grant execute on function public.custody_preset_segments(text, uuid, uuid) to authenticated;
grant execute on function public.custody_parent_on(uuid, timestamptz) to authenticated;
grant execute on function public.save_custody_pattern(uuid, text, date, text, jsonb, time, text) to authenticated;
grant execute on function public.create_manual_handover(uuid, timestamptz, uuid, uuid, text) to authenticated;
grant execute on function public.checkin(uuid, text, double precision, double precision, text) to authenticated;
grant execute on function public.create_event(uuid, text, text, text, timestamptz, timestamptz, boolean, text, text, text, uuid[]) to authenticated;
grant execute on function public.update_event(uuid, jsonb) to authenticated;
grant execute on function public.calendar_range(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.generate_handovers(uuid, date, date) to service_role;
