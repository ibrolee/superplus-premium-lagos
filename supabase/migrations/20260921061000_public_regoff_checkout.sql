-- STAGED ONLY. Apply in a separate non-production database for testing; do not modify live checkout without approval.
-- Called exclusively from the signed Paystack verification Edge Function after independently querying Paystack.
-- Returning members with existing gym records reuse their profile by email. OTP login links unlinked records.
-- REGOFF is a reusable single code that waives registration only; not a plan discount and not an admin request.
CREATE OR REPLACE FUNCTION public.finalize_public_join_payment(
 p_reference text,p_plan_id text,p_full_name text,p_email text,p_phone text,p_birth_day integer,p_birth_month integer,
 p_paid_at timestamptz,p_channel text,p_customer_code text,p_coupon_code text,p_verified_amount_kobo bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
 v_plan public.membership_plans%ROWTYPE;
 v_plan_name text; v_fee numeric; v_code text; v_email text; v_ref text;
 v_member uuid; v_membership uuid; v_payment uuid; v_existing record;
 v_today date; v_start date; v_end date; v_current_end date;
BEGIN
 IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Paystack verification service only.' USING ERRCODE='42501'; END IF;
 v_ref:=btrim(COALESCE(p_reference,'')); v_email:=lower(btrim(COALESCE(p_email,'')));
 IF length(v_ref)<10 OR length(btrim(COALESCE(p_full_name,'')))<2 OR v_email NOT LIKE '%@%.%' OR length(btrim(COALESCE(p_phone,'')))<7 THEN
  RAISE EXCEPTION 'Payment reference or customer information is invalid.';
 END IF;
 IF p_birth_day NOT BETWEEN 1 AND 31 OR p_birth_month NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Birth day/month invalid.'; END IF;
 v_code:=upper(btrim(COALESCE(p_coupon_code,'')));
 IF v_code NOT IN ('','REGOFF') THEN RAISE EXCEPTION 'Invalid coupon.'; END IF;
 v_plan_name:=CASE p_plan_id
  WHEN 'daily' THEN 'Daily Plan' WHEN 'weekly' THEN 'Weekly Plan' WHEN 'monthly' THEN 'Monthly Plan'
  WHEN 'quarterly' THEN 'Quarterly' WHEN 'semi-annual' THEN 'Semi-Annual' WHEN 'yearly' THEN 'Yearly'
  WHEN 'vip-silver' THEN 'Monthly VIP Silver' WHEN 'vip-gold' THEN 'Monthly VIP Gold'
  WHEN 'family' THEN 'Family Plan' WHEN 'personal-training' THEN 'Personal Training' ELSE NULL END;
 IF v_plan_name IS NULL THEN RAISE EXCEPTION 'Unknown plan.'; END IF;
 SELECT * INTO v_plan FROM public.membership_plans WHERE name=v_plan_name AND active IS TRUE LIMIT 1;
 IF v_plan.id IS NULL OR v_plan.price IS NULL OR v_plan.price<=0 OR v_plan.duration_days IS NULL THEN RAISE EXCEPTION 'Plan not configured.'; END IF;
 v_fee:=CASE WHEN v_code='REGOFF' THEN 0 WHEN v_plan_name='Family Plan' THEN 20000
  WHEN v_plan_name IN('Semi-Annual','Monthly VIP Gold') THEN 3000 ELSE 7000 END;
 IF p_verified_amount_kobo IS DISTINCT FROM ((v_plan.price+v_fee)*100)::bigint THEN RAISE EXCEPTION 'Verified amount does not match plan and REGOFF pricing.'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paystack-ref:'||lower(v_ref),0));
 SELECT p.id,p.member_id,p.membership_id INTO v_existing FROM public.payments p WHERE p.paystack_reference=v_ref AND p.status='success' LIMIT 1;
 IF v_existing.id IS NOT NULL THEN
  SELECT start_date,end_date INTO v_start,v_end FROM public.memberships WHERE id=v_existing.membership_id;
  RETURN jsonb_build_object('success',true,'already_processed',true,'member_id',v_existing.member_id,'membership_id',v_existing.membership_id,'payment_id',v_existing.id,'plan_name',v_plan.name,'start_date',v_start,'end_date',v_end,'email',v_email,'reference',v_ref);
 END IF;
 IF EXISTS(SELECT 1 FROM public.payments WHERE paystack_reference=v_ref) THEN RAISE EXCEPTION 'Payment reference is already present; investigate before retrying.'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paystack-email:'||v_email,0));
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
