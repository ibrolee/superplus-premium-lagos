-- Run AFTER reception-integration.sql, only in the same disposable CI PostgreSQL database.
-- An unsuccessful request must never create a member, membership, payment or transaction.
\set ON_ERROR_STOP on
SELECT pg_catalog.set_config('request.jwt.claim.role','service_role',false);
SELECT pg_catalog.set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);

DO $tests$
DECLARE
 baseline_members integer; baseline_memberships integer; baseline_payments integer; baseline_transactions integer;
 error_seen boolean;
 v_actor uuid := '00000000-0000-4000-8000-000000000001';
 v_plan uuid;
 v_today date := (clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date;
BEGIN
 SELECT id INTO v_plan FROM public.membership_plans WHERE name='Monthly Plan';
 IF v_plan IS NULL THEN RAISE EXCEPTION 'Test fixture missing monthly plan'; END IF;
 SELECT count(*) INTO baseline_members FROM public.members;
 SELECT count(*) INTO baseline_memberships FROM public.memberships;
 SELECT count(*) INTO baseline_payments FROM public.payments;
 SELECT count(*) INTO baseline_transactions FROM public.reception_direct_transactions;

 -- A browser JWT must never invoke the service-only registration RPC directly.
 PERFORM pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
 error_seen:=false;
 BEGIN
   PERFORM public.reception_complete_registration(v_actor,'Unauthorized Visitor','unauthorized@example.test','08012345678',v_plan,v_today,30,27000,'Cash','','',true,'00000000-0000-4000-8000-000000000010',null,'');
 EXCEPTION WHEN insufficient_privilege THEN error_seen:=true; END;
 PERFORM pg_catalog.set_config('request.jwt.claim.role','service_role',true);
 IF NOT error_seen THEN RAISE EXCEPTION 'Authenticated client could directly record revenue'; END IF;

 -- A service function must also reject staff identities that are not active and authorized.
 error_seen:=false;
 BEGIN
   PERFORM public.reception_complete_registration('00000000-0000-4000-8000-000000009999','Unauthorized Visitor','unauthorized@example.test','08012345678',v_plan,v_today,30,27000,'Cash','','',true,'00000000-0000-4000-8000-000000000011',null,'');
 EXCEPTION WHEN insufficient_privilege THEN error_seen:=true; END;
 IF NOT error_seen THEN RAISE EXCEPTION 'Unauthorized staff identity could record revenue'; END IF;

 -- The UI cannot turn uncollected money into a successful payment without explicit staff confirmation.
 error_seen:=false;
 BEGIN
   PERFORM public.reception_complete_registration(v_actor,'Unpaid Visitor','unpaid@example.test','08012345678',v_plan,v_today,30,27000,'Cash','','',false,'00000000-0000-4000-8000-000000000012',null,'');
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE '%Confirm actual receipt%' THEN error_seen:=true; ELSE RAISE; END IF;
 END;
 IF NOT error_seen THEN RAISE EXCEPTION 'Unconfirmed funds created membership'; END IF;

 -- Neither browser input nor a stale display price may discount the actual membership.
 error_seen:=false;
 BEGIN
   PERFORM public.reception_complete_registration(v_actor,'Forged Price','forged@example.test','08012345678',v_plan,v_today,30,1,'Cash','','',true,'00000000-0000-4000-8000-000000000013',null,'');
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE '%official plan price%' THEN error_seen:=true; ELSE RAISE; END IF;
 END;
 IF NOT error_seen THEN RAISE EXCEPTION 'Forged membership price accepted'; END IF;

 error_seen:=false;
 BEGIN
   PERFORM public.reception_complete_registration(v_actor,'Forged Duration','duration@example.test','08012345678',v_plan,v_today,180,27000,'Cash','','',true,'00000000-0000-4000-8000-000000000014',null,'');
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE '%Invalid duration%' THEN error_seen:=true; ELSE RAISE; END IF;
 END;
 IF NOT error_seen THEN RAISE EXCEPTION 'Forged plan duration accepted'; END IF;

 error_seen:=false;
 BEGIN
   PERFORM public.reception_complete_registration(v_actor,'Invalid Coupon','badcoupon@example.test','08012345678',v_plan,v_today,30,27000,'Cash','','',true,'00000000-0000-4000-8000-000000000015',null,'FREEALL');
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE '%Invalid coupon%' THEN error_seen:=true; ELSE RAISE; END IF;
 END;
 IF NOT error_seen THEN RAISE EXCEPTION 'Unknown coupon accepted'; END IF;

 error_seen:=false;
 BEGIN
   PERFORM public.reception_complete_registration(v_actor,'No Bank Reference','noref@example.test','08012345678',v_plan,v_today,30,27000,'Bank Transfer','','',true,'00000000-0000-4000-8000-000000000016',null,'');
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE '%real POS/bank reference%' THEN error_seen:=true; ELSE RAISE; END IF;
 END;
 IF NOT error_seen THEN RAISE EXCEPTION 'Bank transfer without reference accepted'; END IF;

 -- Paystack finalization cannot record revenue for a short payment or an arbitrary coupon.
 error_seen:=false;
 BEGIN
   PERFORM public.finalize_public_join_payment('SPF-UNDERPAID-00001','monthly','Underpaid Member','underpaid@example.test','08012345678',10,3,clock_timestamp(),'card','CUS-TEST','',2700000);
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE '%Verified amount does not match%' THEN error_seen:=true; ELSE RAISE; END IF;
 END;
 IF NOT error_seen THEN RAISE EXCEPTION 'Underpaid Paystack transaction accepted'; END IF;

 error_seen:=false;
 BEGIN
   PERFORM public.finalize_public_join_payment('SPF-INVALIDCODE-0001','monthly','Wrong Coupon','wrongcoupon@example.test','08012345678',10,3,clock_timestamp(),'card','CUS-TEST','FREEALL',2700000);
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE '%Invalid coupon%' THEN error_seen:=true; ELSE RAISE; END IF;
 END;
 IF NOT error_seen THEN RAISE EXCEPTION 'Unknown Paystack coupon accepted'; END IF;

 error_seen:=false;
 BEGIN
   PERFORM public.finalize_public_join_payment('SPF-WRONG-REGOFF-01','monthly','Bad REGOFF Amount','badregoff@example.test','08012345678',10,3,clock_timestamp(),'card','CUS-TEST','REGOFF',2600000);
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE '%Verified amount does not match%' THEN error_seen:=true; ELSE RAISE; END IF;
 END;
 IF NOT error_seen THEN RAISE EXCEPTION 'Wrong REGOFF amount accepted'; END IF;

 IF (SELECT count(*) FROM public.members)<>baseline_members
    OR (SELECT count(*) FROM public.memberships)<>baseline_memberships
    OR (SELECT count(*) FROM public.payments)<>baseline_payments
    OR (SELECT count(*) FROM public.reception_direct_transactions)<>baseline_transactions THEN
    RAISE EXCEPTION 'A rejected attempt changed membership or revenue records';
 END IF;
 RAISE NOTICE 'PASS: 10 denied/invalid transactions; no new members, memberships, payments or revenue';
END $tests$;
