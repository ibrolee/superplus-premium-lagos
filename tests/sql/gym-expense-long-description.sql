-- Verify long paragraphs through the real admin write/report paths; all writes roll back.
DO $qa$
DECLARE
 v_admin uuid; v_id uuid := gen_random_uuid(); v_before bigint;
 v_text text := rpad(E'First paragraph\n\nSecond paragraph\n',10000,'x');
 v_saved text; v_report jsonb; v_blocked boolean; v_passed boolean := false;
BEGIN
 SELECT auth_user_id INTO v_admin FROM public.staff_users
 WHERE active AND lower(role) IN ('admin','owner') LIMIT 1;
 IF v_admin IS NULL THEN RAISE EXCEPTION 'Missing admin test actor'; END IF;
 SELECT count(*) INTO v_before FROM public.gym_expenses;
 BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  PERFORM set_config('role','authenticated',true);
  INSERT INTO public.gym_expenses(id,expense_date,category,description,amount)
   VALUES(v_id,DATE '2026-10-01','other',v_text,1);
  SELECT description INTO v_saved FROM public.gym_expenses WHERE id=v_id;
  IF v_saved IS DISTINCT FROM v_text THEN RAISE EXCEPTION 'Long description or paragraph breaks lost'; END IF;
  v_report := public.admin_get_finance_month(DATE '2026-10-01');
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_report->'expenses') e
    WHERE e->>'id'=v_id::text AND e->>'description'=v_text) THEN
   RAISE EXCEPTION 'Long description missing from report';
  END IF;
  UPDATE public.gym_expenses SET description=left(v_text,9500) WHERE id=v_id;
  SELECT description INTO v_saved FROM public.gym_expenses WHERE id=v_id;
  IF v_saved IS DISTINCT FROM left(v_text,9500) THEN RAISE EXCEPTION 'Long description edit failed'; END IF;
  v_blocked := false;
  BEGIN
   UPDATE public.gym_expenses SET description=repeat('x',10001) WHERE id=v_id;
  EXCEPTION WHEN check_violation THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Description above limit accepted'; END IF;
  v_blocked := false;
  BEGIN
   UPDATE public.gym_expenses SET description='   ' WHERE id=v_id;
  EXCEPTION WHEN check_violation THEN v_blocked := true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Empty description accepted'; END IF;
  v_passed := true;
  RAISE EXCEPTION USING ERRCODE='ZQ003',MESSAGE='Roll back description QA record';
 EXCEPTION WHEN SQLSTATE 'ZQ003' THEN IF NOT v_passed THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.gym_expenses) <> v_before OR
   EXISTS(SELECT 1 FROM public.gym_expenses WHERE id=v_id) THEN
  RAISE EXCEPTION 'QA writes did not roll back';
 END IF;
END $qa$;
SELECT 'PASS: 10,000-character paragraphs insert/read/report/edit, over-limit and empty rejection; all writes rolled back' AS result;
