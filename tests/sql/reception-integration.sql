-- Run ONLY against the disposable PostgreSQL container in GitHub Actions.
-- No production data, Supabase connection or real Paystack requests are used here.
\set ON_ERROR_STOP on
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT pg_catalog.current_setting('request.jwt.claim.role',true) $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.staff_users(auth_user_id uuid REFERENCES auth.users(id),role text NOT NULL,active boolean NOT NULL);
CREATE TABLE public.members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_user_id uuid UNIQUE REFERENCES auth.users(id),full_name text NOT NULL,email text,phone text,birth_day integer,birth_month integer,source text DEFAULT 'wix',notes text,created_at timestamptz DEFAULT now());
CREATE TABLE public.membership_plans(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text UNIQUE NOT NULL,price numeric,duration_days integer,active boolean NOT NULL DEFAULT true);
CREATE TABLE public.memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),member_id uuid NOT NULL REFERENCES public.members(id),plan_id uuid REFERENCES public.membership_plans(id),plan_name text,start_date date NOT NULL,end_date date NOT NULL,status text NOT NULL,payment_status text,source text NOT NULL);
CREATE TABLE public.payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),member_id uuid REFERENCES public.members(id),membership_id uuid REFERENCES public.memberships(id),amount numeric NOT NULL,currency text,status text NOT NULL,payment_method text,provider text NOT NULL DEFAULT 'paystack',paystack_reference text UNIQUE,paystack_customer_code text,paid_at timestamptz,source text NOT NULL,metadata jsonb,created_at timestamptz DEFAULT now());
CREATE TABLE public.fitness_verified_collection_refs(reference_key text PRIMARY KEY);
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001');
INSERT INTO public.staff_users VALUES('00000000-0000-4000-8000-000000000001','reception',true);
INSERT INTO public.membership_plans(name,price,duration_days) VALUES ('Monthly Plan',27000,30),('Personal Training Only',30000,30),('Family Plan',75000,30);
SELECT pg_catalog.set_config('request.jwt.claim.role','service_role',false);
SELECT pg_catalog.set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
\i supabase/migrations/20260921060000_reception_instant_registration.sql
\i supabase/migrations/20260921061000_public_regoff_checkout.sql

-- Service-only entry points cannot be invoked by public or ordinary authenticated users.
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.reception_complete_registration(uuid,text,text,text,uuid,date,integer,numeric,text,text,text,boolean,uuid,uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Reception RPC exposed to authenticated'; END IF;
 IF has_function_privilege('anon','public.finalize_public_join_payment(text,text,text,text,text,integer,integer,timestamptz,text,text,text,bigint)','EXECUTE') THEN RAISE EXCEPTION 'Paystack finalizer exposed to anon'; END IF;
 IF has_function_privilege('anon','public.public_join_email_matches(text)','EXECUTE') THEN RAISE EXCEPTION 'Private email lookup exposed to anon'; END IF;
END $$;

-- New member with REGOFF: exactly one paid plan, one successful revenue payment, zero registration fee.
DO $$ DECLARE r jsonb; n integer; BEGIN
 SELECT public.reception_complete_registration('00000000-0000-4000-8000-000000000001','Test New Member','new@example.test','08012345678',(SELECT id FROM public.membership_plans WHERE name='Monthly Plan'),(clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date,30,27000,'Cash','','',true,'00000000-0000-4000-8000-000000000002',null,'REGOFF') INTO r;
 IF r->>'success'<>'true' OR (r->>'amount')::numeric<>27000 OR (r->>'registration_fee')::numeric<>0 THEN RAISE EXCEPTION 'REGOFF direct registration wrong %',r; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.payments WHERE id=(r->>'payment_id')::uuid AND status='success' AND amount=27000 AND metadata->>'record_type'='standard_payment' AND metadata->>'revenue_excluded' IS NULL) THEN RAISE EXCEPTION 'Direct payment missing from standard revenue'; END IF;
 SELECT COUNT(*) INTO n FROM public.payments;
 PERFORM public.reception_complete_registration('00000000-0000-4000-8000-000000000001','Test New Member','new@example.test','08012345678',(SELECT id FROM public.membership_plans WHERE name='Monthly Plan'),(clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date,30,27000,'Cash','','',true,'00000000-0000-4000-8000-000000000002',null,'REGOFF');
 IF (SELECT COUNT(*) FROM public.payments)<>n THEN RAISE EXCEPTION 'Idempotency created duplicate payment'; END IF;
END $$;

-- Renewal uses the original member and extends the existing paid plan, never a second joining fee.
DO $$ DECLARE r jsonb; prior_end date; member_id uuid; BEGIN
 SELECT id INTO member_id FROM public.members WHERE email='new@example.test';
 SELECT end_date INTO prior_end FROM public.memberships WHERE member_id=member_id;
 SELECT public.reception_complete_registration('00000000-0000-4000-8000-000000000001','','','', (SELECT id FROM public.membership_plans WHERE name='Monthly Plan'),(clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date,30,27000,'POS','','POS-123456',true,'00000000-0000-4000-8000-000000000003',member_id,'') INTO r;
 IF r->>'transaction_type'<>'renewal' OR (r->>'registration_fee')::numeric<>0 OR (r->>'amount')::numeric<>27000 THEN RAISE EXCEPTION 'Renewal amount wrong %',r; END IF;
 IF (SELECT start_date FROM public.memberships WHERE id=(r->>'membership_id')::uuid)<>prior_end+1 THEN RAISE EXCEPTION 'Renewal did not extend current membership'; END IF;
END $$;

-- Duplicate POS reference must roll back all attempted member/membership/payment inserts atomically.
DO $$ DECLARE prior_members int; prior_payments int; blocked boolean:=false; BEGIN
 SELECT count(*) INTO prior_members FROM public.members;
 SELECT count(*) INTO prior_payments FROM public.payments;
 BEGIN
  PERFORM public.reception_complete_registration('00000000-0000-4000-8000-000000000001','Duplicate Reference','duplicate@example.test','08012345679',(SELECT id FROM public.membership_plans WHERE name='Monthly Plan'),(clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date,30,27000,'POS','','POS-123456',true,'00000000-0000-4000-8000-000000000004',null,'');
 EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked OR (SELECT count(*) FROM public.members)<>prior_members OR (SELECT count(*) FROM public.payments)<>prior_payments THEN RAISE EXCEPTION 'Duplicate collection reference did not safely roll back'; END IF;
END $$;

-- Verify a legacy (no coupon_code metadata) successful Paystack transaction; subsequent callback is idempotent.
DO $$ DECLARE r jsonb; again jsonb; prior int; BEGIN
 SELECT public.finalize_public_join_payment('SPF-LEGACY-00001','monthly','Legacy Payer','legacy@example.test','08012345670',11,6,clock_timestamp(),'card','CUS-TEST','',3400000) INTO r;
 IF r->>'success'<>'true' OR (SELECT amount FROM public.payments WHERE id=(r->>'payment_id')::uuid)<>34000 THEN RAISE EXCEPTION 'Legacy Paystack amount wrong %',r; END IF;
 SELECT count(*) INTO prior FROM public.payments;
 SELECT public.finalize_public_join_payment('SPF-LEGACY-00001','monthly','Legacy Payer','legacy@example.test','08012345670',11,6,clock_timestamp(),'card','CUS-TEST','',3400000) INTO again;
 IF again->>'already_processed'<>'true' OR (SELECT count(*) FROM public.payments)<>prior THEN RAISE EXCEPTION 'Legacy callback not idempotent %',again; END IF;
END $$;

-- Public checkout with REGOFF must record only the plan amount, with coupon in metadata.
DO $$ DECLARE r jsonb; BEGIN
 SELECT public.finalize_public_join_payment('SPF-REGOFF-00001','monthly','Promo Payer','promo@example.test','08012345671',15,7,clock_timestamp(),'card','CUS-TEST','REGOFF',2700000) INTO r;
 IF r->>'success'<>'true' OR NOT EXISTS(SELECT 1 FROM public.payments WHERE id=(r->>'payment_id')::uuid AND amount=27000 AND metadata->>'coupon_code'='REGOFF' AND (metadata->>'registration_amount_naira')::numeric=0) THEN RAISE EXCEPTION 'Public REGOFF recording wrong %',r; END IF;
END $$;

-- Ambiguous email must fail closed, leaving the paid callback safely retryable after cleanup.
INSERT INTO public.members(full_name,email) VALUES ('Duplicate A','shared@example.test'),('Duplicate B','shared@example.test');
DO $$ DECLARE blocked boolean:=false; prior int; BEGIN
 SELECT count(*) INTO prior FROM public.payments;
 IF public.public_join_email_matches('shared@example.test')<>2 THEN RAISE EXCEPTION 'Duplicate email lookup wrong'; END IF;
 BEGIN
  PERFORM public.finalize_public_join_payment('SPF-AMBIG-00001','monthly','Duplicate A','shared@example.test','08012345672',10,8,clock_timestamp(),'card','CUS-TEST','',3400000);
 EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked OR (SELECT count(*) FROM public.payments)<>prior THEN RAISE EXCEPTION 'Ambiguous email was silently linked'; END IF;
END $$;
SELECT 'PASS: isolated registration, idempotency, revenue, renewal, duplicate refs, legacy Paystack, REGOFF and ambiguous identity' AS result;
