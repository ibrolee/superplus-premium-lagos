create or replace function public.admin_adjust_sp_points(
  p_member_id uuid,
  p_points integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_member_name text;
  v_balance integer;
  v_reason text := left(trim(coalesce(p_reason, '')), 240);
  v_points integer := p_points;
begin
  if v_uid is null then
    raise exception 'Sign in required.' using errcode = '42501';
  end if;

  select lower(role) into v_role
  from public.staff_users
  where auth_user_id = v_uid and active = true
  limit 1;

  if coalesce(v_role, '') not in ('admin', 'owner', 'manager') then
    raise exception 'Management access required.' using errcode = '42501';
  end if;

  if p_member_id is null then
    raise exception 'Choose a member.';
  end if;
  if v_points is null or v_points = 0 or abs(v_points) > 100000 then
    raise exception 'Points must be a non-zero whole number within the allowed limit.';
  end if;
  if v_reason = '' then
    raise exception 'A reason is required.';
  end if;

  select full_name into v_member_name
  from public.members
  where id = p_member_id;

  if not found then
    raise exception 'Member not found.';
  end if;

  insert into public.member_points_ledger(member_id, points, reason, source_key)
  values (
    p_member_id,
    v_points,
    'Admin adjustment: ' || v_reason,
    'admin_adjustment:' || gen_random_uuid()::text
  );

  select coalesce(sum(points), 0)::integer into v_balance
  from public.member_points_ledger
  where member_id = p_member_id;

  return jsonb_build_object(
    'member_id', p_member_id,
    'member_name', v_member_name,
    'points_changed', v_points,
    'balance', v_balance
  );
end;
$$;

revoke all on function public.admin_adjust_sp_points(uuid, integer, text) from public, anon;
grant execute on function public.admin_adjust_sp_points(uuid, integer, text) to authenticated;
