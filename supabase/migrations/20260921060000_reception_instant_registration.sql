-- STAGED SOURCE ONLY. DO NOT RUN against production until explicitly approved and tested on a dev DB.
-- Reception records money it has actually received; a successful payment enters normal revenue immediately.
-- REGOFF waives only the registration fee. Existing members never pay a second registration fee.
-- Historical imports remain exclusively in the existing admin-only historical import workflow.
CREATE TABLE public.reception_direct_transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recorded_by uuid NOT NULL REFERENCES auth.users(id),
 idempotency_key uuid NOT NULL,
 member_id uuid NOT NULL REFERENCES public.members(id),
 membership_id uuid NOT NULL REFERENCES public.memberships(id),
 payment_id uuid NOT NULL REFERENCES public.payments(id),
 plan_id uuid NOT NULL REFERENCES public.membership_plans(id),
 transaction_type text NOT NULL CHECK (transaction_type IN ('new','renewal')),
 plan_amount numeric NOT NULL CHECK (plan_amount > 0),
 registration_fee numeric NOT NULL CHECK (registration_fee >= 0),
 amount numeric NOT NULL CHECK (amount = plan_amount + registration_fee),
 coupon_code text CHECK (coupon_code IS NULL OR coupon_code = 'REGOFF'),
 method text NOT NULL CHECK (method IN ('Cash','POS','Bank Transfer')),
 staff_reference text, collection_note text,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE (recorded_by,idempotency_key), UNIQUE (membership_id), UNIQUE (payment_id)
);
ALTER TABLE public.reception_direct_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reception_direct_transactions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.reception_direct_transactions TO authenticated;
CREATE POLICY reception_direct_read ON public.reception_direct_transactions
 FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.staff_users s
 WHERE s.auth_user_id=(SELECT auth.uid()) AND s.active IS TRUE
 AND (lower(s.role) IN ('admin','owner','manager') OR (lower(s.role)='reception' AND recorded_by=(SELECT auth.uid())))));

-- Do not permit reuse of the same POS or bank reference within the direct reception workflow.
CREATE TABLE public.reception_direct_collection_refs (
 normalized_reference text PRIMARY KEY,
 transaction_id uuid NOT NULL UNIQUE REFERENCES public.reception_direct_transactions(id)
);
ALTER TABLE public.reception_direct_collection_refs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reception_direct_collection_refs FROM PUBLIC,anon,authenticated;

-- The Edge Function authenticates the staff JWT and calls this RPC with a service-role-only client.
-- One DB transaction creates or renews membership, records a SUCCESS payment, and writes an audit row.
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
  RETURN jsonb_build_object('success',true,'already_recorded',true,'transaction_id',v_existing.id,'member_id',v_existing.member_id,'membership_id',v_existing.membership_id,'payment_id',v_existing.payment_id,
   'revenue_recorded',true,'payment_status','paid','amount',v_existing.amount,'registration_fee',v_existing.registration_fee,'transaction_type',v_existing.transaction_type);
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
 IF v_coupon NOT IN ('','REGOFF') THEN RAISE EXCEPTION 'Invalid coupon code.'; END IF;
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
 v_fee:=CASE WHEN v_member IS DISTINCT FROM p_member_id AND v_coupon <> 'REGOFF' THEN
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
