-- Run only after reception-integration.sql and reception-negative-cases.sql in disposable CI PostgreSQL.
-- These are representative copies of the critical live source/authority guards; NOT a full Supabase clone.
\set ON_ERROR_STOP on
CREATE SCHEMA private;
ALTER TABLE public.members ADD CONSTRAINT members_source_check CHECK (source = ANY (ARRAY['wix','website','manual','other','admin_historical_import','admin_verified_returning','management_approved_new_member']));
CREATE FUNCTION private.reception_new_member_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF (SELECT auth.uid()) IS NOT NULL AND EXISTS (SELECT 1 FROM public.staff_users s WHERE s.auth_user_id=(SELECT auth.uid()) AND s.active IS TRUE AND lower(s.role)='reception') THEN
  IF TG_OP='INSERT' THEN RAISE EXCEPTION 'Reception cannot create new member profiles without independent administrator approval.' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER fitness_reception_new_member_guard BEFORE INSERT ON public.members FOR EACH ROW EXECUTE FUNCTION private.reception_new_member_guard();
CREATE FUNCTION private.require_financial_write_authority() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF (SELECT auth.uid()) IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.staff_users s WHERE s.auth_user_id=(SELECT auth.uid()) AND s.active IS TRUE AND lower(s.role) IN ('admin','owner','manager')) THEN
  RAISE EXCEPTION 'Financial and membership changes require independent management approval.' USING ERRCODE='42501';
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $fn$;
CREATE TRIGGER fitness_membership_financial_guard BEFORE INSERT ON public.memberships FOR EACH ROW EXECUTE FUNCTION private.require_financial_write_authority();
CREATE TRIGGER fitness_payment_financial_guard BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION private.require_financial_write_authority();

-- Confirm that existing client-side reception writes remain blocked by unchanged legacy triggers.
DO $fn$ DECLARE blocked boolean:=false; BEGIN
 PERFORM pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
 PERFORM pg_catalog.set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 BEGIN INSERT INTO public.members(full_name,email,source) VALUES ('Client bypass','client-bypass@example.test','manual'); EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Legacy member guard was bypassed'; END IF;
 blocked:=false;
 BEGIN INSERT INTO public.payments(amount,currency,status,source) VALUES (1,'NGN','success','reception_direct'); EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Legacy payment guard was bypassed'; END IF;
END $fn$;

-- A service-role connection uses its own service credential without impersonating a reception user.
-- The function itself checks the independently authenticated staff actor supplied by the Edge Function.
SELECT pg_catalog.set_config('request.jwt.claim.role','service_role',false);
SELECT pg_catalog.set_config('request.jwt.claim.sub','',false);
DO $fn$ DECLARE r jsonb; a uuid:='00000000-0000-4000-8000-000000000001'; today_lagos date:=(clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date; BEGIN
 SELECT public.reception_complete_registration(a,'Guard Compatible','guard-compatible@example.test','08011345670',(SELECT id FROM public.membership_plans WHERE name='Monthly Plan'),today_lagos,30,27000,'Cash','Representative production guards','',true,'00000000-0000-4000-8000-000000000021',null,'REGOFF') INTO r;
 IF r->>'success'<>'true' OR (r->>'amount')::numeric<>27000 OR NOT EXISTS (SELECT 1 FROM public.members WHERE id=(r->>'member_id')::uuid AND source='manual') THEN RAISE EXCEPTION 'Service role registration failed live-style guards: %',r; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.payments WHERE id=(r->>'payment_id')::uuid AND status='success' AND amount=27000 AND source='reception_direct') THEN RAISE EXCEPTION 'Success revenue payment failed live-style guards'; END IF;
 SELECT public.finalize_public_join_payment('SPF-GUARD-000001','monthly','Guard Online','guard-online@example.test','08011345671',2,5,clock_timestamp(),'card','CUS-TEST','REGOFF',2700000) INTO r;
 IF r->>'success'<>'true' OR NOT EXISTS(SELECT 1 FROM public.members WHERE id=(r->>'member_id')::uuid AND source='website') THEN RAISE EXCEPTION 'Public join failed live-style guards: %',r; END IF;
END $fn$;
SELECT 'PASS: direct revenue and online REGOFF with representative live source and financial guards; client bypass rejected' AS result;
