-- Staff account roles currently allow only admin and reception.
-- Delegation therefore targets an existing active reception account, rather than
-- inventing a manager role unsupported by the production role constraint.
create or replace function private.wc_can_edit(p_scope text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.site_control_admin() or exists(
  select 1 from public.staff_users staff
  join public.wc_editor_permissions permission on permission.auth_user_id=staff.auth_user_id
  where staff.auth_user_id=auth.uid() and staff.active=true and staff.role='reception'
   and case p_scope when 'pages' then permission.can_pages when 'design' then permission.can_design
   when 'campaigns' then permission.can_campaigns when 'enquiries' then permission.can_enquiries else false end
 )
$$;
revoke all on function private.wc_can_edit(text) from public,anon,authenticated;
grant execute on function private.wc_can_edit(text) to authenticated;

create or replace function public.wc_admin_set_editor_permissions(
 p_staff_id uuid,p_pages boolean,p_design boolean,p_campaigns boolean,p_enquiries boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.site_control_admin() then raise exception 'Admin or owner required.';end if;
 if not exists(select 1 from public.staff_users where auth_user_id=p_staff_id and active and role='reception')
 then raise exception 'Only active reception accounts can receive delegated content permissions.';end if;
 insert into public.wc_editor_permissions(auth_user_id,can_pages,can_design,can_campaigns,can_enquiries,updated_by)
 values(p_staff_id,p_pages,p_design,p_campaigns,p_enquiries,auth.uid())
 on conflict(auth_user_id) do update set can_pages=excluded.can_pages,can_design=excluded.can_design,
 can_campaigns=excluded.can_campaigns,can_enquiries=excluded.can_enquiries,updated_at=now(),updated_by=auth.uid();
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.wc_admin_set_editor_permissions(uuid,boolean,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.wc_admin_set_editor_permissions(uuid,boolean,boolean,boolean,boolean) to authenticated;
