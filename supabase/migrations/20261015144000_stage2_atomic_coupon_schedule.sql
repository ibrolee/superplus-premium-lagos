-- Coupon creation and activation dates must be saved atomically;
-- do not momentarily enable an unstarted promotion between two RPCs.
create or replace function public.admin_site_upsert_scheduled_coupon(
 p_code text,p_description text,p_active boolean,p_expires_on date,p_starts_on date
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_code text:=upper(btrim(coalesce(p_code,'')));v_prev public.website_coupons%rowtype;
begin
 if not private.site_control_admin() then raise exception 'Admin or owner only.';end if;
 if v_code !~ '^[A-Z0-9_-]{3,24}$' or length(coalesce(p_description,''))>250
 then raise exception 'Invalid coupon code or description.';end if;
 if p_starts_on is not null and p_expires_on is not null and p_expires_on<p_starts_on
 then raise exception 'Coupon expiration cannot precede its start date.';end if;
 if p_active and p_expires_on is not null and p_expires_on<(now() at time zone 'Africa/Lagos')::date
 then raise exception 'An active coupon cannot already be expired.';end if;
 select * into v_prev from public.website_coupons where code=v_code for update;
 insert into public.website_coupons(code,description,active,expires_on,starts_on,created_by,updated_by)
 values(v_code,btrim(coalesce(p_description,'')),coalesce(p_active,false),p_expires_on,p_starts_on,auth.uid(),auth.uid())
 on conflict(code) do update set description=excluded.description,active=excluded.active,
 expires_on=excluded.expires_on,starts_on=excluded.starts_on,updated_at=now(),updated_by=auth.uid();
 insert into public.website_control_audit(changed_by,kind,record_key,previous_value,next_value)
 values(auth.uid(),'registration_coupon',v_code,to_jsonb(v_prev),
   (select to_jsonb(c) from public.website_coupons c where c.code=v_code));
 return jsonb_build_object('success',true,'code',v_code);
end $$;
revoke all on function public.admin_site_upsert_scheduled_coupon(text,text,boolean,date,date) from public,anon,authenticated;
grant execute on function public.admin_site_upsert_scheduled_coupon(text,text,boolean,date,date) to authenticated;
