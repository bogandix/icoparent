-- Profiles, families, invites, audit log, and the shared acknowledge/void helpers.
-- Client state changes go through these functions. There are no delete policies.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.runtime_config (
  key text primary key,
  value text not null
);

create schema if not exists test_support;
revoke all on schema test_support from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  locale text not null default 'en' check (locale in ('en', 'ro')),
  timezone text not null default 'Europe/Bucharest',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_locale text := coalesce(meta->>'locale', 'en');
begin
  insert into public.profiles (id, display_name, avatar_url, locale)
  values (
    new.id,
    coalesce(meta->>'full_name', meta->>'name', meta->>'display_name', split_part(new.email, '@', 1)),
    meta->>'avatar_url',
    case when requested_locale = 'ro' then 'ro' else 'en' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Errors and membership helpers
-- ---------------------------------------------------------------------------

create or replace function public.raise_app(code text)
returns void
language plpgsql
as $$
begin
  raise exception '%', code using errcode = 'P0001';
end;
$$;

revoke all on function public.raise_app(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Families and members
-- ---------------------------------------------------------------------------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  timezone text not null,
  default_currency char(3) not null default 'RON',
  children_can_post boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  user_id uuid references public.profiles (id),
  role text not null check (role in ('parent', 'child')),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  color text not null default 'teal' check (color in ('teal', 'amber', 'rose', 'sky', 'violet', 'lime')),
  birthdate date,
  status text not null default 'active' check (status in ('invited', 'active', 'left')),
  created_at timestamptz not null default now(),
  unique (id, family_id)
);

create unique index family_members_one_login
  on public.family_members (family_id, user_id)
  where user_id is not null and status = 'active';

create or replace function public.is_family_member(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = fid
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_family_parent(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = fid
      and user_id = auth.uid()
      and role = 'parent'
      and status = 'active'
  );
$$;

create or replace function public.current_member_id(fid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.family_members
  where family_id = fid
    and user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

revoke all on function public.is_family_member(uuid) from public, anon;
revoke all on function public.is_family_parent(uuid) from public, anon;
revoke all on function public.current_member_id(uuid) from public, anon;
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.is_family_parent(uuid) to authenticated;
grant execute on function public.current_member_id(uuid) to authenticated;

create or replace function public.enforce_two_parents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'parent' and new.status = 'active' then
    if (
      select count(*)
      from public.family_members
      where family_id = new.family_id
        and role = 'parent'
        and status = 'active'
        and id <> new.id
    ) >= 2 then
      perform public.raise_app('max_parents');
    end if;
  end if;
  return new;
end;
$$;

create trigger family_members_two_parents
  before insert or update on public.family_members
  for each row execute function public.enforce_two_parents();

alter table public.families enable row level security;
alter table public.families force row level security;
alter table public.family_members enable row level security;
alter table public.family_members force row level security;

create policy families_select on public.families
  for select to authenticated
  using (public.is_family_member(id));

create policy family_members_select on public.family_members
  for select to authenticated
  using (public.is_family_member(family_id));

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.family_members mine
      join public.family_members theirs
        on theirs.family_id = mine.family_id
       and theirs.user_id = profiles.id
       and theirs.status = 'active'
      where mine.user_id = auth.uid()
        and mine.status = 'active'
    )
  );

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  table_name text not null,
  row_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_user_id uuid,
  at timestamptz not null default now(),
  old jsonb,
  new jsonb
);

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

create policy audit_log_select_parents on public.audit_log
  for select to authenticated
  using (public.is_family_parent(family_id));

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payload_new jsonb;
  payload_old jsonb;
  fid uuid;
  rid uuid;
begin
  if tg_op = 'INSERT' then
    payload_new := to_jsonb(new);
    rid := new.id;
  elsif tg_op = 'UPDATE' then
    payload_new := to_jsonb(new);
    payload_old := to_jsonb(old);
    rid := new.id;
  else
    payload_old := to_jsonb(old);
    rid := old.id;
  end if;

  if tg_table_name = 'families' then
    fid := rid;
  elsif tg_table_name = 'profiles' then
    select family_id into fid
    from public.family_members
    where user_id = rid and status = 'active'
    limit 1;
    if fid is null then
      return coalesce(new, old);
    end if;
  else
    fid := coalesce(payload_new->>'family_id', payload_old->>'family_id')::uuid;
  end if;

  insert into public.audit_log (family_id, table_name, row_id, action, actor_user_id, old, new)
  values (fid, tg_table_name, rid, lower(tg_op), auth.uid(), payload_old, payload_new);

  return coalesce(new, old);
end;
$$;

create trigger audit_families
  after insert or update on public.families
  for each row execute function public.write_audit_log();

create trigger audit_family_members
  after insert or update on public.family_members
  for each row execute function public.write_audit_log();

create trigger audit_profiles
  after update on public.profiles
  for each row execute function public.write_audit_log();

-- ---------------------------------------------------------------------------
-- Family RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_family(
  p_name text,
  p_timezone text,
  p_currency text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  fid uuid;
  display text;
begin
  if uid is null then
    perform public.raise_app('not_authenticated');
  end if;
  if p_currency is null or char_length(p_currency) <> 3 then
    perform public.raise_app('invalid_currency');
  end if;
  if p_timezone is null or btrim(p_timezone) = '' then
    perform public.raise_app('invalid_timezone');
  end if;

  select display_name into display from public.profiles where id = uid;

  insert into public.families (name, timezone, default_currency, created_by)
  values (btrim(p_name), p_timezone, upper(p_currency)::char(3), uid)
  returning id into fid;

  insert into public.family_members (family_id, user_id, role, display_name, color, status)
  values (fid, uid, 'parent', display, 'teal', 'active');

  return fid;
end;
$$;

create or replace function public.update_family(
  p_family_id uuid,
  p_name text,
  p_timezone text,
  p_currency text,
  p_children_can_post boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_family_parent(p_family_id) then
    perform public.raise_app('not_family_parent');
  end if;
  if p_currency is null or char_length(p_currency) <> 3 then
    perform public.raise_app('invalid_currency');
  end if;
  update public.families
  set name = btrim(p_name),
      timezone = p_timezone,
      default_currency = upper(p_currency)::char(3),
      children_can_post = p_children_can_post
  where id = p_family_id;
end;
$$;

create or replace function public.add_child(
  p_family_id uuid,
  p_display_name text,
  p_birthdate date,
  p_color text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  child_id uuid;
begin
  if not public.is_family_parent(p_family_id) then
    perform public.raise_app('not_family_parent');
  end if;
  insert into public.family_members (family_id, role, display_name, color, birthdate, status)
  values (p_family_id, 'child', btrim(p_display_name), coalesce(p_color, 'sky'), p_birthdate, 'active')
  returning id into child_id;
  return child_id;
end;
$$;

create or replace function public.update_my_profile(p_display_name text, p_locale text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    perform public.raise_app('not_authenticated');
  end if;
  if p_locale not in ('en', 'ro') then
    perform public.raise_app('invalid_locale');
  end if;
  update public.profiles
  set display_name = btrim(p_display_name),
      locale = p_locale
  where id = auth.uid();
end;
$$;

create or replace function public.update_my_member(
  p_family_id uuid,
  p_display_name text,
  p_color text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_member_id(p_family_id);
begin
  if me is null then
    perform public.raise_app('not_family_member');
  end if;
  update public.family_members
  set display_name = btrim(p_display_name),
      color = p_color
  where id = me
    and family_id = p_family_id;
end;
$$;

create or replace function public.leave_family(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_member_id(p_family_id);
begin
  if me is null then
    perform public.raise_app('not_family_member');
  end if;
  update public.family_members
  set status = 'left'
  where id = me;
end;
$$;

revoke all on function public.create_family(text, text, text) from public, anon;
revoke all on function public.update_family(uuid, text, text, text, boolean) from public, anon;
revoke all on function public.add_child(uuid, text, date, text) from public, anon;
revoke all on function public.update_my_profile(text, text) from public, anon;
revoke all on function public.update_my_member(uuid, text, text) from public, anon;
revoke all on function public.leave_family(uuid) from public, anon;
grant execute on function public.create_family(text, text, text) to authenticated;
grant execute on function public.update_family(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.add_child(uuid, text, date, text) to authenticated;
grant execute on function public.update_my_profile(text, text) to authenticated;
grant execute on function public.update_my_member(uuid, text, text) to authenticated;
grant execute on function public.leave_family(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  email text,
  role text not null check (role in ('parent', 'child')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid not null references public.family_members (id),
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;
alter table public.invites force row level security;

create policy invites_select_parents on public.invites
  for select to authenticated
  using (public.is_family_parent(family_id));

create trigger audit_invites
  after insert or update on public.invites
  for each row execute function public.write_audit_log();

create or replace function public.create_invite(
  p_family_id uuid,
  p_email text,
  p_role text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  token text := encode(gen_random_bytes(24), 'hex');
  active_parents int;
begin
  if not public.is_family_parent(p_family_id) then
    perform public.raise_app('not_family_parent');
  end if;
  if p_role not in ('parent', 'child') then
    perform public.raise_app('invalid_role');
  end if;
  if p_role = 'parent' then
    select count(*) into active_parents
    from public.family_members
    where family_id = p_family_id and role = 'parent' and status = 'active';
    if active_parents >= 2 then
      perform public.raise_app('max_parents');
    end if;
  end if;

  insert into public.invites (family_id, email, role, token_hash, expires_at, created_by)
  values (
    p_family_id,
    nullif(btrim(coalesce(p_email, '')), ''),
    p_role,
    encode(digest(token, 'sha256'), 'hex'),
    now() + interval '7 days',
    public.current_member_id(p_family_id)
  );
  return token;
end;
$$;

create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  invite public.invites%rowtype;
  display text;
  member_id uuid;
  hashed text := encode(digest(p_token, 'sha256'), 'hex');
begin
  if uid is null then
    perform public.raise_app('not_authenticated');
  end if;

  select * into invite
  from public.invites
  where token_hash = hashed
  for update;

  if not found then
    perform public.raise_app('invite_not_found');
  end if;
  if invite.accepted_at is not null then
    perform public.raise_app('invite_used');
  end if;
  if invite.expires_at <= now() then
    perform public.raise_app('invite_expired');
  end if;

  select display_name into display from public.profiles where id = uid;

  if invite.role = 'child' then
    -- Prefer an existing child profile without a login in this family.
    select id into member_id
    from public.family_members
    where family_id = invite.family_id
      and role = 'child'
      and user_id is null
      and status = 'active'
    order by created_at
    limit 1;
    if member_id is not null then
      update public.family_members
      set user_id = uid
      where id = member_id;
    end if;
  end if;

  if member_id is null then
    insert into public.family_members (family_id, user_id, role, display_name, color, status)
    values (
      invite.family_id,
      uid,
      invite.role,
      display,
      case when invite.role = 'parent' then 'amber' else 'sky' end,
      'active'
    )
    returning id into member_id;
  end if;

  update public.invites
  set accepted_at = now()
  where id = invite.id;

  return invite.family_id;
end;
$$;

revoke all on function public.create_invite(uuid, text, text) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.create_invite(uuid, text, text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Acknowledge and void
-- ---------------------------------------------------------------------------

create table public.acknowledgments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  subject_type text not null check (subject_type in ('event', 'expense', 'post')),
  subject_id uuid not null,
  member_id uuid not null references public.family_members (id),
  at timestamptz not null default now(),
  unique (subject_type, subject_id, member_id)
);

alter table public.acknowledgments enable row level security;
alter table public.acknowledgments force row level security;

create policy acknowledgments_select_parents on public.acknowledgments
  for select to authenticated
  using (public.is_family_parent(family_id));

create trigger audit_acknowledgments
  after insert on public.acknowledgments
  for each row execute function public.write_audit_log();

create or replace function public.subject_author(p_type text, p_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  author uuid;
begin
  if p_type = 'event' then
    select created_by into author from public.events where id = p_id;
  elsif p_type = 'expense' then
    select created_by into author from public.expenses where id = p_id;
  elsif p_type = 'post' then
    select author_member_id into author from public.posts where id = p_id;
  elsif p_type = 'handover' then
    select created_by into author from public.handovers where id = p_id;
  else
    perform public.raise_app('unknown_subject');
  end if;
  return author;
end;
$$;

-- subject_author is created before the tables it reads. Postgres allows that
-- because the function body is not parsed until call time (plpgsql).

create or replace function public.acknowledge(p_subject_type text, p_subject_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  author uuid;
  fid uuid;
  me uuid;
  ack uuid;
begin
  if p_subject_type not in ('event', 'expense', 'post') then
    perform public.raise_app('unknown_subject');
  end if;
  author := public.subject_author(p_subject_type, p_subject_id);
  if author is null then
    perform public.raise_app('not_found');
  end if;

  select family_id into fid from public.family_members where id = author;
  if not public.is_family_parent(fid) then
    perform public.raise_app('not_family_parent');
  end if;
  me := public.current_member_id(fid);
  if me = author then
    perform public.raise_app('author_cannot_acknowledge');
  end if;

  insert into public.acknowledgments (family_id, subject_type, subject_id, member_id)
  values (fid, p_subject_type, p_subject_id, me)
  on conflict (subject_type, subject_id, member_id) do nothing
  returning id into ack;

  if ack is null then
    select id into ack
    from public.acknowledgments
    where subject_type = p_subject_type and subject_id = p_subject_id and member_id = me;
  end if;

  perform public.notify_member(fid, author, 'acknowledgment.created', '/' || p_subject_type || 's/' || p_subject_id::text,
    jsonb_build_object('subjectType', p_subject_type, 'subjectId', p_subject_id));
  return ack;
end;
$$;

create or replace function public.void_item(
  p_subject_type text,
  p_subject_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  author uuid;
  fid uuid;
  me uuid;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    perform public.raise_app('reason_required');
  end if;
  if p_subject_type not in ('event', 'expense', 'handover', 'post') then
    perform public.raise_app('unknown_subject');
  end if;
  author := public.subject_author(p_subject_type, p_subject_id);
  if author is null then
    perform public.raise_app('not_found');
  end if;
  select family_id into fid from public.family_members where id = author;
  me := public.current_member_id(fid);
  if me is null or me <> author then
    perform public.raise_app('author_only');
  end if;

  if p_subject_type = 'event' then
    update public.events set status = 'voided', void_reason = btrim(p_reason) where id = p_subject_id;
  elsif p_subject_type = 'expense' then
    update public.expenses set status = 'voided', void_reason = btrim(p_reason) where id = p_subject_id;
  elsif p_subject_type = 'handover' then
    update public.handovers set status = 'voided', void_reason = btrim(p_reason) where id = p_subject_id;
  elsif p_subject_type = 'post' then
    update public.posts set status = 'voided', void_reason = btrim(p_reason) where id = p_subject_id;
  end if;
end;
$$;

revoke all on function public.subject_author(text, uuid) from public, anon, authenticated;
revoke all on function public.acknowledge(text, uuid) from public, anon;
revoke all on function public.void_item(text, uuid, text) from public, anon;
grant execute on function public.acknowledge(text, uuid) to authenticated;
grant execute on function public.void_item(text, uuid, text) to authenticated;

-- Local and pgTAP user fixture. Not granted to API roles.
create or replace function test_support.create_user(p_email text, p_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = auth, public, extensions
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt('local-dev-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', p_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    p_id,
    jsonb_build_object('sub', p_id::text, 'email', p_email),
    'email',
    p_id::text,
    now(),
    now(),
    now()
  );
  return p_id;
end;
$$;

revoke all on function test_support.create_user(text, uuid, text) from public, anon, authenticated;
