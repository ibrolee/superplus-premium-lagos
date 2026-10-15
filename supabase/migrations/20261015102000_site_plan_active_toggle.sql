-- Owners can temporarily hide an existing plan without deleting historical records.
create or replace function public.admin_site_set_plan_active(p_plan_id uuid,p_active boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.membership_plans%rowtype;
begin
 if not private.site_control_admin() then raise exception 'Admin or owner required.';end if;
 select * into v from public.membership_plans where id=p_plan_id for update;
 if v.id is null or v.name='Custom Plan' then raise exception 'Unknown or protected plan.';end if;
 if v.active is distinct from p_active then
  update public.membership_plans set active=p_active,updated_at=now() where id=v.id;
  insert into public.website_control_audit(changed_by,kind,record_key,previous_value,next_value)
  values(auth.uid(),'plan_availability',v.name,jsonb_build_object('active',v.active),jsonb_build_object('active',p_active));
 end if;
 return jsonb_build_object('success',true,'active',p_active);
end $$;
revoke all on function public.admin_site_set_plan_active(uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_site_set_plan_active(uuid,boolean) to authenticated;
