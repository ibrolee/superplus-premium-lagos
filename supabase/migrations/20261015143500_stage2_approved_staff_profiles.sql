create or replace function public.wc_admin_list_staff_profiles()
returns jsonb language sql stable security definer set search_path='' as $$
 select case when private.wc_can_edit('enquiries') then
  coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',full_name,
   'department',department,'position',position) order by full_name)
   from public.staff_profiles where status='approved'),'[]'::jsonb)
 else '[]'::jsonb end
$$;
revoke all on function public.wc_admin_list_staff_profiles() from public,anon,authenticated;
grant execute on function public.wc_admin_list_staff_profiles() to authenticated;

create or replace function public.wc_admin_update_enquiry_assignment(
 p_id uuid,p_status text,p_assigned_staff uuid default null,
 p_assigned_profile uuid default null,p_note text default ''
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.wc_can_edit('enquiries') then raise exception 'Website enquiries permission required.';end if;
 if p_status not in ('new','contacted','in_progress','resolved','spam') or length(coalesce(p_note,''))>5000
 then raise exception 'Invalid status or internal note.';end if;
 if p_assigned_staff is not null and not exists(select 1 from public.staff_users
   where auth_user_id=p_assigned_staff and active) then raise exception 'Staff account unavailable.';end if;
 if p_assigned_profile is not null and not exists(select 1 from public.staff_profiles
   where id=p_assigned_profile and status='approved') then raise exception 'Employee profile unavailable.';end if;
 if p_assigned_staff is not null and p_assigned_profile is not null then raise exception 'Select one assignee.';end if;
 update public.wc_enquiries set status=p_status,assigned_staff=p_assigned_staff,
   assigned_profile_id=p_assigned_profile,internal_note=coalesce(p_note,''),
   updated_at=now(),updated_by=auth.uid() where id=p_id;
 if not found then raise exception 'Enquiry not found.';end if;
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.wc_admin_update_enquiry_assignment(uuid,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.wc_admin_update_enquiry_assignment(uuid,text,uuid,uuid,text) to authenticated;
