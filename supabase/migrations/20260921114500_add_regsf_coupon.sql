-- Add REGSF as a registration-fee waiver coupon while keeping REGOFF compatible
-- for older pending checkout metadata and existing staff workflows.
ALTER TABLE public.reception_direct_transactions
 DROP CONSTRAINT IF EXISTS reception_direct_transactions_coupon_code_check;
ALTER TABLE public.reception_direct_transactions
 ADD CONSTRAINT reception_direct_transactions_coupon_code_check
 CHECK (coupon_code IS NULL OR coupon_code IN ('REGOFF','REGSF'));

CREATE OR REPLACE FUNCTION public.finalize_public_join_payment(
 p_reference text,p_plan_id text,p_full_name text,p_email text,p_phone text,p_birth_day integer,p_birth_month integer,
 p_paid_at timestamptz,p_channel text,p_customer_code text,p_coupon_code text,p_verified_amount_kobo bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
 v_plan public.membership_plans%ROWTYPE;
 v_plan_name text; v_fee numeric; v_code text; v_email text; v_ref text;
 v_member uuid; v_membership uuid; v_payment uuid; v_existing record;
 v_today date; v_start date; v_end date; v_current_end date; v_email_matches integer;
BEGIN
 IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Paystack verification service only.' USING ERRCODE='42501'; END IF;
 v_ref:=btrim(COALESCE(p_reference,'')); v_email:=lower(btrim(COALESCE(p_email,'')));
 IF length(v_ref)<10 OR length(btrim(COALESCE(p_full_name,'')))<2 OR v_email NOT LIKE '%@%.%' OR length(btrim(COALESCE(p_phone,'')))<7 THEN
  RAISE EXCEPTION 'Payment reference or customer information is invalid.';
 END IF;
 IF p_birth_day NOT BETWEEN 1 AND 31 OR p_birth_month NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Birth day/month invalid.'; END IF;
 v_code:=upper(btrim(COALESCE(p_coupon_code,'')));
 IF v_code NOT IN ('','REGOFF','REGSF') THEN RAISE EXCEPTION 'Invalid coupon.'; END IF;
 v_plan_name:=CASE p_plan_id
  WHEN 'daily' THEN 'Daily Plan' WHEN 'weekly' THEN 'Weekly Plan' WHEN 'monthly' THEN 'Monthly Plan'
  WHEN 'quarterly' THEN 'Quarterly' WHEN 'semi-annual' THEN 'Semi-Annual' WHEN 'yearly' THEN 'Yearly'
  WHEN 'vip-silver' THEN 'Monthly VIP Silver' WHEN 'vip-gold' THEN 'Monthly VIP Gold'
  WHEN 'family' THEN 'Family Plan' WHEN 'personal-training' THEN 'Personal Training' ELSE NULL END;
 IF v_plan_name IS NULL THEN RAISE EXCEPTION 'Unknown plan.'; END IF;
 SELECT * INTO v_plan FROM public.membership_plans WHERE name=v_plan_name AND active IS TRUE LIMIT 1;
 IF v_plan.id IS NULL OR v_plan.price IS NULL OR v_plan.price<=0 OR v_plan.duration_days IS NULL THEN RAISE EXCEPTION 'Plan not configured.'; END IF;
 v_fee:=CASE WHEN v_code IN ('REGOFF','REGSF') THEN 0 WHEN v_plan_name='Family Plan' THEN 20000
  WHEN v_plan_name IN('Semi-Annual','Monthly VIP Gold') THEN 3000 ELSE 7000 END;
 IF p_verified_amount_kobo IS DISTINCT FROM ((v_plan.price+v_fee)*100)::bigint THEN RAISE EXCEPTION 'Verified amount does not match plan and coupon pricing.'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paystack-ref:'||lower(v_ref),0));
 SELECT p.id,p.member_id,p.membership_id INTO v_existing FROM public.payments p WHERE p.paystack_reference=v_ref AND p.status='success' LIMIT 1;
 IF v_existing.id IS NOT NULL THEN
  SELECT start_date,end_date INTO v_start,v_end FROM public.memberships WHERE id=v_existing.membership_id;
  RETURN jsonb_build_object('success',true,'already_processed',true,'member_id',v_existing.member_id,'membership_id',v_existing.membership_id,'payment_id',v_existing.id,'plan_name',v_plan.name,'start_date',v_start,'end_date',v_end,'email',v_email,'reference',v_ref);
 END IF;
 IF EXISTS(SELECT 1 FROM public.payments WHERE paystack_reference=v_ref) THEN RAISE EXCEPTION 'Payment reference is already present; investigate before retrying.'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paystack-email:'||v_email,0));
 SELECT COUNT(*) INTO v_email_matches FROM public.members WHERE lower(btrim(COALESCE(email,'')))=v_email;
 IF v_email_matches>1 THEN RAISE EXCEPTION 'Multiple member records share this email. Ask reception to correct the profiles, then retry payment verification with the same reference. Do not pay again.'; END IF;
 SELECT id INTO v_member FROM public.members WHERE lower(btrim(COALESCE(email,'')))=v_email ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF v_member IS NULL THEN
  INSERT INTO public.members(full_name,email,phone,birth_day,birth_month,source)
   VALUES(btrim(p_full_name),v_email,btrim(p_phone),p_birth_day,p_birth_month,'website') RETURNING id INTO v_member;
 END IF;
 v_today:=(clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date;
 SELECT max(end_date) INTO v_current_end FROM public.memberships WHERE member_id=v_member AND status='active' AND payment_status='paid' AND end_date>=v_today;
 v_start:=CASE WHEN v_current_end IS NOT NULL THEN v_current_end+1 ELSE v_today END;
 v_end:=v_start+v_plan.duration_days-1;
 INSERT INTO public.memberships(member_id,plan_id,plan_name,start_date,end_date,status,payment_status,source)
  VALUES(v_member,v_plan.id,v_plan.name,v_start,v_end,'active','paid','public_join') RETURNING id INTO v_membership;
 INSERT INTO public.payments(member_id,membership_id,amount,currency,status,payment_method,provider,paystack_reference,paystack_customer_code,paid_at,source,metadata)
  VALUES(v_member,v_membership,v_plan.price+v_fee,'NGN','success',nullif(btrim(COALESCE(p_channel,'')),''),'paystack',v_ref,nullif(btrim(COALESCE(p_customer_code,'')),''),COALESCE(p_paid_at,clock_timestamp()),'public_join',
   jsonb_build_object('source','public_join','plan_id',p_plan_id,'plan_name',v_plan.name,'membership_amount_naira',v_plan.price,'registration_amount_naira',v_fee,'total_amount_naira',v_plan.price+v_fee,'coupon_code',nullif(v_code,''),'duration_days',v_plan.duration_days,'email',v_email,'paystack_channel',p_channel,'record_type','standard_payment')) RETURNING id INTO v_payment;
 RETURN jsonb_build_object('success',true,'member_id',v_member,'membership_id',v_membership,'payment_id',v_payment,'plan_name',v_plan.name,'start_date',v_start,'end_date',v_end,'email',v_email,'reference',v_ref,'coupon_code',nullif(v_code,''));
END $fn$;
REVOKE ALL ON FUNCTION public.finalize_public_join_payment(text,text,text,text,text,integer,integer,timestamptz,text,text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_public_join_payment(text,text,text,text,text,integer,integer,timestamptz,text,text,text,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.reception_complete_registration(
 p_actor_id uuid, p_full_name text, p_email text, p_phone text, p_plan_id uuid,
 p_start_date date, p_duration_days integer, p_plan_amount numeric, p_method text,
 p_staff_note text, p_staff_reference text, p_funds_confirmed boolean, p_idempotency_key uuid,
 p_member_id uuid, p_coupon_code text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
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
    WHEN v_plan.name IN ('Semi-Annual','Monthly VIP Gold') THEN 3000 ELSE 7000 END
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
END $fn$;
REVOKE ALL ON FUNCTION public.reception_complete_registration(uuid,text,text,text,uuid,date,integer,numeric,text,text,text,boolean,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reception_complete_registration(uuid,text,text,text,uuid,date,integer,numeric,text,text,text,boolean,uuid,uuid,text) TO service_role;
