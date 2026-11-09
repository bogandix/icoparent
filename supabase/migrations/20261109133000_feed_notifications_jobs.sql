-- Feed, files, notifications, and the scheduled jobs the Worker calls.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  author_member_id uuid not null references public.family_members (id),
  body text,
  audience text not null check (audience in ('family', 'parents')),
  happened_on date not null default (now() at time zone 'utc')::date,
  event_id uuid references public.events (id),
  status text not null default 'active' check (status in ('active', 'voided')),
  void_reason text,
  created_at timestamptz not null default now()
);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  post_id uuid not null references public.posts (id),
  member_id uuid not null references public.family_members (id),
  emoji text not null check (emoji in ('heart', 'smile', 'hug')),
  created_at timestamptz not null default now(),
  unique (post_id, member_id, emoji)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  owner_type text not null check (owner_type in ('expense', 'post', 'event', 'proposal', 'checkin')),
  owner_id uuid not null,
  kind text not null check (kind in ('image', 'audio')),
  storage_path text not null,
  thumb_path text,
  mime text not null,
  bytes int not null check (bytes >= 0),
  width int,
  height int,
  duration_ms int,
  created_by uuid not null references public.family_members (id),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id),
  recipient_user_id uuid not null references public.profiles (id),
  type text not null,
  link text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification_prefs (
  user_id uuid not null references public.profiles (id),
  type text not null,
  push boolean not null default false,
  inbox boolean not null default true,
  primary key (user_id, type)
);

alter table public.posts enable row level security;
alter table public.posts force row level security;
alter table public.reactions enable row level security;
alter table public.reactions force row level security;
alter table public.attachments enable row level security;
alter table public.attachments force row level security;
alter table public.notifications enable row level security;
alter table public.notifications force row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
alter table public.notification_prefs enable row level security;
alter table public.notification_prefs force row level security;

create policy posts_select on public.posts
  for select to authenticated
  using (
    public.is_family_member(family_id)
    and (public.is_family_parent(family_id) or audience = 'family')
  );

create policy posts_insert on public.posts
  for insert to authenticated
  with check (
    author_member_id = public.current_member_id(family_id)
    and (
      public.is_family_parent(family_id)
      or (
        audience = 'family'
        and exists (
          select 1 from public.families f
          where f.id = family_id and f.children_can_post
        )
      )
    )
  );

create policy reactions_select on public.reactions
  for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.family_id = reactions.family_id));

create policy reactions_insert on public.reactions
  for insert to authenticated
  with check (
    member_id = public.current_member_id(family_id)
    and exists (select 1 from public.posts p where p.id = post_id and p.family_id = reactions.family_id)
  );

create policy attachments_select on public.attachments
  for select to authenticated
  using (
    public.is_family_parent(family_id)
    or (
      public.is_family_member(family_id)
      and owner_type = 'post'
      and exists (
        select 1 from public.posts p
        where p.id = owner_id and p.family_id = attachments.family_id and p.audience = 'family'
      )
    )
    or (
      public.is_family_member(family_id)
      and owner_type = 'event'
      and exists (
        select 1 from public.events e
        where e.id = owner_id and e.family_id = attachments.family_id and e.visibility = 'family'
      )
    )
  );

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_user_id = auth.uid());

create policy push_select_own on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy push_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy push_update_own on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy prefs_select_own on public.notification_prefs
  for select to authenticated using (user_id = auth.uid());
create policy prefs_insert_own on public.notification_prefs
  for insert to authenticated with check (user_id = auth.uid());
create policy prefs_update_own on public.notification_prefs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger audit_posts after insert or update on public.posts
  for each row execute function public.write_audit_log();
create trigger audit_attachments after insert on public.attachments
  for each row execute function public.write_audit_log();

create or replace function public.notify_member(
  p_family uuid,
  p_member uuid,
  p_type text,
  p_link text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
begin
  if p_member is null then
    return;
  end if;
  select user_id into recipient from public.family_members where id = p_member and status = 'active';
  if recipient is null then
    return;
  end if;
  insert into public.notifications (family_id, recipient_user_id, type, link, payload)
  values (p_family, recipient, p_type, p_link, coalesce(p_payload, '{}'::jsonb));
end;
$$;

create or replace function public.notify_family_parents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member record;
begin
  if tg_table_name <> 'posts' or new.audience <> 'family' and new.audience <> 'parents' then
    return new;
  end if;
  for member in
    select id from public.family_members
    where family_id = new.family_id and role = 'parent' and status = 'active' and id <> new.author_member_id
  loop
    perform public.notify_member(new.family_id, member.id, 'post.created', '/feed', jsonb_build_object('postId', new.id));
  end loop;
  return new;
end;
$$;

create trigger posts_notify
  after insert on public.posts
  for each row execute function public.notify_family_parents();

create or replace function public.create_attachment(
  p_family_id uuid,
  p_owner_type text,
  p_owner_id uuid,
  p_kind text,
  p_storage_path text,
  p_thumb_path text,
  p_mime text,
  p_bytes int,
  p_width int,
  p_height int,
  p_duration_ms int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.current_member_id(p_family_id);
  existing int;
  frozen boolean := false;
  aid uuid;
begin
  if me is null then
    perform public.raise_app('not_family_member');
  end if;
  if not public.is_family_parent(p_family_id) and p_owner_type <> 'post' then
    perform public.raise_app('not_family_parent');
  end if;
  if p_owner_type not in ('expense', 'post', 'event', 'proposal', 'checkin') then
    perform public.raise_app('unknown_subject');
  end if;
  if p_kind = 'audio' and coalesce(p_duration_ms, 0) > 120000 then
    perform public.raise_app('audio_too_long');
  end if;
  if p_owner_type in ('expense', 'event', 'post') then
    select exists (
      select 1 from public.acknowledgments
      where subject_type = p_owner_type and subject_id = p_owner_id
    ) into frozen;
    if frozen then
      perform public.raise_app('attachments_frozen');
    end if;
  end if;
  select count(*) into existing from public.attachments
  where owner_type = p_owner_type and owner_id = p_owner_id and kind = 'image';
  if p_kind = 'image' and existing >= 10 then
    perform public.raise_app('too_many_images');
  end if;

  insert into public.attachments (
    family_id, owner_type, owner_id, kind, storage_path, thumb_path, mime, bytes, width, height, duration_ms, created_by
  ) values (
    p_family_id, p_owner_type, p_owner_id, p_kind, p_storage_path, p_thumb_path, p_mime, p_bytes,
    p_width, p_height, p_duration_ms, me
  )
  returning id into aid;
  return aid;
end;
$$;

create or replace function public.storage_usage(p_family_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(bytes), 0)
  from public.attachments
  where family_id = p_family_id
    and public.is_family_member(p_family_id);
$$;

create or replace function public.mark_notification_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_id and recipient_user_id = auth.uid();
end;
$$;

create or replace function public.mark_all_notifications_read(p_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set read_at = coalesce(read_at, now())
  where family_id = p_family_id and recipient_user_id = auth.uid() and read_at is null;
end;
$$;

create or replace function public.run_scheduled_jobs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  prop public.proposals%rowtype;
  ho public.handovers%rowtype;
  fam record;
  expired int := 0;
  reminded int := 0;
  missed int := 0;
  generated int := 0;
begin
  for prop in
    select * from public.proposals
    where status = 'pending' and expires_at <= now()
    for update
  loop
    update public.proposals set status = 'expired', resolved_at = now() where id = prop.id;
    perform public.notify_member(
      prop.family_id, prop.created_by, 'proposal.expired', '/agreements/' || prop.id::text,
      jsonb_build_object('proposalId', prop.id, 'kind', prop.kind, 'title', prop.title)
    );
    perform public.notify_member(
      prop.family_id, public.other_parent_member(prop.family_id, prop.created_by), 'proposal.expired',
      '/agreements/' || prop.id::text,
      jsonb_build_object('proposalId', prop.id, 'kind', prop.kind, 'title', prop.title)
    );
    expired := expired + 1;
  end loop;

  for prop in
    select * from public.proposals
    where status = 'pending' and reminded_at is null and created_at <= now() - interval '48 hours'
    for update
  loop
    update public.proposals set reminded_at = now() where id = prop.id;
    perform public.notify_member(
      prop.family_id, public.other_parent_member(prop.family_id, prop.created_by), 'proposal.reminder',
      '/agreements/' || prop.id::text,
      jsonb_build_object('proposalId', prop.id, 'kind', prop.kind, 'title', prop.title)
    );
    reminded := reminded + 1;
  end loop;

  for ho in
    select * from public.handovers
    where status = 'scheduled' and scheduled_at <= now() - interval '3 hours'
    for update
  loop
    update public.handovers set status = 'missed' where id = ho.id;
    perform public.notify_member(ho.family_id, ho.from_parent_id, 'handover.missed', '/', jsonb_build_object('handoverId', ho.id));
    perform public.notify_member(ho.family_id, ho.to_parent_id, 'handover.missed', '/', jsonb_build_object('handoverId', ho.id));
    missed := missed + 1;
  end loop;

  for fam in select id from public.families loop
    generated := generated + public.generate_handovers(fam.id, now()::date, now()::date + 60);
  end loop;

  return jsonb_build_object('expired', expired, 'reminded', reminded, 'missed', missed, 'generated', generated);
end;
$$;

create or replace function public.enqueue_push()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  url text;
  secret text;
begin
  select value into url from private.runtime_config where key = 'push_webhook_url';
  if url is null or url = '' then
    return new;
  end if;
  select value into secret from private.runtime_config where key = 'push_shared_secret';
  begin
    perform net.http_post(
      url := url,
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'authorization', 'Bearer ' || coalesce(secret, '')
      ),
      body := jsonb_build_object('notification_id', new.id)
    );
  exception when others then
    return new;
  end;
  return new;
end;
$$;

create trigger notifications_push
  after insert on public.notifications
  for each row execute function public.enqueue_push();

insert into storage.buckets (id, name, public, file_size_limit)
values ('family-media', 'family-media', false, 5242880)
on conflict (id) do nothing;

create policy family_media_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'family-media'
    and exists (
      select 1 from public.attachments a
      where a.storage_path = name or a.thumb_path = name
    )
  );

create policy family_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'family-media'
    and public.is_family_member(((storage.foldername(name))[2])::uuid)
  );

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when undefined_object or duplicate_object then
  null;
end $$;

revoke all on function public.notify_member(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.notify_family_parents() from public, anon, authenticated;
revoke all on function public.create_attachment(uuid, text, uuid, text, text, text, text, int, int, int, int) from public, anon;
revoke all on function public.storage_usage(uuid) from public, anon;
revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_read(uuid) from public, anon;
revoke all on function public.run_scheduled_jobs() from public, anon, authenticated;
revoke all on function public.enqueue_push() from public, anon, authenticated;

grant execute on function public.create_attachment(uuid, text, uuid, text, text, text, text, int, int, int, int) to authenticated;
grant execute on function public.storage_usage(uuid) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated;
grant execute on function public.run_scheduled_jobs() to service_role;

-- Default push types from the product decision: proposals, handover check-ins, new expenses.
create or replace function public.seed_notification_prefs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_prefs (user_id, type, push, inbox)
  values
    (new.id, 'proposal.pending', true, true),
    (new.id, 'handover.checkin', true, true),
    (new.id, 'expense.created', true, true)
  on conflict do nothing;
  return new;
end;
$$;

create trigger profiles_default_prefs
  after insert on public.profiles
  for each row execute function public.seed_notification_prefs();
