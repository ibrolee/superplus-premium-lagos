-- A manager can only see their own staff_users row via ordinary RLS.
-- Expose a small active staff directory only to authorized website operations editors.
create or replace function public.wc_admin_list_staff()
returns jsonb language sql stable security definer set search_path='' as $$
 select case when private.site_control_admin() or private.wc_can_edit('enquiries')
  then coalesce((select jsonb_agg(jsonb_build_object(
    'auth_user_id',auth_user_id,'role',role,'full_name',full_name,'active',active)
    order by full_name nulls last)
    from public.staff_users where active),'[]'::jsonb)
  else '[]'::jsonb end
$$;
revoke all on function public.wc_admin_list_staff() from public,anon,authenticated;
grant execute on function public.wc_admin_list_staff() to authenticated;
