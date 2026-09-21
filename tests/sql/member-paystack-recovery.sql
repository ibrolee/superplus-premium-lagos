-- Run after reception-integration.sql, in the disposable CI database only.
\set ON_ERROR_STOP on
\i supabase/migrations/20260921100000_atomic_member_paystack_finalization.sql
SELECT pg_catalog.set_config('request.jwt.claim.role','service_role',false);
INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-000000000020'),('00000000-0000-4000-8000-000000000021');
INSERT INTO public.members(id,full_name,email,auth_user_id)
VALUES ('00000000-0000-4000-8000-000000000030','Paystack Recovery Test','paystack-test@example.test','00000000-0000-4000-8000-000000000020'),
('00000000-0000-4000-8000-000000000031','Other Member','other-paystack@example.test','00000000-0000-4000-8000-000000000021');
DO $test$
DECLARE
 ref text := 'SPF-1789982061658-11111111-1111-4111-8111-111111111111';
 ref_two text := 'SPF-1789982061658-22222222-2222-4222-8222-222222222222';
 member uuid := '00000000-0000-4000-8000-000000000030';
 owner uuid := '00000000-0000-4000-8000-000000000020';
 other uuid := '00000000-0000-4000-8000-000000000031';
 result jsonb;
 first_result jsonb;
 before_count integer;
 blocked boolean;
 paid timestamptz := clock_timestamp();
BEGIN
 -- Initialization leaves a durable pending record, not revenue or a membership.
 INSERT INTO public.payments(member_id,amount,currency,status,source,provider,paystack_reference,metadata)
 VALUES(member,27000,'NGN','pending','paystack','paystack',ref,
  jsonb_build_object('source','member_dashboard','plan_id','monthly','member_id',member,'auth_user_id',owner));
 SELECT count(*) INTO before_count FROM public.memberships WHERE member_id=member;
 SELECT public.finalize_member_paystack_payment(ref,member,owner,'monthly',2700000,'NGN',paid,'bank_transfer','CUS-TEST',6579792113) INTO first_result;
 IF first_result->>'success' <> 'true' OR first_result->>'already_processed' <> 'false' THEN RAISE EXCEPTION 'Pending payment not finalized'; END IF;
 IF (SELECT count(*) FROM public.memberships WHERE member_id=member) <> before_count+1 THEN RAISE EXCEPTION 'Membership not created once'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.payments WHERE paystack_reference=ref AND status='success' AND amount=27000
   AND membership_id=(first_result->>'membership_id')::uuid AND paid_at=paid
   AND metadata->>'paystack_transaction_id'='6579792113') THEN RAISE EXCEPTION 'Successful payment not linked'; END IF;
 SELECT public.finalize_member_paystack_payment(ref,member,owner,'monthly',2700000,'NGN',paid,'bank_transfer','CUS-TEST',6579792113) INTO result;
 IF result->>'already_processed' <> 'true' OR result->>'membership_id' <> first_result->>'membership_id' THEN RAISE EXCEPTION 'Replay was not idempotent'; END IF;
 IF (SELECT count(*) FROM public.payments WHERE paystack_reference=ref)<>1 OR
   (SELECT count(*) FROM public.memberships WHERE member_id=member)<>before_count+1 THEN RAISE EXCEPTION 'Replay double-counted payment or membership'; END IF;

 -- Amount, member identity and currency mismatches must fail atomically.
 SELECT count(*) INTO before_count FROM public.memberships;
 blocked:=false;
 BEGIN
  PERFORM public.finalize_member_paystack_payment(ref_two,member,owner,'monthly',2600000,'NGN',paid,'bank','',777777);
 EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Underpayment was accepted'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.finalize_member_paystack_payment(ref_two,other,owner,'monthly',2700000,'NGN',paid,'bank','',777777);
 EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Wrong authentication was accepted'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.finalize_member_paystack_payment(ref_two,member,owner,'monthly',2700000,'USD',paid,'bank','',777777);
 EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked OR (SELECT count(*) FROM public.memberships)<>before_count OR
   EXISTS(SELECT 1 FROM public.payments WHERE paystack_reference=ref_two) THEN RAISE EXCEPTION 'Rejected payment wrote financial records'; END IF;

 -- Earlier checkouts without a pending row still finalize exactly once.
 SELECT public.finalize_member_paystack_payment(ref_two,member,owner,'monthly',2700000,'NGN',paid,'card','',777777) INTO result;
 IF result->>'success'<>'true' OR (SELECT count(*) FROM public.payments WHERE paystack_reference=ref_two)<>1 THEN RAISE EXCEPTION 'Legacy checkout recovery failed'; END IF;
 IF (SELECT start_date FROM public.memberships WHERE id=(result->>'membership_id')::uuid) <>
    (SELECT end_date+1 FROM public.memberships WHERE id=(first_result->>'membership_id')::uuid) THEN RAISE EXCEPTION 'Renewal overlap or lost days'; END IF;

 -- No public client may call the service-only financial finalizer.
 PERFORM pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
 blocked:=false;
 BEGIN
  PERFORM public.finalize_member_paystack_payment('SPF-PUBLIC-DENIED',member,owner,'monthly',2700000,'NGN',paid,'card','',99999);
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Unauthorized payment finalization allowed'; END IF;
 RAISE NOTICE 'PASS: Paystack pending, replay, legacy recovery, identity, amount, currency and privilege checks';
END $test$;
