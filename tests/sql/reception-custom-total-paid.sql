-- Uses synthetic records inside an exception subtransaction; all test writes roll back.
-- Requires the migration and existing production guards. No real member is changed.
DO $test$
DECLARE
 v_actor uuid; v_plan public.membership_plans%rowtype; v_family public.membership_plans%rowtype;
 v_pt public.membership_plans%rowtype; v_trainer uuid;
 v_today date := (clock_timestamp() at time zone 'Africa/Lagos')::date;
 v_key uuid := gen_random_uuid(); v_tag text := replace(gen_random_uuid()::text,'-','');
 v_member uuid; v_result jsonb; v_retry jsonb; v_amount numeric; v_blocked boolean;
 v_before_members bigint; v_before_payments bigint; v_count bigint;
 v_passed boolean := false;
BEGIN
 SELECT auth_user_id INTO v_actor FROM public.staff_users WHERE active AND lower(role) IN ('reception','admin','owner','manager') LIMIT 1;
 SELECT * INTO v_plan FROM public.membership_plans WHERE active AND name='Monthly Plan';
 SELECT * INTO v_family FROM public.membership_plans WHERE active AND name='Family Plan';
 SELECT * INTO v_pt FROM public.membership_plans WHERE active AND name='Personal Training';
 SELECT staff_profile_id INTO v_trainer FROM public.pt_trainers WHERE active LIMIT 1;
 IF v_actor IS NULL OR v_plan.id IS NULL OR v_family.id IS NULL OR v_pt.id IS NULL OR v_trainer IS NULL THEN RAISE EXCEPTION 'Missing test prerequisites'; END IF;
 SELECT count(*) INTO v_before_members FROM public.members;
 SELECT count(*) INTO v_before_payments FROM public.payments;
 BEGIN
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);

  v_result := public.reception_complete_registration_with_pt_custom_total(v_actor,'Custom Payment QA','qa-'||v_tag||'@example.invalid','0'||substr(translate(v_tag,'abcdef','123456'),1,14),v_plan.id,v_today,v_plan.duration_days,v_plan.price,'Cash','Custom amount QA','',true,v_key,null,'',20,null,25000);
  v_member := (v_result->>'member_id')::uuid;
  IF (v_result->>'amount')::numeric <> 25000 OR (v_result->>'registration_fee')::numeric <> 7000 OR (v_result->>'discount_percentage')::integer <> 0 OR (v_result->>'subtotal_amount')::numeric <> v_plan.price+7000 THEN RAISE EXCEPTION 'New member override or discount precedence wrong: %',v_result; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.payments WHERE id=(v_result->>'payment_id')::uuid AND amount=25000 AND status='success' AND (metadata->>'custom_total_paid_naira')::numeric=25000 AND (metadata->>'membership_amount_naira')::numeric=v_plan.price) THEN RAISE EXCEPTION 'Payment audit / revenue amount wrong'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.reception_direct_transactions WHERE id=(v_result->>'transaction_id')::uuid AND amount=25000 AND custom_total_paid=25000 AND plan_amount=v_plan.price) THEN RAISE EXCEPTION 'Transaction audit wrong'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.memberships WHERE id=(v_result->>'membership_id')::uuid AND plan_id=v_plan.id AND start_date=v_today AND end_date=v_today+v_plan.duration_days-1 AND payment_status='paid') THEN RAISE EXCEPTION 'Custom amount changed plan dates/status'; END IF;

  SELECT count(*) INTO v_count FROM public.payments;
  v_retry := public.reception_complete_registration_with_pt_custom_total(v_actor,'Custom Payment QA','qa-'||v_tag||'@example.invalid','0'||substr(translate(v_tag,'abcdef','123456'),1,14),v_plan.id,v_today,v_plan.duration_days,v_plan.price,'Cash','Changed retry','',true,v_key,null,'',0,null,50000);
  IF v_retry->>'already_recorded' <> 'true' OR (v_retry->>'amount')::numeric <> 25000 OR (v_retry->>'custom_total_paid')::numeric <> 25000 OR (SELECT count(*) FROM public.payments) <> v_count THEN RAISE EXCEPTION 'Retry changed or duplicated payment'; END IF;

  v_retry := public.reception_complete_registration_with_pt_custom_total(v_actor,'','','',v_plan.id,(v_result->>'end_date')::date+1,v_plan.duration_days,v_plan.price,'Cash','','',true,gen_random_uuid(),v_member,'',0,null,22000);
  IF (v_retry->>'amount')::numeric <> 22000 OR (v_retry->>'registration_fee')::numeric <> 0 OR (v_retry->>'member_id')::uuid <> v_member THEN RAISE EXCEPTION 'Existing member custom renewal wrong'; END IF;

  v_retry := public.reception_complete_registration_with_pt_custom_total(v_actor,'','','',v_plan.id,(v_retry->>'end_date')::date+1,v_plan.duration_days,v_plan.price,'Cash','','',true,gen_random_uuid(),v_member,'',10,null,null);
  IF (v_retry->>'amount')::numeric <> round(v_plan.price*0.9,2) OR (v_retry->>'discount_amount')::numeric <> round(v_plan.price*0.1,2) THEN RAISE EXCEPTION 'Blank override failed to preserve percentage discount'; END IF;

  v_retry := public.reception_complete_registration_with_pt_custom_total(v_actor,'Family Custom QA','family-'||v_tag||'@example.invalid','1'||substr(translate(v_tag,'abcdef','123456'),1,13)||'1',v_family.id,v_today+2,v_family.duration_days,v_family.price,'Cash','','',true,gen_random_uuid(),null,'',0,null,50000);
  IF (v_retry->>'amount')::numeric <> 50000 OR (v_retry->>'registration_fee')::numeric <> 20000 OR (v_retry->>'start_date')::date <> v_today+2 THEN RAISE EXCEPTION 'Family custom total double-charged registration or changed future date'; END IF;

  v_retry := public.reception_complete_registration_with_pt_custom_total(v_actor,'','','',v_pt.id,v_today,v_pt.duration_days,v_pt.price,'Cash','','',true,gen_random_uuid(),v_member,'',0,v_trainer,23000.50);
  IF (v_retry->>'amount')::numeric <> 23000.50 OR (v_retry->>'pt_trainer_staff_profile_id')::uuid <> v_trainer OR v_retry->>'pt_assignment_pending' <> 'false' THEN RAISE EXCEPTION 'PT custom price or coach assignment failed: %',v_retry; END IF;

  v_retry := public.reception_complete_registration_with_pt_custom_total(v_actor,'Standard QA','standard-'||v_tag||'@example.invalid','2'||substr(translate(v_tag,'abcdef','123456'),1,13)||'2',v_plan.id,v_today,v_plan.duration_days,v_plan.price,'Cash','','',true,gen_random_uuid(),null,'',0,null,null);
  IF (v_retry->>'amount')::numeric <> v_plan.price+7000 THEN RAISE EXCEPTION 'Blank custom amount changed regular registration'; END IF;

  FOR v_amount IN SELECT x FROM (VALUES (0::numeric),(50000::numeric),(23000.50::numeric)) a(x) LOOP
   v_retry := public.reception_complete_registration_with_pt_custom_total(v_actor,'Bounds QA','bounds-'||replace(gen_random_uuid()::text,'-','')||'@example.invalid','3'||substr(translate(replace(gen_random_uuid()::text,'-',''),'abcdef','123456'),1,14),v_plan.id,v_today,v_plan.duration_days,v_plan.price,'Cash','','',true,gen_random_uuid(),null,'REGSF',0,null,v_amount);
   IF (v_retry->>'amount')::numeric <> v_amount OR (v_retry->>'registration_fee')::numeric <> 0 THEN RAISE EXCEPTION 'Valid override / coupon failed'; END IF;
  END LOOP;

  FOR v_amount IN SELECT x FROM (VALUES (-1::numeric),(100000001::numeric),(1.001::numeric),('NaN'::numeric),('Infinity'::numeric)) a(x) LOOP
   v_blocked := false;
   BEGIN
    PERFORM public.reception_complete_registration_with_pt_custom_total(v_actor,'Invalid QA','invalid-'||v_tag||'@example.invalid','4'||substr(translate(v_tag,'abcdef','123456'),1,14),v_plan.id,v_today,v_plan.duration_days,v_plan.price,'Cash','','',true,gen_random_uuid(),null,'',0,null,v_amount);
   EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Custom total paid must%' THEN RAISE; END IF;
    v_blocked := true;
   END;
   IF NOT v_blocked THEN RAISE EXCEPTION 'Invalid custom amount accepted: %',v_amount; END IF;
  END LOOP;

  IF has_function_privilege('anon','public.reception_complete_registration_with_pt_custom_total(uuid,text,text,text,uuid,date,integer,numeric,text,text,text,boolean,uuid,uuid,text,integer,uuid,numeric)','EXECUTE') OR has_function_privilege('authenticated','public.reception_complete_registration_custom_total(uuid,text,text,text,uuid,date,integer,numeric,text,text,text,boolean,uuid,uuid,text,integer,numeric)','EXECUTE') THEN RAISE EXCEPTION 'Server-only custom payment function exposed'; END IF;
  v_passed := true;
  RAISE EXCEPTION USING ERRCODE='ZQ001', MESSAGE='Roll back synthetic QA records';
 EXCEPTION WHEN SQLSTATE 'ZQ001' THEN
  IF NOT v_passed THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.members) <> v_before_members OR (SELECT count(*) FROM public.payments) <> v_before_payments THEN RAISE EXCEPTION 'Synthetic QA records were not rolled back'; END IF;
END
$test$;
SELECT 'PASS: custom new/renewal/family/PT, amount precedence, defaults, discounts, audit, dates, idempotency, bounds, service-only permissions; all QA writes rolled back' AS result;

