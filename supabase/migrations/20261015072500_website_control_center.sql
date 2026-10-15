-- Website Control Centre: role-limited self-service product pricing and coupon catalogue.
-- Keep existing membership plan IDs/names and historic financial transactions intact.
create table public.website_coupons (
  code text primary key check (code ~ '^[A-Z0-9_-]{3,24}$'),
  description text not null default '' check (length(description) <= 250),
  discount_type text not null default 'registration_waiver' check (discount_type='registration_waiver'),
  active boolean not null default true,
  expires_on date,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.website_coupons(code,description,active)
values ('REGOFF','Original registration fee waiver',true),('REGSF','Super Plus registration fee waiver',true)
on conflict do nothing;
alter table public.website_coupons enable row level security;
revoke all on public.website_coupons from public,anon,authenticated;
grant select,insert,update on public.website_coupons to authenticated;
grant all on public.website_coupons to service_role;

create policy website_coupons_admin_read on public.website_coupons
for select to authenticated using (exists(select 1 from public.staff_users u where u.auth_user_id=(select auth.uid()) and u.active and u.role in ('admin','owner')));
-- Writes use the RPCs rather than exposing direct client-side mutation grants.
revoke insert,update on public.website_coupons from authenticated;

create table public.website_control_audit (
  id uuid primary key default gen_random_uuid(),
  changed_at timestamptz not null default now(),
  changed_by uuid,
  kind text not null,
  record_key text not null,
  previous_value jsonb,
  next_value jsonb
);
alter table public.website_control_audit enable row level security;
revoke all on public.website_control_audit from public,anon,authenticated;
grant select on public.website_control_audit to authenticated;
create policy website_control_audit_admin_read on public.website_control_audit for select to authenticated
using (exists(select 1 from public.staff_users u where u.auth_user_id=(select auth.uid()) and u.active and u.role in ('admin','owner')));

create or replace function private.site_control_admin()
returns boolean language sql stable security definer set search_path='' as $$
 select exists (select 1 from public.staff_users u where u.auth_user_id=(select auth.uid()) and u.active and u.role in ('admin','owner'))
$$;
revoke all on function private.site_control_admin() from public,anon,authenticated;

create or replace function public.admin_site_save_coupon(
  p_code text,p_description text default '',p_active boolean default true,p_expires_on date default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_code text := upper(btrim(coalesce(p_code,''))); v_prev public.website_coupons%rowtype;
begin
 if not private.site_control_admin() then raise exception 'Admin or owner access required.'; end if;
 if v_code !~ '^[A-Z0-9_-]{3,24}$' then raise exception 'Code must be 3–24 letters, numbers, underscores or hyphens.'; end if;
 if length(coalesce(p_description,''))>250 then raise exception 'Description exceeds 250 characters.'; end if;
 if p_active and p_expires_on is not null and p_expires_on < (now() at time zone 'Africa/Lagos')::date
 then raise exception 'Active coupon expiry cannot be in the past.'; end if;
 select * into v_prev from public.website_coupons where code=v_code for update;
 insert into public.website_coupons(code,description,active,expires_on,created_by,updated_by)
 values (v_code,btrim(coalesce(p_description,'')),coalesce(p_active,false),p_expires_on,auth.uid(),auth.uid())
 on conflict (code) do update set description=excluded.description,active=excluded.active,
 expires_on=excluded.expires_on,updated_at=now(),updated_by=auth.uid();
 insert into public.website_control_audit(changed_by,kind,record_key,previous_value,next_value)
 values(auth.uid(),'registration_coupon',v_code,to_jsonb(v_prev),
   (select to_jsonb(c) from public.website_coupons c where c.code=v_code));
 return jsonb_build_object('success',true,'code',v_code);
end $$;
revoke all on function public.admin_site_save_coupon(text,text,boolean,date) from public,anon,authenticated;
grant execute on function public.admin_site_save_coupon(text,text,boolean,date) to authenticated;

-- Only registration-fee waiver coupons are supported: no unlimited percent-off coupons.
create or replace function private.website_registration_coupon_ok(
  p_code text,p_checkout boolean default true
) returns boolean language sql stable security definer set search_path='' as $$
 select exists(
   select 1 from public.website_coupons c
   where c.code=upper(btrim(coalesce(p_code,'')))
    and c.discount_type='registration_waiver'
    and ((not p_checkout) or
      (c.active and (c.expires_on is null or c.expires_on >= (now() at time zone 'Africa/Lagos')::date)))
 )
$$;
revoke all on function private.website_registration_coupon_ok(text,boolean) from public,anon,authenticated;

create or replace function public.admin_site_update_plan_price(p_plan_id uuid,p_price numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_plan public.membership_plans%rowtype;
begin
 if not private.site_control_admin() then raise exception 'Admin or owner access required.'; end if;
 if p_price is null or p_price < 100 or p_price > 100000000 or round(p_price,2)<>p_price
 then raise exception 'Enter a membership price between ₦100 and ₦100,000,000 (up to 2 decimals).'; end if;
 select * into v_plan from public.membership_plans where id=p_plan_id for update;
 if v_plan.id is null or v_plan.name='Custom Plan' or v_plan.duration_days is null
 then raise exception 'Only existing fixed-price membership plans can be updated.'; end if;
 if v_plan.price is distinct from p_price then
   update public.membership_plans set price=p_price,updated_at=now() where id=v_plan.id;
   insert into public.website_control_audit(changed_by,kind,record_key,previous_value,next_value)
   values(auth.uid(),'membership_price',v_plan.name,jsonb_build_object('price',v_plan.price),
     jsonb_build_object('price',p_price));
 end if;
 return jsonb_build_object('success',true,'plan_id',v_plan.id,'name',v_plan.name,'price',p_price);
end $$;
revoke all on function public.admin_site_update_plan_price(uuid,numeric) from public,anon,authenticated;
grant execute on function public.admin_site_update_plan_price(uuid,numeric) to authenticated;

-- Reception cash/POS registrations can save newly issued codes in the ledger.
alter table public.reception_direct_transactions
 drop constraint if exists reception_direct_transactions_coupon_code_check;
alter table public.reception_direct_transactions
 add constraint reception_direct_transactions_coupon_code_check
 check (coupon_code is null or coupon_code ~ '^[A-Z0-9_-]{3,24}$');
