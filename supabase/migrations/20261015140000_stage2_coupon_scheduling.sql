-- Registration-waiver coupon activation dates are checked server-side
-- at checkout and reception finalization; percentage discounts remain disabled.
alter table public.website_coupons add column starts_on date;
create or replace function private.website_registration_coupon_ok(
 p_code text,p_checkout boolean default true
) returns boolean language sql stable security definer set search_path='' as $$
 select exists(
 select 1 from public.website_coupons c
 where c.code=upper(btrim(coalesce(p_code,''))) and c.discount_type='registration_waiver'
 and ((not p_checkout) or (c.active
   and (c.starts_on is null or c.starts_on <= (now() at time zone 'Africa/Lagos')::date)
   and (c.expires_on is null or c.expires_on >= (now() at time zone 'Africa/Lagos')::date)))
 )
$$;
revoke all on function private.website_registration_coupon_ok(text,boolean) from public,anon,authenticated;

create or replace function public.admin_site_schedule_coupon(p_code text,p_starts_on date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_code text:=upper(btrim(coalesce(p_code,'')));v_prev date;
begin
 if not private.site_control_admin() then raise exception 'Admin or owner only.';end if;
 select starts_on into v_prev from public.website_coupons where code=v_code for update;
 if not found then raise exception 'Coupon not found.';end if;
 if p_starts_on is not null and exists(select 1 from public.website_coupons
 where code=v_code and expires_on is not null and expires_on<p_starts_on)
 then raise exception 'Coupon cannot start after it expires.';end if;
 update public.website_coupons set starts_on=p_starts_on,updated_at=now(),updated_by=auth.uid() where code=v_code;
 insert into public.website_control_audit(changed_by,kind,record_key,previous_value,next_value)
 values(auth.uid(),'coupon_start_date',v_code,jsonb_build_object('starts_on',v_prev),jsonb_build_object('starts_on',p_starts_on));
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.admin_site_schedule_coupon(text,date) from public,anon,authenticated;
grant execute on function public.admin_site_schedule_coupon(text,date) to authenticated;
