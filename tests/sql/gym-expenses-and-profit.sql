-- End-to-end database checks with synthetic records; all test writes roll back.
DO $qa$
DECLARE
 v_admin uuid; v_other uuid; v_id uuid := gen_random_uuid(); v_report jsonb; v_before jsonb;
 v_payments bigint; v_expenses bigint; v_passed boolean := false; v_blocked boolean;
BEGIN
 SELECT auth_user_id INTO v_admin FROM public.staff_users WHERE active AND lower(role) IN ('admin','owner') LIMIT 1;
 SELECT auth_user_id INTO v_other FROM public.staff_users WHERE active AND lower(role) NOT IN ('admin','owner') LIMIT 1;
 IF v_admin IS NULL OR v_other IS NULL THEN RAISE EXCEPTION 'Missing permission test actors'; END IF;
 SELECT count(*) INTO v_payments FROM public.payments;
 SELECT count(*) INTO v_expenses FROM public.gym_expenses;
 BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  PERFORM set_config('role','authenticated',true);
  v_before := public.admin_get_finance_month(DATE '2026-10-01');
  INSERT INTO public.gym_expenses(id,expense_date,category,description,amount)
   VALUES(v_id,DATE '2026-10-01','internet','QA internet',1000);
  INSERT INTO public.gym_expenses(expense_date,category,description,amount) VALUES
   (DATE '2026-10-02','electricity','QA electricity',2000),
   (DATE '2026-10-03','petrol','QA petrol',3000),
   (DATE '2026-10-04','gas','QA gas',4000),
   (DATE '2026-10-05','other','QA other',5000);
  v_report := public.admin_get_finance_month(DATE '2026-10-01');
  IF (v_report->>'expense_total')::numeric <> (v_before->>'expense_total')::numeric+15000 OR (v_report->>'expense_count')::integer <> (v_before->>'expense_count')::integer+5 THEN RAISE EXCEPTION 'Category totals incorrect'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.gym_expenses WHERE id=v_id AND created_by=v_admin AND updated_by=v_admin) THEN RAISE EXCEPTION 'Expense actor audit missing'; END IF;
  UPDATE public.gym_expenses SET amount=1200 WHERE id=v_id;
  v_report := public.admin_get_finance_month(DATE '2026-10-01');
  IF (v_report->>'expense_total')::numeric <> (v_before->>'expense_total')::numeric+15200 THEN RAISE EXCEPTION 'Edit total incorrect'; END IF;
  UPDATE public.gym_expenses SET voided_at=clock_timestamp() WHERE id=v_id;
  v_report := public.admin_get_finance_month(DATE '2026-10-01');
  IF (v_report->>'expense_total')::numeric <> (v_before->>'expense_total')::numeric+14000 OR NOT EXISTS(SELECT 1 FROM public.gym_expenses WHERE id=v_id AND voided_by=v_admin) THEN RAISE EXCEPTION 'Removed expense remains in totals or audit missing'; END IF;

  v_blocked := false;
  BEGIN INSERT INTO public.gym_expenses(expense_date,category,description,amount) VALUES(DATE '2026-09-30','gas','Before start',100); EXCEPTION WHEN check_violation THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Pre-October expense accepted'; END IF;
  v_blocked := false;
  BEGIN PERFORM public.admin_get_finance_month(DATE '2026-09-01'); EXCEPTION WHEN raise_exception THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Pre-October report accepted'; END IF;
  v_blocked := false;
  BEGIN INSERT INTO public.gym_expenses(expense_date,category,description,amount) VALUES(DATE '2026-10-01','gas','Invalid precision',1.001); EXCEPTION WHEN check_violation THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Invalid money precision accepted'; END IF;
  v_blocked := false;
  BEGIN INSERT INTO public.gym_expenses(expense_date,category,description,amount) VALUES((clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date+1,'gas','Future date',100); EXCEPTION WHEN raise_exception THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Future expense accepted'; END IF;

  -- Lagos boundary: midnight on October 1 is September 30 at 23:00 UTC.
  INSERT INTO public.payments(amount,currency,status,payment_method,provider,source,paid_at,metadata) VALUES
   (100,'NGN','success','Cash','manual_reception','qa_finance','2026-09-30 23:00:00+00','{}'),
   (200,'NGN','success','Cash','manual_reception','qa_finance','2026-10-31 22:59:59+00','{}'),
   (400,'NGN','success','Cash','manual_reception','qa_finance','2026-09-30 22:59:59+00','{}'),
   (800,'NGN','success','Cash','manual_reception','qa_finance','2026-10-31 23:00:00+00','{}'),
   (1600,'NGN','pending','Cash','manual_reception','qa_finance','2026-10-10 12:00:00+00','{}'),
   (3200,'NGN','success','Cash','manual_reception','qa_finance','2026-10-10 12:00:00+00','{"revenue_excluded":true}'),
   (6400,'NGN','success','Cash','manual_reception','admin_historical_import','2026-10-10 12:00:00+00','{"record_type":"historical_import"}'),
   (5,'USD','success','Cash','manual_reception','qa_finance','2026-10-10 12:00:00+00','{}');
  v_report := public.admin_get_finance_month(DATE '2026-10-01');
  IF (v_report->>'revenue')::numeric <> (v_before->>'revenue')::numeric+300 THEN RAISE EXCEPTION 'Revenue date/status/exclusion rules wrong: %',v_report->>'revenue'; END IF;
  IF (v_report->>'foreign_revenue_count')::integer <> (v_before->>'foreign_revenue_count')::integer+1 THEN RAISE EXCEPTION 'Foreign revenue was silently mixed into naira'; END IF;
  IF NOT (v_report->>'revenue_complete')::boolean THEN RAISE EXCEPTION 'October revenue marked incomplete'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_other::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_other,'role','authenticated')::text,true);
  IF EXISTS(SELECT 1 FROM public.gym_expenses) THEN RAISE EXCEPTION 'Non-admin can read expenses'; END IF;
  v_blocked := false;
  BEGIN INSERT INTO public.gym_expenses(expense_date,category,description,amount) VALUES(DATE '2026-10-01','gas','Forbidden expense',100); EXCEPTION WHEN insufficient_privilege THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Non-admin can insert expenses'; END IF;
  v_blocked := false;
  BEGIN PERFORM public.admin_get_finance_month(DATE '2026-10-01'); EXCEPTION WHEN insufficient_privilege THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Non-admin can read profit report'; END IF;
  IF has_table_privilege('authenticated','public.gym_expenses','DELETE') OR has_function_privilege('anon','public.admin_get_finance_month(date)','EXECUTE') THEN RAISE EXCEPTION 'Hard delete or public report allowed'; END IF;
  v_passed := true;
  RAISE EXCEPTION USING ERRCODE='ZQ002',MESSAGE='Roll back finance QA records';
 EXCEPTION WHEN SQLSTATE 'ZQ002' THEN IF NOT v_passed THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.payments) <> v_payments OR (SELECT count(*) FROM public.gym_expenses) <> v_expenses THEN RAISE EXCEPTION 'QA writes did not roll back'; END IF;
END $qa$;
SELECT 'PASS: categories, totals, edit/remove, audit, October start, valid money/dates, Lagos revenue boundaries, historical exclusions, currencies, admin-only RLS; all test writes rolled back' AS result;
