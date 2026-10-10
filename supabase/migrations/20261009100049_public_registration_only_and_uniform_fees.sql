-- Uniform one-time registration fees, plus public registration without membership access.
CREATE OR REPLACE FUNCTION public.finalize_public_join_payment(p_reference text, p_plan_id text, p_full_name text, p_email text, p_phone text, p_birth_day integer, p_birth_month integer, p_paid_at timestamp with time zone, p_channel text, p_customer_code text, p_coupon_code text, p_verified_amount_kobo bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_plan public.membership_plans%rowtype;
 v_plan_name text; v_fee numeric; v_code text; v_email text; v_ref text;
 v_member uuid; v_membership uuid; v_payment uuid; v_existing record;
 v_today date; v_start date; v_end date; v_current_end date; v_email_matches integer;
begin
 if (select auth.role()) is distinct from 'service_role' then
  raise exception 'Paystack verification service only.' using errcode='42501';
 end if;

 v_ref:=btrim(coalesce(p_reference,''));
 v_email:=lower(btrim(coalesce(p_email,'')));
 if length(v_ref)<10 or length(btrim(coalesce(p_full_name,'')))<2 or v_email not like '%@%.%' or length(btrim(coalesce(p_phone,'')))<7 then
  raise exception 'Payment reference or customer information is invalid.';
 end if;
 if p_birth_day not between 1 and 31 or p_birth_month not between 1 and 12 then
  raise exception 'Birth day/month invalid.';
 end if;

 v_code:=upper(btrim(coalesce(p_coupon_code,'')));
 if v_code not in ('','REGOFF','REGSF') then raise exception 'Invalid coupon.'; end if;

 v_plan_name:=case p_plan_id
  when 'daily' then 'Daily Plan'
  when 'weekly' then 'Weekly Plan'
  when 'monthly' then 'Monthly Plan'
  when 'quarterly' then 'Quarterly'
  when 'semi-annual' then 'Semi-Annual'
  when 'yearly' then 'Yearly'
  when 'vip-silver' then 'Monthly VIP Silver'
  when 'vip-gold' then 'Monthly VIP Gold'
  when 'family' then 'Family Plan'
  when 'personal-training' then 'Personal Training'
  when 'registration-only' then 'Registration Only'
  else null
 end;
 if v_plan_name is null then raise exception 'Unknown plan.'; end if;

 if p_plan_id='registration-only' then
  v_plan.name:='Registration Only'; v_plan.price:=0; v_plan.duration_days:=0;
 else
 select * into v_plan from public.membership_plans where name=v_plan_name and active is true limit 1;
 if v_plan.id is null or v_plan.price is null or v_plan.price<=0 or v_plan.duration_days is null then
  raise exception 'Plan not configured.';
 end if;
 end if;
 if p_plan_id='registration-only' and v_code<>'' then raise exception 'Coupons do not apply to registration-only payments.'; end if;

 v_fee:=case
  when v_code in ('REGOFF','REGSF') then 0
  when v_plan_name='Family Plan' then 20000
  else 7000
 end;

 -- Retain the exact price of previously initiated, independently verified checkouts.
 if v_code='' and p_plan_id in ('semi-annual','vip-gold')
    and p_verified_amount_kobo=((v_plan.price+3000)*100)::bigint then v_fee:=3000; end if;
 if p_verified_amount_kobo is distinct from ((v_plan.price+v_fee)*100)::bigint then
  raise exception 'Verified amount does not match plan and coupon pricing.';
 end if;

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paystack-ref:'||lower(v_ref),0));
 select p.id,p.member_id,p.membership_id
 into v_existing
 from public.payments p
 where p.paystack_reference=v_ref and p.status='success'
 limit 1;

 if v_existing.id is not null then
  select start_date,end_date into v_start,v_end
  from public.memberships where id=v_existing.membership_id;
  return jsonb_build_object(
    'success',true,'already_processed',true,'member_id',v_existing.member_id,
    'membership_id',v_existing.membership_id,'payment_id',v_existing.id,
    'plan_name',v_plan.name,'registration_only',p_plan_id='registration-only','start_date',v_start,'end_date',v_end,
    'email',v_email,'reference',v_ref
  );
 end if;

 if exists(select 1 from public.payments where paystack_reference=v_ref) then
  raise exception 'Payment reference is already present; investigate before retrying.';
 end if;

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paystack-email:'||v_email,0));
 select count(*) into v_email_matches
 from public.members
 where lower(btrim(coalesce(email,'')))=v_email;

 if v_email_matches>1 then
  raise exception 'Multiple member records share this email. Ask reception to correct the profiles, then retry payment verification with the same reference. Do not pay again.';
 end if;

 select id into v_member
 from public.members
 where lower(btrim(coalesce(email,'')))=v_email
 order by created_at
 limit 1
 for update;

 if v_member is null then
  insert into public.members(full_name,email,phone,birth_day,birth_month,source)
  values(btrim(p_full_name),v_email,btrim(p_phone),p_birth_day,p_birth_month,'website')
  returning id into v_member;
 end if;


 if p_plan_id='registration-only' then
  if exists(select 1 from public.memberships where member_id=v_member)
     or exists(select 1 from public.payments where member_id=v_member and status='success' and metadata->>'registration_only'='true')
     or exists(select 1 from public.reception_registration_only_transactions where member_id=v_member) then
   raise exception 'Member is already registered. Do not pay registration again.';
  end if;
  insert into public.payments(member_id,amount,currency,status,payment_method,provider,paystack_reference,paystack_customer_code,paid_at,source,metadata)
  values(v_member,v_fee,'NGN','success',nullif(btrim(coalesce(p_channel,'')),''),'paystack',v_ref,nullif(btrim(coalesce(p_customer_code,'')),''),coalesce(p_paid_at,clock_timestamp()),'public_join',
    jsonb_build_object('source','public_join','plan_id','registration-only','plan_name','Registration Only','membership_amount_naira',0,'registration_amount_naira',v_fee,'total_amount_naira',v_fee,'record_type','standard_payment','registration_only',true,'email',v_email))
  returning id into v_payment;
  return jsonb_build_object('success',true,'member_id',v_member,'payment_id',v_payment,'membership_id',null,'plan_name','Registration Only','registration_only',true,'access_active',false,'email',v_email,'reference',v_ref);
 end if;

 v_today:=(clock_timestamp() at time zone 'Africa/Lagos')::date;

 select max(end_date) into v_current_end
 from public.memberships
 where member_id=v_member
   and payment_status='paid'
   and status in ('active','pending','paused')
   and end_date>=v_today
   and (
     (plan_id is not null and plan_id=v_plan.id)
     or lower(btrim(coalesce(plan_name,'')))=lower(btrim(v_plan.name))
   );

 v_start:=case when v_current_end is not null then v_current_end+1 else v_today end;
 v_end:=v_start+v_plan.duration_days-1;

 insert into public.memberships(member_id,plan_id,plan_name,start_date,end_date,status,payment_status,source)
 values(v_member,v_plan.id,v_plan.name,v_start,v_end,'active','paid','public_join')
 returning id into v_membership;

 insert into public.payments(
   member_id,membership_id,amount,currency,status,payment_method,provider,
   paystack_reference,paystack_customer_code,paid_at,source,metadata
 )
 values(
   v_member,v_membership,v_plan.price+v_fee,'NGN','success',
   nullif(btrim(coalesce(p_channel,'')),''),
   'paystack',v_ref,nullif(btrim(coalesce(p_customer_code,'')),''),
   coalesce(p_paid_at,clock_timestamp()),'public_join',
   jsonb_build_object(
     'source','public_join','plan_id',p_plan_id,'plan_name',v_plan.name,
     'membership_amount_naira',v_plan.price,'registration_amount_naira',v_fee,
     'total_amount_naira',v_plan.price+v_fee,'coupon_code',nullif(v_code,''),
     'duration_days',v_plan.duration_days,'email',v_email,
     'paystack_channel',p_channel,'record_type','standard_payment'
   )
 )
 returning id into v_payment;

 return jsonb_build_object(
   'success',true,'member_id',v_member,'membership_id',v_membership,
   'payment_id',v_payment,'plan_name',v_plan.name,'start_date',v_start,
   'end_date',v_end,'email',v_email,'reference',v_ref,'coupon_code',nullif(v_code,'')
 );
end
$function$
;
CREATE OR REPLACE FUNCTION public.reception_complete_registration(p_actor_id uuid, p_full_name text, p_email text, p_phone text, p_plan_id uuid, p_start_date date, p_duration_days integer, p_plan_amount numeric, p_method text, p_staff_note text, p_staff_reference text, p_funds_confirmed boolean, p_idempotency_key uuid, p_member_id uuid, p_coupon_code text, p_discount_percentage integer)
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
 v_discount_percentage integer := coalesce(p_discount_percentage,0);
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
   'subtotal_amount',v_existing.amount+v_existing.discount_amount,
   'start_date',v_start,'end_date',v_end
  );
 end if;

 v_today := (clock_timestamp() at time zone 'Africa/Lagos')::date;
 if p_start_date is null then raise exception 'Choose a plan start date.'; end if;
 if p_start_date < v_today then raise exception 'Plan start date cannot be before today in Lagos.'; end if;
 if p_funds_confirmed is distinct from true then raise exception 'Confirm actual receipt of money before recording payment.'; end if;
 if p_method not in ('Cash','POS','Bank Transfer') then raise exception 'Choose Cash, POS or Bank Transfer.'; end if;
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
 v_final_amount:=greatest(v_subtotal-v_discount_amount,0);

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
  discount_percentage,discount_amount
 )
 values(
  p_actor_id,p_idempotency_key,v_member,v_membership,v_payment,v_plan.id,
  case when p_member_id is null then 'new' else 'renewal' end,
  p_plan_amount,v_fee,v_final_amount,nullif(v_coupon,''),p_method,
  nullif(btrim(coalesce(p_staff_reference,'')),''),
  nullif(btrim(coalesce(p_staff_note,'')),''),
  v_discount_percentage,v_discount_amount
 )
 returning id into v_transaction;

 if p_method <> 'Cash' then
  insert into public.reception_direct_collection_refs(normalized_reference,transaction_id)
  values(v_ref,v_transaction);
 end if;

 return jsonb_build_object(
  'success',true,'transaction_id',v_transaction,'member_id',v_member,'membership_id',v_membership,
  'payment_id',v_payment,'access_active',true,'payment_status','paid','revenue_recorded',true,
  'amount',v_final_amount,'subtotal_amount',v_subtotal,'discount_percentage',v_discount_percentage,
  'discount_amount',v_discount_amount,'registration_fee',v_fee,
  'registration_credit_applied',v_credit_applied,'start_date',v_start,'end_date',v_end,
  'transaction_type',case when p_member_id is null then 'new' else 'renewal' end
 );
end
$function$
;
CREATE OR REPLACE FUNCTION public.reception_complete_registration(p_actor_id uuid, p_full_name text, p_email text, p_phone text, p_plan_id uuid, p_start_date date, p_duration_days integer, p_plan_amount numeric, p_method text, p_staff_note text, p_staff_reference text, p_funds_confirmed boolean, p_idempotency_key uuid, p_member_id uuid, p_coupon_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_plan public.membership_plans%ROWTYPE;
 v_existing public.reception_direct_transactions%ROWTYPE;
 v_member uuid; v_membership uuid; v_payment uuid; v_transaction uuid;
 v_fee numeric; v_email text; v_phone text; v_coupon text; v_ref text;
 v_today date; v_start date; v_current_end date;
BEGIN
 IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Server-only registration endpoint.' USING ERRCODE='42501';
 END IF;
 IF p_actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.staff_users s WHERE s.auth_user_id=p_actor_id AND s.active IS TRUE AND lower(s.role) IN('reception','admin','owner','manager')) THEN
  RAISE EXCEPTION 'Active reception account required.' USING ERRCODE='42501';
 END IF;
 IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'Registration retry key required.'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reception-request:'||p_actor_id::text||':'||p_idempotency_key::text,0));
 SELECT * INTO v_existing FROM public.reception_direct_transactions WHERE recorded_by=p_actor_id AND idempotency_key=p_idempotency_key;
 IF v_existing.id IS NOT NULL THEN
  RETURN jsonb_build_object('success',true,'already_recorded',true,'transaction_id',v_existing.id,'member_id',v_existing.member_id,'membership_id',v_existing.membership_id,'payment_id',v_existing.payment_id,'revenue_recorded',true,'amount',v_existing.amount);
 END IF;
 v_today := (clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date;
 IF p_start_date IS DISTINCT FROM v_today THEN RAISE EXCEPTION 'Payment and membership must be recorded for today in Lagos.'; END IF;
 IF p_funds_confirmed IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Confirm actual receipt of money before recording payment.'; END IF;
 IF p_method NOT IN ('Cash','POS','Bank Transfer') THEN RAISE EXCEPTION 'Choose Cash, POS or Bank Transfer.'; END IF;
 v_ref:=lower(btrim(COALESCE(p_staff_reference,'')));
 IF p_method <> 'Cash' AND length(v_ref)<6 THEN RAISE EXCEPTION 'Enter the real POS/bank reference (at least six characters).'; END IF;
 IF length(btrim(COALESCE(p_staff_note,'')))>1500 THEN RAISE EXCEPTION 'Collection note is too long.'; END IF;
 SELECT * INTO v_plan FROM public.membership_plans WHERE id=p_plan_id AND active IS TRUE;
 IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Choose an active membership plan.'; END IF;
 IF p_duration_days NOT BETWEEN 1 AND 3650 OR (v_plan.name <> 'Custom Plan' AND p_duration_days IS DISTINCT FROM v_plan.duration_days) THEN RAISE EXCEPTION 'Invalid duration for this plan.'; END IF;
 IF p_plan_amount IS NULL OR p_plan_amount <= 0 OR p_plan_amount > 100000000 OR (v_plan.name <> 'Custom Plan' AND p_plan_amount IS DISTINCT FROM v_plan.price) THEN RAISE EXCEPTION 'Membership amount must match the official plan price.'; END IF;
 v_coupon:=upper(btrim(COALESCE(p_coupon_code,'')));
 IF v_coupon NOT IN ('','REGOFF','REGSF') THEN RAISE EXCEPTION 'Invalid coupon code.'; END IF;
 v_email:=lower(btrim(COALESCE(p_email,'')));
 v_phone:=regexp_replace(COALESCE(p_phone,''),'[^0-9]','','g');
 IF p_member_id IS NULL THEN
  IF length(btrim(COALESCE(p_full_name,'')))<3 OR v_email NOT LIKE '%@%.%' OR length(v_phone) NOT BETWEEN 10 AND 15 THEN
   RAISE EXCEPTION 'Enter the new member full name, email and valid phone.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reception-email:'||v_email,0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reception-phone:'||right(v_phone,10),0));
  IF EXISTS(SELECT 1 FROM public.members m WHERE lower(btrim(COALESCE(m.email,'')))=v_email OR right(regexp_replace(COALESCE(m.phone,''),'[^0-9]','','g'),10)=right(v_phone,10)) THEN
   RAISE EXCEPTION 'Member already exists. Find and renew their existing profile instead of creating a duplicate.';
  END IF;
  INSERT INTO public.members(full_name,email,phone,source,notes)
   VALUES (btrim(p_full_name),v_email,btrim(p_phone),'manual','Registered at reception.') RETURNING id INTO v_member;
 ELSE
  SELECT id INTO v_member FROM public.members WHERE id=p_member_id FOR UPDATE;
  IF v_member IS NULL THEN RAISE EXCEPTION 'Existing member not found.'; END IF;
 END IF;
 v_fee:=CASE WHEN v_member IS DISTINCT FROM p_member_id AND v_coupon NOT IN ('REGOFF','REGSF') THEN
   CASE WHEN v_plan.name='Family Plan' THEN 20000 WHEN v_plan.name='Personal Training Only' THEN 0
    ELSE 7000 END
  ELSE 0 END;
 v_start:=v_today;
 IF p_member_id IS NOT NULL THEN
  SELECT max(end_date) INTO v_current_end FROM public.memberships WHERE member_id=v_member AND status='active' AND payment_status='paid' AND end_date >= v_today;
  IF v_current_end IS NOT NULL THEN v_start:=v_current_end+1; END IF;
 END IF;
 IF p_method <> 'Cash' THEN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reception-reference:'||v_ref,0));
  IF EXISTS(SELECT 1 FROM public.reception_direct_collection_refs WHERE normalized_reference=v_ref)
   OR EXISTS(SELECT 1 FROM public.fitness_verified_collection_refs WHERE reference_key=v_ref)
   OR EXISTS(SELECT 1 FROM public.payments WHERE lower(btrim(COALESCE(paystack_reference,'')))=v_ref) THEN
   RAISE EXCEPTION 'This POS/bank reference is already recorded. Do not charge the member twice.';
  END IF;
 END IF;
 INSERT INTO public.memberships(member_id,plan_id,plan_name,start_date,end_date,status,payment_status,source)
  VALUES(v_member,v_plan.id,v_plan.name,v_start,v_start+p_duration_days-1,'active','paid',CASE WHEN p_member_id IS NULL THEN 'reception_direct' ELSE 'reception_renewal' END)
  RETURNING id INTO v_membership;
 INSERT INTO public.payments(member_id,membership_id,amount,currency,status,payment_method,provider,paid_at,source,metadata)
  VALUES(v_member,v_membership,p_plan_amount+v_fee,'NGN','success',p_method,'manual_reception',clock_timestamp(),
   CASE WHEN p_member_id IS NULL THEN 'reception_direct' ELSE 'reception_renewal' END,
   jsonb_build_object('collection_recorded_by',p_actor_id,'collection_note',btrim(COALESCE(p_staff_note,'')),
    'staff_reference',nullif(btrim(COALESCE(p_staff_reference,'')),''),'membership_amount_naira',p_plan_amount,
    'registration_amount_naira',v_fee,'coupon_code',nullif(v_coupon,''),'staff_confirmed_funds',true,
    'record_type','standard_payment')) RETURNING id INTO v_payment;
 INSERT INTO public.reception_direct_transactions(recorded_by,idempotency_key,member_id,membership_id,payment_id,plan_id,transaction_type,plan_amount,registration_fee,amount,coupon_code,method,staff_reference,collection_note)
  VALUES(p_actor_id,p_idempotency_key,v_member,v_membership,v_payment,v_plan.id,CASE WHEN p_member_id IS NULL THEN 'new' ELSE 'renewal' END,
    p_plan_amount,v_fee,p_plan_amount+v_fee,nullif(v_coupon,''),p_method,nullif(btrim(COALESCE(p_staff_reference,'')),''),nullif(btrim(COALESCE(p_staff_note,'')),'')) RETURNING id INTO v_transaction;
 IF p_method <> 'Cash' THEN INSERT INTO public.reception_direct_collection_refs(normalized_reference,transaction_id) VALUES(v_ref,v_transaction); END IF;
 RETURN jsonb_build_object('success',true,'transaction_id',v_transaction,'member_id',v_member,'membership_id',v_membership,'payment_id',v_payment,
  'access_active',true,'payment_status','paid','revenue_recorded',true,'amount',p_plan_amount+v_fee,'registration_fee',v_fee,
  'transaction_type',CASE WHEN p_member_id IS NULL THEN 'new' ELSE 'renewal' END);
END $function$
;
CREATE OR REPLACE FUNCTION public.admin_review_new_walkin(p_request_id uuid, p_action text, p_verified_reference text, p_review_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_req public.fitness_new_member_requests%ROWTYPE; v_plan public.membership_plans%ROWTYPE; v_fee numeric; v_ref text; v_member uuid; v_membership uuid; v_payment uuid; v_start date; v_phone text;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT EXISTS(SELECT 1 FROM public.staff_users s WHERE s.auth_user_id=(SELECT auth.uid()) AND s.active IS TRUE AND lower(s.role) IN ('admin','owner','manager')) THEN RAISE EXCEPTION 'Independent management approval required.' USING ERRCODE='42501'; END IF;
 IF p_action NOT IN ('approve','reject') OR length(btrim(COALESCE(p_review_note,'')))<12 THEN RAISE EXCEPTION 'Approval decision and independent verification note (12+ characters) required.'; END IF;
 SELECT * INTO v_req FROM public.fitness_new_member_requests WHERE id=p_request_id FOR UPDATE;
 IF v_req.id IS NULL OR v_req.status<>'pending' THEN RAISE EXCEPTION 'Request does not exist or is already reviewed.'; END IF;
 IF v_req.submitted_by=(SELECT auth.uid()) THEN RAISE EXCEPTION 'A different manager must independently verify your submission.' USING ERRCODE='42501'; END IF;
 IF p_action='reject' THEN
  UPDATE public.fitness_new_member_requests SET status='rejected',reviewed_by=(SELECT auth.uid()),reviewed_at=clock_timestamp(),review_note=btrim(p_review_note) WHERE id=v_req.id;
  RETURN jsonb_build_object('success',true,'status','rejected','request_id',v_req.id);
 END IF;
 v_ref:=nullif(btrim(COALESCE(p_verified_reference,'')),'');
 IF v_ref IS NULL OR length(v_ref)<6 THEN RAISE EXCEPTION 'Verify bank/POS credit or cash count and supply a unique external reconciliation reference.'; END IF;
 -- Cross-channel unique reference enforcement additionally occurs in the approval trigger.
 IF EXISTS(SELECT 1 FROM public.fitness_verified_collection_refs WHERE reference_key=lower(v_ref)) THEN RAISE EXCEPTION 'This verification reference was already used.'; END IF;
 SELECT * INTO v_plan FROM public.membership_plans WHERE id=v_req.plan_id AND active IS TRUE;
 IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Membership plan is unavailable.'; END IF;
 v_fee:=CASE WHEN v_plan.name='Family Plan' THEN 20000 WHEN v_plan.name='Personal Training Only' THEN 0 ELSE 7000 END;
 IF v_req.registration_amount<>v_fee OR v_req.total_amount<>v_req.plan_amount+v_fee OR (v_plan.name<>'Custom Plan' AND (v_req.plan_amount<>v_plan.price OR v_req.duration_days<>v_plan.duration_days)) THEN RAISE EXCEPTION 'Plan pricing or registration fee changed. Reject and create a fresh request.'; END IF;
 v_phone:=regexp_replace(v_req.phone,'[^0-9]','','g');
 IF EXISTS(SELECT 1 FROM public.members m WHERE lower(btrim(COALESCE(m.email,'')))=v_req.email OR right(regexp_replace(COALESCE(m.phone,''),'[^0-9]','','g'),10)=right(v_phone,10)) THEN RAISE EXCEPTION 'A matching profile already exists; reject this new-member request to prevent duplicates.'; END IF;
 INSERT INTO public.members(full_name,email,phone,source,notes) VALUES(v_req.full_name,v_req.email,v_req.phone,'management_approved_new_member','New member identity verified after independently verified payment request '||v_req.id::text) RETURNING id INTO v_member;
 v_start:=v_req.requested_start;
 INSERT INTO public.memberships(member_id,plan_id,plan_name,start_date,end_date,status,payment_status,source)
 VALUES(v_member,v_req.plan_id,v_plan.name,v_start,v_start+v_req.duration_days-1,'active','paid','management_approved_manual') RETURNING id INTO v_membership;
 INSERT INTO public.payments(member_id,membership_id,amount,currency,status,payment_method,provider,paid_at,metadata,source)
 VALUES(v_member,v_membership,v_req.total_amount,'NGN','success',v_req.method,'manual_verified',clock_timestamp(),jsonb_build_object('new_member_request_id',v_req.id,'receipt_number',v_req.receipt_number,'registration_amount',v_fee,'membership_amount',v_req.plan_amount,'submitted_by_auth_id',v_req.submitted_by,'approved_by_auth_id',(SELECT auth.uid()),'independent_verified_reference',v_ref,'verification_note',btrim(p_review_note),'plan_name',v_plan.name,'start_date',v_start,'end_date',v_start+v_req.duration_days-1),'management_approved_manual') RETURNING id INTO v_payment;
 UPDATE public.fitness_new_member_requests SET status='approved',reviewed_by=(SELECT auth.uid()),reviewed_at=clock_timestamp(),review_note=btrim(p_review_note),verified_reference=v_ref,member_id=v_member,membership_id=v_membership,payment_id=v_payment WHERE id=v_req.id;
 RETURN jsonb_build_object('success',true,'status','approved','request_id',v_req.id,'member_id',v_member,'membership_id',v_membership,'payment_id',v_payment,'receipt_number',v_req.receipt_number,'start_date',v_start,'end_date',v_start+v_req.duration_days-1);
END $function$
;
CREATE OR REPLACE FUNCTION public.reception_request_new_walkin(p_full_name text, p_email text, p_phone text, p_plan_id uuid, p_start_date date, p_duration_days integer, p_plan_amount numeric, p_method text, p_notes text, p_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_plan public.membership_plans%ROWTYPE; v_fee numeric; v_id uuid; v_receipt text; v_email text; v_phone text;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT EXISTS(SELECT 1 FROM public.staff_users s WHERE s.auth_user_id=(SELECT auth.uid()) AND s.active IS TRUE AND lower(s.role) IN ('reception','admin','owner','manager')) THEN RAISE EXCEPTION 'Active reception account required.' USING ERRCODE='42501'; END IF;
 v_email:=lower(btrim(COALESCE(p_email,''))); v_phone:=regexp_replace(COALESCE(p_phone,''),'[^0-9]','','g');
 IF length(btrim(COALESCE(p_full_name,'')))<3 OR v_email NOT LIKE '%@%.%' OR length(v_phone) NOT BETWEEN 10 AND 15 OR length(btrim(COALESCE(p_notes,'')))<12 THEN RAISE EXCEPTION 'Name, valid email, phone and collection note (12+ characters) required.'; END IF;
 IF EXISTS(SELECT 1 FROM public.members m WHERE lower(btrim(COALESCE(m.email,'')))=v_email OR right(regexp_replace(COALESCE(m.phone,''),'[^0-9]','','g'),10)=right(v_phone,10)) THEN RAISE EXCEPTION 'An existing member matches this email or phone. Find that profile or request returning-member verification instead.'; END IF;
 IF EXISTS(SELECT 1 FROM public.fitness_new_member_requests r WHERE r.status='pending' AND (lower(btrim(r.email))=v_email OR right(regexp_replace(r.phone,'[^0-9]','','g'),10)=right(v_phone,10))) THEN RAISE EXCEPTION 'A new-member payment request already exists for this email or phone.'; END IF;
 SELECT * INTO v_plan FROM public.membership_plans WHERE id=p_plan_id AND active IS TRUE;
 IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Select an active membership plan.'; END IF;
 v_fee:=CASE WHEN v_plan.name='Family Plan' THEN 20000 WHEN v_plan.name='Personal Training Only' THEN 0 ELSE 7000 END;
 IF p_duration_days NOT BETWEEN 1 AND 3650 OR (v_plan.name<>'Custom Plan' AND p_duration_days IS DISTINCT FROM v_plan.duration_days) THEN RAISE EXCEPTION 'Invalid plan duration.'; END IF;
 IF p_plan_amount IS NULL OR p_plan_amount<=0 OR p_plan_amount>100000000 OR (v_plan.name<>'Custom Plan' AND p_plan_amount IS DISTINCT FROM v_plan.price) THEN RAISE EXCEPTION 'Plan amount must match the official plan price; new members must include registration.'; END IF;
 IF p_start_date IS NULL OR p_start_date < (clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date-30 OR p_start_date > (clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date+365 THEN RAISE EXCEPTION 'Invalid requested membership date.'; END IF;
 IF p_method NOT IN ('Cash','POS','Bank Transfer') THEN RAISE EXCEPTION 'Choose cash, POS or bank transfer.'; END IF;
 INSERT INTO public.fitness_new_member_requests(full_name,email,phone,plan_id,requested_start,duration_days,plan_amount,registration_amount,total_amount,method,staff_reference,staff_notes,submitted_by)
 VALUES(btrim(p_full_name),v_email,btrim(p_phone),p_plan_id,p_start_date,p_duration_days,p_plan_amount,v_fee,p_plan_amount+v_fee,p_method,nullif(btrim(p_reference),''),btrim(p_notes),(SELECT auth.uid()))
 RETURNING id,receipt_number INTO v_id,v_receipt;
 RETURN jsonb_build_object('success',true,'status','pending','request_id',v_id,'receipt_number',v_receipt,'total_amount',p_plan_amount+v_fee,'membership_activated',false,'payment_verified',false,'member_profile_created',false);
END $function$
;
CREATE OR REPLACE FUNCTION public.reception_registration_credit(p_member_id uuid)
 RETURNS TABLE(registration_credit numeric, has_membership boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (
    select 1 from public.staff_users s
    where s.auth_user_id = (select auth.uid())
      and s.active is true
      and lower(s.role) in ('reception','admin','owner','manager')
  ) then
    raise exception 'Active reception account required.' using errcode='42501';
  end if;

  return query
  select
    coalesce((
      select sum(t.registration_amount)
      from public.reception_registration_only_transactions t
      where t.member_id = p_member_id
    ), 0::numeric) + coalesce((
      select sum(p.amount) from public.payments p where p.member_id=p_member_id
       and p.status='success' and p.source='public_join' and p.metadata->>'registration_only'='true'
    ),0::numeric),
    exists (
      select 1
      from public.memberships m
      where m.member_id = p_member_id
    );
end
$function$
;

