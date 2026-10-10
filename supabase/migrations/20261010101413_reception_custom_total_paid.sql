-- Record a negotiated final payment while preserving plan, duration and registration history.
ALTER TABLE public.reception_direct_transactions ADD COLUMN IF NOT EXISTS custom_total_paid numeric;
ALTER TABLE public.reception_direct_transactions DROP CONSTRAINT IF EXISTS reception_direct_transactions_check;
ALTER TABLE public.reception_direct_transactions ADD CONSTRAINT reception_direct_transactions_check
 CHECK (amount = coalesce(custom_total_paid, plan_amount + registration_fee - discount_amount));
ALTER TABLE public.reception_direct_transactions ADD CONSTRAINT reception_custom_total_paid_check
 CHECK (custom_total_paid IS NULL OR (custom_total_paid >= 0 AND custom_total_paid <= 100000000 AND custom_total_paid = round(custom_total_paid,2)));

CREATE OR REPLACE FUNCTION public.reception_complete_registration_custom_total(p_actor_id uuid, p_full_name text, p_email text, p_phone text, p_plan_id uuid, p_start_date date, p_duration_days integer, p_plan_amount numeric, p_method text, p_staff_note text, p_staff_reference text, p_funds_confirmed boolean, p_idempotency_key uuid, p_member_id uuid, p_coupon_code text, p_discount_percentage integer, p_custom_total_paid numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_plan public.membership_plans%rowtype;
 v_existing public.reception_direct_transactions%rowtype;
 v_member uuid; v_membership uuid; v_payment uuid; v_transaction uuid;
 v_fee numeric; v_required_fee numeric; v_registration_credit numeric := 0;
 v_has_membership boolean := false;
 v_email text; v_phone text; v_coupon text; v_ref text;
 v_today date; v_start date; v_current_end date; v_end date;
 v_discount_percentage integer := case when p_custom_total_paid is not null then 0 else coalesce(p_discount_percentage,0) end;
 v_subtotal numeric;
 v_discount_amount numeric;
 v_final_amount numeric;
 v_credit_applied numeric := 0;
begin
 if (select auth.role()) is distinct from 'service_role' then
  raise exception 'Server-only registration endpoint.' using errcode='42501';
 end if;
 if p_actor_id is null or not exists(
  select 1 from public.staff_users s
  where s.auth_user_id=p_actor_id and s.active is true
    and lower(s.role) in('reception','admin','owner','manager')
 ) then
  raise exception 'Active reception account required.' using errcode='42501';
 end if;
 if p_idempotency_key is null then raise exception 'Registration retry key required.'; end if;

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reception-request:'||p_actor_id::text||':'||p_idempotency_key::text,0));
 select * into v_existing
 from public.reception_direct_transactions
 where recorded_by=p_actor_id and idempotency_key=p_idempotency_key;

 if v_existing.id is not null then
  select start_date,end_date into v_start,v_end
  from public.memberships where id=v_existing.membership_id;
  return jsonb_build_object(
   'success',true,'already_recorded',true,'transaction_id',v_existing.id,
   'member_id',v_existing.member_id,'membership_id',v_existing.membership_id,
   'payment_id',v_existing.payment_id,'revenue_recorded',true,'amount',v_existing.amount,
   'discount_percentage',v_existing.discount_percentage,'discount_amount',v_existing.discount_amount,
   'subtotal_amount',v_existing.plan_amount+v_existing.registration_fee,
   'custom_total_paid',v_existing.custom_total_paid,
   'start_date',v_start,'end_date',v_end
  );
 end if;

 v_today := (clock_timestamp() at time zone 'Africa/Lagos')::date;
 if p_start_date is null then raise exception 'Choose a plan start date.'; end if;
 if p_start_date < v_today then raise exception 'Plan start date cannot be before today in Lagos.'; end if;
 if p_funds_confirmed is distinct from true then raise exception 'Confirm actual receipt of money before recording payment.'; end if;
 if p_method not in ('Cash','POS','Bank Transfer') then raise exception 'Choose Cash, POS or Bank Transfer.'; end if;
 if p_custom_total_paid is not null and (
   p_custom_total_paid::text in ('NaN','Infinity','-Infinity')
   or p_custom_total_paid < 0 or p_custom_total_paid > 100000000
   or p_custom_total_paid <> round(p_custom_total_paid,2)
 ) then raise exception 'Custom total paid must be from 0 to 100,000,000 naira with up to two decimal places.'; end if;
 if v_discount_percentage not between 0 and 100 then raise exception 'Discount percentage must be a whole number from 0 to 100.'; end if;

 v_ref:=lower(btrim(coalesce(p_staff_reference,'')));
 if p_method <> 'Cash' and length(v_ref)<6 then raise exception 'Enter the real POS/bank reference (at least six characters).'; end if;
 if length(btrim(coalesce(p_staff_note,'')))>1500 then raise exception 'Collection note is too long.'; end if;

 select * into v_plan from public.membership_plans where id=p_plan_id and active is true;
 if v_plan.id is null then raise exception 'Choose an active membership plan.'; end if;
 if p_duration_days not between 1 and 3650
    or (v_plan.name <> 'Custom Plan' and p_duration_days is distinct from v_plan.duration_days)
 then raise exception 'Invalid duration for this plan.'; end if;
 if p_plan_amount is null or p_plan_amount <= 0 or p_plan_amount > 100000000
    or (v_plan.name <> 'Custom Plan' and p_plan_amount is distinct from v_plan.price)
 then raise exception 'Membership amount must match the official plan price.'; end if;

 v_coupon:=upper(btrim(coalesce(p_coupon_code,'')));
 if v_coupon not in ('','REGOFF','REGSF') then raise exception 'Invalid coupon code.'; end if;
 v_email:=lower(btrim(coalesce(p_email,'')));
 v_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');

 if p_member_id is null then
  if length(btrim(coalesce(p_full_name,'')))<3 or v_email not like '%@%.%' or length(v_phone) not between 10 and 15 then
   raise exception 'Enter the new member full name, email and valid phone.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reception-email:'||v_email,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reception-phone:'||right(v_phone,10),0));
  if exists(
   select 1 from public.members m
   where lower(btrim(coalesce(m.email,'')))=v_email
      or right(regexp_replace(coalesce(m.phone,''),'[^0-9]','','g'),10)=right(v_phone,10)
  ) then
   raise exception 'Member already exists. Find and renew their existing profile instead of creating a duplicate.';
  end if;
  insert into public.members(full_name,email,phone,source,notes)
   values (btrim(p_full_name),v_email,btrim(p_phone),'manual','Registered at reception.')
   returning id into v_member;
 else
  select id into v_member from public.members where id=p_member_id for update;
  if v_member is null then raise exception 'Existing member not found.'; end if;

  select exists(
    select 1 from public.memberships m where m.member_id=v_member
  ) into v_has_membership;

  select coalesce(sum(t.registration_amount),0)
  into v_registration_credit
  from public.reception_registration_only_transactions t
  where t.member_id=v_member;
  v_registration_credit := v_registration_credit + coalesce((
   select sum(p.amount) from public.payments p
   where p.member_id=v_member and p.status='success' and p.source='public_join'
     and p.metadata->>'registration_only'='true'
  ),0);
 end if;

 v_required_fee := case
   when v_plan.name='Family Plan' then 20000
   when v_plan.name='Personal Training Only' then 0
   else 7000
 end;

 if p_member_id is null then
   v_fee := case when v_coupon in ('REGOFF','REGSF') then 0 else v_required_fee end;
 elsif v_has_membership is false and v_registration_credit > 0 and v_coupon not in ('REGOFF','REGSF') then
   v_credit_applied := least(v_required_fee, v_registration_credit);
   v_fee := greatest(v_required_fee - v_registration_credit, 0);
 else
   v_fee := 0;
 end if;

 v_subtotal:=p_plan_amount+v_fee;
 v_discount_amount:=round((v_subtotal*v_discount_percentage/100.0)::numeric,2);
 v_final_amount:=coalesce(p_custom_total_paid,greatest(v_subtotal-v_discount_amount,0));

 v_start:=p_start_date;
 if p_member_id is not null then
  select max(end_date) into v_current_end
  from public.memberships
  where member_id=v_member
    and payment_status='paid'
    and status in ('active','pending','paused')
    and end_date >= v_today
    and (
      (plan_id is not null and plan_id = v_plan.id)
      or lower(btrim(coalesce(plan_name,''))) = lower(btrim(v_plan.name))
    );

  if v_current_end is not null and v_start <= v_current_end then
   raise exception 'This same plan already has a paid cycle through %. Choose % or later, or edit that existing plan.', v_current_end, v_current_end+1;
  end if;
 end if;
 v_end:=v_start+p_duration_days-1;

 if p_method <> 'Cash' then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reception-reference:'||v_ref,0));
  if exists(select 1 from public.reception_direct_collection_refs where normalized_reference=v_ref)
     or exists(select 1 from public.reception_registration_only_collection_refs where normalized_reference=v_ref)
     or exists(select 1 from public.fitness_verified_collection_refs where reference_key=v_ref)
     or exists(select 1 from public.payments where lower(btrim(coalesce(paystack_reference,'')))=v_ref)
  then
   raise exception 'This POS/bank reference is already recorded. Do not charge the member twice.';
  end if;
 end if;

 insert into public.memberships(member_id,plan_id,plan_name,start_date,end_date,status,payment_status,source)
 values(
  v_member,v_plan.id,v_plan.name,v_start,v_end,'active','paid',
  case when p_member_id is null then 'reception_direct' else 'reception_renewal' end
 )
 returning id into v_membership;

 insert into public.payments(
  member_id,membership_id,amount,currency,status,payment_method,provider,paid_at,source,metadata
 )
 values(
  v_member,v_membership,v_final_amount,'NGN','success',p_method,'manual_reception',clock_timestamp(),
  case when p_member_id is null then 'reception_direct' else 'reception_renewal' end,
  jsonb_build_object(
   'collection_recorded_by',p_actor_id,
   'collection_note',btrim(coalesce(p_staff_note,'')),
   'staff_reference',nullif(btrim(coalesce(p_staff_reference,'')),''),
   'membership_amount_naira',p_plan_amount,
   'registration_amount_naira',v_fee,
   'registration_credit_applied_naira',v_credit_applied,
   'subtotal_before_discount_naira',v_subtotal,
   'discount_percentage',v_discount_percentage,
   'discount_amount_naira',v_discount_amount,
   'final_amount_naira',v_final_amount,
   'custom_total_paid_naira',p_custom_total_paid,
   'price_adjustment_naira',v_final_amount-(v_subtotal-v_discount_amount),
   'membership_start_date',v_start,
   'membership_end_date',v_end,
   'coupon_code',nullif(v_coupon,''),
   'staff_confirmed_funds',true,
   'record_type','standard_payment'
  )
 )
 returning id into v_payment;

 insert into public.reception_direct_transactions(
  recorded_by,idempotency_key,member_id,membership_id,payment_id,plan_id,transaction_type,
  plan_amount,registration_fee,amount,coupon_code,method,staff_reference,collection_note,
  discount_percentage,discount_amount,custom_total_paid
 )
 values(
  p_actor_id,p_idempotency_key,v_member,v_membership,v_payment,v_plan.id,
  case when p_member_id is null then 'new' else 'renewal' end,
  p_plan_amount,v_fee,v_final_amount,nullif(v_coupon,''),p_method,
  nullif(btrim(coalesce(p_staff_reference,'')),''),
  nullif(btrim(coalesce(p_staff_note,'')),''),
  v_discount_percentage,v_discount_amount,p_custom_total_paid
 )
 returning id into v_transaction;

 if p_method <> 'Cash' then
  insert into public.reception_direct_collection_refs(normalized_reference,transaction_id)
  values(v_ref,v_transaction);
 end if;

 return jsonb_build_object(
  'success',true,'transaction_id',v_transaction,'member_id',v_member,'membership_id',v_membership,
  'payment_id',v_payment,'access_active',true,'payment_status','paid','revenue_recorded',true,
  'custom_total_paid',p_custom_total_paid,'amount',v_final_amount,'subtotal_amount',v_subtotal,'discount_percentage',v_discount_percentage,
  'discount_amount',v_discount_amount,'registration_fee',v_fee,
  'registration_credit_applied',v_credit_applied,'start_date',v_start,'end_date',v_end,
  'transaction_type',case when p_member_id is null then 'new' else 'renewal' end
 );
end
$function$
;

CREATE OR REPLACE FUNCTION public.reception_complete_registration_with_pt_custom_total(p_actor_id uuid, p_full_name text, p_email text, p_phone text, p_plan_id uuid, p_start_date date, p_duration_days integer, p_plan_amount numeric, p_method text, p_staff_note text, p_staff_reference text, p_funds_confirmed boolean, p_idempotency_key uuid, p_member_id uuid, p_coupon_code text, p_discount_percentage integer, p_trainer_staff_profile_id uuid, p_custom_total_paid numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_result jsonb;
  v_membership_id uuid;
  v_plan_name text;
  v_assignment jsonb;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Server-only registration endpoint.' using errcode='42501';
  end if;

  v_result := public.reception_complete_registration_custom_total(
    p_actor_id,
    p_full_name,
    p_email,
    p_phone,
    p_plan_id,
    p_start_date,
    p_duration_days,
    p_plan_amount,
    p_method,
    p_staff_note,
    p_staff_reference,
    p_funds_confirmed,
    p_idempotency_key,
    p_member_id,
    p_coupon_code,
    p_discount_percentage,
    p_custom_total_paid
  );

  v_membership_id := nullif(v_result->>'membership_id','')::uuid;

  if v_membership_id is not null then
    select plan_name into v_plan_name
    from public.memberships
    where id = v_membership_id;

    if lower(coalesce(v_plan_name,'')) like 'personal training%' then
      if p_trainer_staff_profile_id is not null then
        v_assignment := public.ensure_pt_assignment_for_service(
          v_membership_id,
          p_trainer_staff_profile_id,
          p_actor_id
        );

        v_result := v_result || jsonb_build_object(
          'pt_trainer_staff_profile_id', v_assignment->>'trainer_staff_profile_id',
          'pt_trainer_name', v_assignment->>'trainer_name',
          'pt_assignment_pending', false
        );
      else
        v_result := v_result || jsonb_build_object('pt_assignment_pending', true);
      end if;
    elsif p_trainer_staff_profile_id is not null then
      raise exception 'A coach can only be assigned to a Personal Training plan.';
    end if;
  end if;

  return v_result;
end;
$function$
;

REVOKE ALL ON FUNCTION public.reception_complete_registration_custom_total(uuid,text,text,text,uuid,date,integer,numeric,text,text,text,boolean,uuid,uuid,text,integer,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reception_complete_registration_custom_total(uuid,text,text,text,uuid,date,integer,numeric,text,text,text,boolean,uuid,uuid,text,integer,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.reception_complete_registration_with_pt_custom_total(uuid,text,text,text,uuid,date,integer,numeric,text,text,text,boolean,uuid,uuid,text,integer,uuid,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reception_complete_registration_with_pt_custom_total(uuid,text,text,text,uuid,date,integer,numeric,text,text,text,boolean,uuid,uuid,text,integer,uuid,numeric) TO service_role;
NOTIFY pgrst, 'reload schema';

