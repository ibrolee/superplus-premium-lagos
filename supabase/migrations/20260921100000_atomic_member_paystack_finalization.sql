-- One transaction for membership and payment; service role only. No historical imports are changed.
-- Called ONLY after the Edge Function independently verifies the Paystack transaction.
CREATE OR REPLACE FUNCTION public.finalize_member_paystack_payment(
  p_reference text, p_member_id uuid, p_auth_user_id uuid, p_plan_id text,
  p_amount_kobo bigint, p_currency text, p_paid_at timestamptz,
  p_channel text, p_customer_code text, p_transaction_id bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
  v_reference text := btrim(coalesce(p_reference, ''));
  v_name text;
  v_plan public.membership_plans%ROWTYPE;
  v_member public.members%ROWTYPE;
  v_existing public.payments%ROWTYPE;
  v_membership uuid;
  v_payment uuid;
  v_start date;
  v_end date;
  v_previous_end date;
  v_paid_day date;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Only the payment verification service can finalize a transaction.' USING ERRCODE='42501';
  END IF;
  IF length(v_reference) < 12 OR p_member_id IS NULL OR p_auth_user_id IS NULL
     OR p_amount_kobo IS NULL OR p_amount_kobo <= 0 OR p_currency IS DISTINCT FROM 'NGN'
     OR p_paid_at IS NULL OR p_transaction_id IS NULL OR p_transaction_id <= 0 THEN
    RAISE EXCEPTION 'Verified Paystack transaction has missing or invalid details.';
  END IF;
  v_name := CASE p_plan_id
    WHEN 'daily' THEN 'Daily Plan' WHEN 'weekly' THEN 'Weekly Plan'
    WHEN 'monthly' THEN 'Monthly Plan' WHEN 'quarterly' THEN 'Quarterly'
    WHEN 'semi-annual' THEN 'Semi-Annual' WHEN 'yearly' THEN 'Yearly'
    WHEN 'vip-silver' THEN 'Monthly VIP Silver' WHEN 'vip-gold' THEN 'Monthly VIP Gold'
    WHEN 'family' THEN 'Family Plan' WHEN 'personal-training' THEN 'Personal Training'
    ELSE NULL END;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Unknown Paystack membership plan.'; END IF;
  SELECT * INTO v_plan FROM public.membership_plans
    WHERE name=v_name AND active IS TRUE LIMIT 1;
  IF v_plan.id IS NULL OR v_plan.duration_days < 1 OR v_plan.price <= 0
     OR p_amount_kobo IS DISTINCT FROM (v_plan.price*100)::bigint THEN
    RAISE EXCEPTION 'Verified amount does not match the configured membership plan.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('spf-paystack:' || v_reference, 0));
  SELECT * INTO v_existing FROM public.payments WHERE paystack_reference=v_reference FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.member_id IS DISTINCT FROM p_member_id
       OR v_existing.amount IS DISTINCT FROM v_plan.price
       OR v_existing.currency IS DISTINCT FROM 'NGN'
       OR v_existing.source IS DISTINCT FROM 'paystack'
       OR v_existing.metadata->>'plan_id' IS DISTINCT FROM p_plan_id THEN
      RAISE EXCEPTION 'Existing payment conflicts with verified transaction. Manual investigation required.';
    END IF;
    IF v_existing.status='success' THEN
      IF v_existing.membership_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.memberships ms WHERE ms.id=v_existing.membership_id
          AND ms.member_id=p_member_id AND ms.payment_status='paid'
      ) THEN RAISE EXCEPTION 'Previously finalized payment has an invalid membership.'; END IF;
      SELECT start_date,end_date INTO v_start,v_end FROM public.memberships
        WHERE id=v_existing.membership_id;
      RETURN pg_catalog.jsonb_build_object('success',true,'already_processed',true,
        'membership_id',v_existing.membership_id,'payment_id',v_existing.id,
        'plan_name',v_name,'start_date',v_start,'end_date',v_end,'reference',v_reference);
    END IF;
    IF v_existing.status <> 'pending'
       OR v_existing.metadata->>'auth_user_id' IS DISTINCT FROM p_auth_user_id::text THEN
      RAISE EXCEPTION 'Existing payment is not a matching pending checkout.';
    END IF;
  END IF;
  SELECT * INTO v_member FROM public.members WHERE id=p_member_id FOR UPDATE;
  IF v_member.id IS NULL OR v_member.auth_user_id IS DISTINCT FROM p_auth_user_id THEN
    RAISE EXCEPTION 'Verified transaction does not belong to the linked member account.';
  END IF;

  v_paid_day := (p_paid_at AT TIME ZONE 'Africa/Lagos')::date;
  SELECT max(end_date) INTO v_previous_end FROM public.memberships
    WHERE member_id=p_member_id AND status='active' AND payment_status='paid'
      AND end_date >= v_paid_day;
  v_start := CASE WHEN v_previous_end IS NOT NULL THEN v_previous_end+1 ELSE v_paid_day END;
  v_end := v_start+v_plan.duration_days-1;
  INSERT INTO public.memberships(member_id,plan_id,plan_name,start_date,end_date,status,payment_status,source)
    VALUES(p_member_id,v_plan.id,v_plan.name,v_start,v_end,'active','paid','paystack')
    RETURNING id INTO v_membership;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.payments SET membership_id=v_membership,status='success',
      payment_method=coalesce(nullif(btrim(p_channel),''),'paystack'),provider='paystack',
      paystack_customer_code=nullif(btrim(coalesce(p_customer_code,'')),''),paid_at=p_paid_at,
      metadata=coalesce(metadata,'{}'::jsonb) || pg_catalog.jsonb_build_object(
        'source','member_dashboard','plan_id',p_plan_id,'plan_name',v_plan.name,
        'amount_naira',v_plan.price,'duration_days',v_plan.duration_days,
        'auth_user_id',p_auth_user_id,'member_id',p_member_id,
        'paystack_transaction_id',p_transaction_id)
    WHERE id=v_existing.id RETURNING id INTO v_payment;
  ELSE
    -- Backward-compatible recovery for checkouts started before pending records existed.
    INSERT INTO public.payments(member_id,membership_id,amount,currency,status,payment_method,
      provider,paystack_reference,paystack_customer_code,paid_at,source,metadata)
    VALUES(p_member_id,v_membership,v_plan.price,'NGN','success',
      coalesce(nullif(btrim(p_channel),''),'paystack'),'paystack',v_reference,
      nullif(btrim(coalesce(p_customer_code,'')),''),p_paid_at,'paystack',
      pg_catalog.jsonb_build_object('source','member_dashboard','plan_id',p_plan_id,
        'plan_name',v_plan.name,'amount_naira',v_plan.price,'duration_days',v_plan.duration_days,
        'auth_user_id',p_auth_user_id,'member_id',p_member_id,
        'paystack_transaction_id',p_transaction_id)) RETURNING id INTO v_payment;
  END IF;
  RETURN pg_catalog.jsonb_build_object('success',true,'already_processed',false,
    'membership_id',v_membership,'payment_id',v_payment,'plan_name',v_plan.name,
    'start_date',v_start,'end_date',v_end,'reference',v_reference);
END $fn$;
REVOKE ALL ON FUNCTION public.finalize_member_paystack_payment(text,uuid,uuid,text,bigint,text,timestamptz,text,text,bigint)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_member_paystack_payment(text,uuid,uuid,text,bigint,text,timestamptz,text,text,bigint)
  TO service_role;
