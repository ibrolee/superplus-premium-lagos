create or replace function public.admin_list_sp_point_balances(p_search text default null)
returns table (member_id uuid, full_name text, phone text, email text, balance bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
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

  return query
  select m.id, m.full_name, m.phone, m.email, coalesce(sum(l.points), 0)::bigint
  from public.members m
  left join public.member_points_ledger l on l.member_id = m.id
  where v_search is null
     or coalesce(m.full_name, '') ilike '%' || v_search || '%'
     or coalesce(m.email, '') ilike '%' || v_search || '%'
     or coalesce(m.phone, '') ilike '%' || v_search || '%'
  group by m.id, m.full_name, m.phone, m.email
  order by coalesce(sum(l.points), 0) desc, m.full_name asc
  limit 1000;
end;
$$;

revoke all on function public.admin_list_sp_point_balances(text) from public, anon;
grant execute on function public.admin_list_sp_point_balances(text) to authenticated;
