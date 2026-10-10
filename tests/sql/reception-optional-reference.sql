-- Exercise the live reception RPCs with synthetic records. All writes roll back.
DO $test$
DECLARE
 v_actor uuid;
 v_plan public.membership_plans%rowtype;
 v_today date := (clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date;
 v_method text;
 v_tag text;
 v_key uuid;
 v_member uuid;
 v_result jsonb;
 v_retry jsonb;
 v_blocked boolean;
 v_passed boolean := false;
 v_before_members bigint;
 v_before_payments bigint;
 v_before_refs bigint;
 v_count bigint;
 v_ref text := 'qa-ref-' || gen_random_uuid()::text;
BEGIN
 SELECT auth_user_id INTO v_actor FROM public.staff_users WHERE active AND lower(role) IN ('reception','admin','owner','manager') LIMIT 1;
 SELECT * INTO v_plan FROM public.membership_plans WHERE active AND name='Monthly Plan';
 IF v_actor IS NULL OR v_plan.id IS NULL THEN RAISE EXCEPTION 'Missing test prerequisites'; END IF;
 SELECT count(*) INTO v_before_members FROM public.members;
 SELECT count(*) INTO v_before_payments FROM public.payments;
 SELECT (SELECT count(*) FROM public.reception_direct_collection_refs) + (SELECT count(*) FROM public.reception_registration_only_collection_refs) INTO v_before_refs;
 BEGIN
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);

  FOREACH v_method IN ARRAY ARRAY['POS','Bank Transfer'] LOOP
   v_tag := replace(gen_random_uuid()::text,'-','');
   v_key := gen_random_uuid();
   v_result := public.reception_complete_registration_with_pt_custom_total(v_actor,'No Reference QA','qa-'||v_tag||'@example.invalid','0'||substr(translate(v_tag,'abcdef','123456'),1,14),v_plan.id,v_today,v_plan.duration_days,v_plan.price,v_method,'','',true,v_key,null,'',0,null,null);
   v_member := (v_result->>'member_id')::uuid;
   IF v_result->>'success' <> 'true' OR (v_result->>'amount')::numeric <> v_plan.price+7000 THEN RAISE EXCEPTION 'New member failed for %: %',v_method,v_result; END IF;
   IF NOT EXISTS (SELECT 1 FROM public.payments WHERE id=(v_result->>'payment_id')::uuid AND status='success' AND payment_method=v_method AND amount=v_plan.price+7000 AND metadata->>'staff_reference' IS NULL) THEN RAISE EXCEPTION 'New member payment data wrong for %',v_method; END IF;
   IF NOT EXISTS (SELECT 1 FROM public.reception_direct_transactions WHERE id=(v_result->>'transaction_id')::uuid AND staff_reference IS NULL AND method=v_method) THEN RAISE EXCEPTION 'Blank reference not stored as null'; END IF;

   SELECT count(*) INTO v_count FROM public.payments;
   v_retry := public.reception_complete_registration_with_pt_custom_total(v_actor,'No Reference QA','qa-'||v_tag||'@example.invalid','0'||substr(translate(v_tag,'abcdef','123456'),1,14),v_plan.id,v_today,v_plan.duration_days,v_plan.price,v_method,'','',true,v_key,null,'',0,null,null);
   IF v_retry->>'already_recorded' <> 'true' OR v_retry->>'payment_id' <> v_result->>'payment_id' OR (SELECT count(*) FROM public.payments) <> v_count THEN RAISE EXCEPTION 'Reference-free retry duplicated payment'; END IF;

   v_result := public.reception_complete_registration_with_pt_custom_total(v_actor,'','','',v_plan.id,(v_result->>'end_date')::date+1,v_plan.duration_days,v_plan.price,v_method,'',null,true,gen_random_uuid(),v_member,'',0,null,22000);
   IF (v_result->>'member_id')::uuid <> v_member OR (v_result->>'amount')::numeric <> 22000 OR (v_result->>'registration_fee')::numeric <> 0 THEN RAISE EXCEPTION 'Reference-free custom renewal failed for %',v_method; END IF;

   v_tag := replace(gen_random_uuid()::text,'-','');
   v_key := gen_random_uuid();
   v_result := public.reception_record_registration_only(v_actor,'Registration Only QA','rego-'||v_tag||'@example.invalid','1'||substr(translate(v_tag,'abcdef','123456'),1,14),7000,v_method,'','  ',true,v_key);
   IF v_result->>'success' <> 'true' OR v_result->>'access_active' <> 'false' OR (v_result->>'amount')::numeric <> 7000 THEN RAISE EXCEPTION 'Reference-free registration only failed for %',v_method; END IF;
   SELECT count(*) INTO v_count FROM public.payments;
   v_retry := public.reception_record_registration_only(v_actor,'Registration Only QA','rego-'||v_tag||'@example.invalid','1'||substr(translate(v_tag,'abcdef','123456'),1,14),7000,v_method,'','',true,v_key);
   IF v_retry->>'already_recorded' <> 'true' OR (SELECT count(*) FROM public.payments) <> v_count THEN RAISE EXCEPTION 'Registration-only retry duplicated payment'; END IF;
  END LOOP;

  IF (SELECT (SELECT count(*) FROM public.reception_direct_collection_refs)+(SELECT count(*) FROM public.reception_registration_only_collection_refs)) <> v_before_refs THEN RAISE EXCEPTION 'Blank references were added to duplicate-reference indexes'; END IF;

  -- Existing clients that supply real references still receive duplicate protection.
  v_tag := replace(gen_random_uuid()::text,'-','');
  v_result := public.reception_complete_registration_with_pt_custom_total(v_actor,'Supplied Reference QA','ref-'||v_tag||'@example.invalid','2'||substr(translate(v_tag,'abcdef','123456'),1,14),v_plan.id,v_today,v_plan.duration_days,v_plan.price,'POS','',v_ref,true,gen_random_uuid(),null,'',0,null,null);
  v_blocked := false;
  BEGIN
   v_tag := replace(gen_random_uuid()::text,'-','');
   PERFORM public.reception_record_registration_only(v_actor,'Duplicate Reference QA','dup-'||v_tag||'@example.invalid','3'||substr(translate(v_tag,'abcdef','123456'),1,14),7000,'Bank Transfer','',v_ref,true,gen_random_uuid());
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE 'This POS/bank reference is already recorded%' THEN RAISE; END IF;
   v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Supplied reference duplicate protection removed'; END IF;

  -- A reference-free request still needs staff confirmation of actual money received.
  v_blocked := false;
  BEGIN
   PERFORM public.reception_complete_registration_with_pt_custom_total(v_actor,'Unpaid QA','unpaid@example.invalid','08012345678',v_plan.id,v_today,v_plan.duration_days,v_plan.price,'Bank Transfer','','',false,gen_random_uuid(),null,'',0,null,null);
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT LIKE 'Confirm actual receipt%' THEN RAISE; END IF;
   v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Unconfirmed payment was accepted'; END IF;

  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
  v_blocked := false;
  BEGIN
   PERFORM public.reception_complete_registration_with_pt_custom_total(v_actor,'Unauthorized QA','unauth@example.invalid','08012345678',v_plan.id,v_today,v_plan.duration_days,v_plan.price,'POS','','',true,gen_random_uuid(),null,'',0,null,null);
  EXCEPTION WHEN insufficient_privilege THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Browser could bypass service-only registration'; END IF;

  v_passed := true;
  RAISE EXCEPTION USING ERRCODE='ZQ003', MESSAGE='Roll back synthetic reference QA records';
 EXCEPTION WHEN SQLSTATE 'ZQ003' THEN
  IF NOT v_passed THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.members) <> v_before_members OR (SELECT count(*) FROM public.payments) <> v_before_payments OR (SELECT (SELECT count(*) FROM public.reception_direct_collection_refs)+(SELECT count(*) FROM public.reception_registration_only_collection_refs)) <> v_before_refs THEN RAISE EXCEPTION 'Synthetic records were not rolled back'; END IF;
END
$test$;
SELECT 'PASS: POS/bank new members, custom renewals, registration-only, retries, optional supplied reference duplicate protection, funds confirmation and service-only access; all synthetic writes rolled back' AS result;
