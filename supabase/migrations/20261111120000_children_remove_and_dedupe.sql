-- Children: block duplicate names and let a parent remove a child profile.
-- Removing never deletes: the member is marked 'left' (P2), and the audit trigger records it.

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
  clean_name text := btrim(coalesce(p_display_name, ''));
begin
  if not public.is_family_parent(p_family_id) then
    perform public.raise_app('not_family_parent');
  end if;
  -- Serialise concurrent adds for this family so the duplicate check cannot race.
  perform pg_advisory_xact_lock(hashtext('add_child:' || p_family_id::text));
  if exists (
    select 1
    from public.family_members
    where family_id = p_family_id
      and role = 'child'
      and status = 'active'
      and lower(btrim(display_name)) = lower(clean_name)
  ) then
    perform public.raise_app('child_duplicate');
  end if;
  insert into public.family_members (family_id, role, display_name, color, birthdate, status)
  values (p_family_id, 'child', clean_name, coalesce(p_color, 'sky'), p_birthdate, 'active')
  returning id into child_id;
  return child_id;
end;
$$;

create or replace function public.remove_child(p_family_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_family_parent(p_family_id) then
    perform public.raise_app('not_family_parent');
  end if;
  update public.family_members
  set status = 'left'
  where id = p_member_id
    and family_id = p_family_id
    and role = 'child'
    and status = 'active';
  if not found then
    perform public.raise_app('child_not_found');
  end if;
end;
$$;

revoke all on function public.remove_child(uuid, uuid) from public, anon;
grant execute on function public.remove_child(uuid, uuid) to authenticated;
