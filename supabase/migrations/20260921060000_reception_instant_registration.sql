-- STAGED ONLY. Do not apply to production until the entire UI/Edge/QR release is approved and verified.
-- Immediate registration creates active, provisional access; payment stays PENDING and outside revenue
-- until a different manager reconciles it. A dispute cancels the provisional access.
CREATE TABLE public.reception_instant_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registered_by uuid NOT NULL REFERENCES auth.users(id),
  idempotency_key uuid NOT NULL,
  member_id uuid NOT NULL REFERENCES public.members(id),
  membership_id uuid NOT NULL REFERENCES public.memberships(id),
  payment_id uuid NOT NULL REFERENCES public.payments(id),
  plan_id uuid NOT NULL REFERENCES public.membership_plans(id),
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  method text NOT NULL CHECK (method IN ('Cash','POS','Bank Transfer')),
  staff_reference text,
  staff_note text NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_reconciliation' CHECK (status IN ('awaiting_reconciliation','reconciled','disputed')),
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reconciled_by uuid REFERENCES auth.users(id),
  reconciled_at timestamptz,
  reconciled_reference text,
  reconciliation_note text,
  UNIQUE (registered_by,idempotency_key),
  UNIQUE (membership_id),
  UNIQUE (payment_id)
);
ALTER TABLE public.reception_instant_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reception_instant_registrations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.reception_instant_registrations TO authenticated;
CREATE POLICY reception_instant_registration_read ON public.reception_instant_registrations
FOR SELECT TO authenticated USING (EXISTS (
 SELECT 1 FROM public.staff_users s WHERE s.auth_user_id = (SELECT auth.uid()) AND s.active IS TRUE
 AND (lower(s.role) IN ('admin','owner','manager') OR (lower(s.role)='reception' AND registered_by=(SELECT auth.uid())))
));

-- Only the server-side Edge Function holding the service-role key may invoke this RPC.
-- It authenticates the signed-in staff user separately, then passes their verified auth ID.
CREATE OR REPLACE FUNCTION public.reception_complete_registration(
 p_actor_id uuid,p_full_name text,p_email text,p_phone text,p_plan_id uuid,
 p_start_date date,p_duration_days integer,p_plan_amount numeric,p_method text,
 p_staff_note text,p_staff_reference text,p_funds_confirmed boolean,p_idempotency_key uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_plan public.membership_plans%ROWTYPE; v_fee numeric; v_email text; v_phone text;
 v_member uuid; v_membership uuid; v_payment uuid; v_registration uuid; v_existing public.reception_instant_registrations%ROWTYPE;
BEGIN
 IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server-only registration endpoint.' USING ERRCODE='42501'; END IF;
 IF p_actor_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.staff_users s WHERE s.auth_user_id=p_actor_id AND s.active IS TRUE AND lower(s.role) IN ('reception','admin','owner','manager')) THEN
  RAISE EXCEPTION 'Active reception staff account required.' USING ERRCODE='42501'; END IF;
 IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'Registration retry key is required.'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0));
 SELECT * INTO v_existing FROM public.reception_instant_registrations WHERE registered_by=p_actor_id AND idempotency_key=p_idempotency_key;
 IF v_existing.id IS NOT NULL THEN RETURN jsonb_build_object('success',true,'already_registered',true,'registration_id',v_existing.id,'member_id',v_existing.member_id,'membership_id',v_existing.membership_id,'status',v_existing.status); END IF;
 v_email:=lower(btrim(COALESCE(p_email,''))); v_phone:=regexp_replace(COALESCE(p_phone,''),'[^0-9]','','g');
 IF length(btrim(COALESCE(p_full_name,'')))<3 OR v_email NOT LIKE '%@%.%' OR length(v_phone) NOT BETWEEN 10 AND 15 OR length(btrim(COALESCE(p_staff_note,'')))<12 THEN RAISE EXCEPTION 'Full name, valid email/phone and staff collection note (12+ characters) are required.'; END IF;
 IF p_funds_confirmed IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Staff must confirm they personally checked the actual cash, POS result or gym bank credit.'; END IF;
 IF p_method NOT IN ('Cash','POS','Bank Transfer') THEN RAISE EXCEPTION 'Choose cash, POS or bank transfer.'; END IF;
 IF p_method<>'Cash' AND length(btrim(COALESCE(p_staff_reference,'')))<6 THEN RAISE EXCEPTION 'POS and bank transfers require the actual transaction reference (6+ characters). Screenshots alone are not verification.'; END IF;
 IF p_start_date IS DISTINCT FROM (clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date THEN RAISE EXCEPTION 'Instant registrations must start today in Lagos.'; END IF;
 SELECT * INTO v_plan FROM public.membership_plans WHERE id=p_plan_id AND active IS TRUE;
 IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Choose an active plan.'; END IF;
 IF p_duration_days NOT BETWEEN 1 AND 3650 OR (v_plan.name<>'Custom Plan' AND p_duration_days IS DISTINCT FROM v_plan.duration_days) THEN RAISE EXCEPTION 'Invalid plan duration.'; END IF;
 IF p_plan_amount IS NULL OR p_plan_amount<=0 OR p_plan_amount>100000000 OR (v_plan.name<>'Custom Plan' AND p_plan_amount IS DISTINCT FROM v_plan.price) THEN RAISE EXCEPTION 'Plan amount must match the official price.'; END IF;
 v_fee:=CASE WHEN v_plan.name='Family Plan' THEN 20000 WHEN v_plan.name='Personal Training Only' THEN 0 WHEN v_plan.name IN ('Semi-Annual','Monthly VIP Gold') THEN 3000 ELSE 7000 END;
 -- Serialize identical addresses/phones inside this endpoint before checking for duplicates.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reception-email:'||v_email,0));
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reception-phone:'||right(v_phone,10),0));
 IF EXISTS(SELECT 1 FROM public.members m WHERE lower(btrim(COALESCE(m.email,'')))=v_email OR right(regexp_replace(COALESCE(m.phone,''),'[^0-9]','','g'),10)=right(v_phone,10)) THEN
  RAISE EXCEPTION 'Member already exists. Open their profile; do not charge registration twice.'; END IF;
 IF EXISTS(SELECT 1 FROM public.fitness_new_member_requests r WHERE r.status='pending' AND (lower(btrim(r.email))=v_email OR right(regexp_replace(r.phone,'[^0-9]','','g'),10)=right(v_phone,10))) THEN
  RAISE EXCEPTION 'This member has an existing pending intake; resolve it instead of creating a duplicate.'; END IF;
 INSERT INTO public.members(full_name,email,phone,source,notes)
 VALUES(btrim(p_full_name),v_email,btrim(p_phone),'manual','Instant front-desk registration. Staff: '||p_actor_id::text||'. Payment awaiting independent reconciliation.') RETURNING id INTO v_member;
 INSERT INTO public.memberships(member_id,plan_id,plan_name,start_date,end_date,status,payment_status,source)
 VALUES(v_member,v_plan.id,v_plan.name,p_start_date,p_start_date+p_duration_days-1,'active','unpaid','reception_instant_provisional') RETURNING id INTO v_membership;
 INSERT INTO public.payments(member_id,membership_id,amount,currency,status,payment_method,provider,metadata,source)
 VALUES(v_member,v_membership,p_plan_amount+v_fee,'NGN','pending',p_method,'manual_reception',jsonb_build_object('collection_status','awaiting_reconciliation','revenue_excluded',true,'registered_by_auth_id',p_actor_id,'registration_amount',v_fee,'membership_amount',p_plan_amount,'staff_reference',nullif(btrim(COALESCE(p_staff_reference,'')),''),'staff_note',btrim(p_staff_note),'funds_confirmation','staff_attested_not_independently_verified'),'reception_instant_provisional') RETURNING id INTO v_payment;
 INSERT INTO public.reception_instant_registrations(registered_by,idempotency_key,member_id,membership_id,payment_id,plan_id,total_amount,method,staff_reference,staff_note)
 VALUES(p_actor_id,p_idempotency_key,v_member,v_membership,v_payment,v_plan.id,p_plan_amount+v_fee,p_method,nullif(btrim(COALESCE(p_staff_reference,'')),''),btrim(p_staff_note)) RETURNING id INTO v_registration;
 RETURN jsonb_build_object('success',true,'registration_id',v_registration,'member_id',v_member,'membership_id',v_membership,'payment_id',v_payment,'access_active',true,'payment_status','awaiting_reconciliation','confirmed_revenue',false,'amount',p_plan_amount+v_fee);
END $fn$;
REVOKE ALL ON FUNCTION public.reception_complete_registration(uuid,text,text,text,uuid,date,integer,numeric,text,text,text,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reception_complete_registration(uuid,text,text,text,uuid,date,integer,numeric,text,text,text,boolean,uuid) TO service_role;

-- Independent FINANCIAL RECONCILIATION happens AFTER the member has been registered.
-- It is not a prerequisite for access, and the person who registered cannot reconcile their own record.
CREATE OR REPLACE FUNCTION public.reconcile_reception_registration(
 p_registration_id uuid,p_action text,p_verified_reference text,p_review_note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_entry public.reception_instant_registrations%ROWTYPE; v_ref text;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT EXISTS(SELECT 1 FROM public.staff_users s WHERE s.auth_user_id=(SELECT auth.uid()) AND s.active IS TRUE AND lower(s.role) IN ('admin','owner','manager')) THEN RAISE EXCEPTION 'Management reconciliation required.' USING ERRCODE='42501'; END IF;
 IF p_action NOT IN ('reconcile','dispute') OR length(btrim(COALESCE(p_review_note,'')))<12 THEN RAISE EXCEPTION 'Choose reconcile/dispute and add an independent note of at least 12 characters.'; END IF;
 SELECT * INTO v_entry FROM public.reception_instant_registrations WHERE id=p_registration_id FOR UPDATE;
 IF v_entry.id IS NULL OR v_entry.status<>'awaiting_reconciliation' THEN RAISE EXCEPTION 'Registration already reconciled or not found.'; END IF;
 IF v_entry.registered_by=(SELECT auth.uid()) THEN RAISE EXCEPTION 'Another manager must reconcile your own registration.' USING ERRCODE='42501'; END IF;
 IF p_action='reconcile' THEN
  v_ref:=lower(btrim(COALESCE(p_verified_reference,'')));
  IF length(v_ref)<6 THEN RAISE EXCEPTION 'Provide a unique verified bank, POS or cash-count/deposit reference.'; END IF;
  IF EXISTS(SELECT 1 FROM public.payments WHERE lower(btrim(COALESCE(paystack_reference,'')))=v_ref) THEN RAISE EXCEPTION 'Do not reuse a Paystack transaction reference.'; END IF;
  INSERT INTO public.fitness_verified_collection_refs(reference_key,source_kind,request_id) VALUES(v_ref,'new_member',v_entry.id);
  UPDATE public.payments SET status='success',provider='manual_verified',paid_at=clock_timestamp(),metadata=(COALESCE(metadata,'{}'::jsonb)-'revenue_excluded')||jsonb_build_object('collection_status','reconciled','independent_verified_reference',v_ref,'reconciled_by_auth_id',(SELECT auth.uid()),'reconciliation_note',btrim(p_review_note)) WHERE id=v_entry.payment_id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment state changed; investigate before retrying.'; END IF;
  UPDATE public.memberships SET payment_status='paid' WHERE id=v_entry.membership_id AND status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership state changed; investigate before retrying.'; END IF;
  UPDATE public.reception_instant_registrations SET status='reconciled',reconciled_by=(SELECT auth.uid()),reconciled_at=clock_timestamp(),reconciled_reference=v_ref,reconciliation_note=btrim(p_review_note) WHERE id=v_entry.id;
 ELSE
  UPDATE public.payments SET status='failed',metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('collection_status','disputed','reconciliation_note',btrim(p_review_note)) WHERE id=v_entry.payment_id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment state changed; investigate before retrying.'; END IF;
  UPDATE public.memberships SET status='cancelled',payment_status='unpaid' WHERE id=v_entry.membership_id AND status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership state changed; investigate before retrying.'; END IF;
  UPDATE public.reception_instant_registrations SET status='disputed',reconciled_by=(SELECT auth.uid()),reconciled_at=clock_timestamp(),reconciliation_note=btrim(p_review_note) WHERE id=v_entry.id;
 END IF;
 RETURN jsonb_build_object('success',true,'registration_id',v_entry.id,'status',CASE WHEN p_action='reconcile' THEN 'reconciled' ELSE 'disputed' END);
END $fn$;
REVOKE ALL ON FUNCTION public.reconcile_reception_registration(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reconcile_reception_registration(uuid,text,text,text) TO authenticated;
