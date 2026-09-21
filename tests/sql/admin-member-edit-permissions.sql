-- Read-only regression checks for the profile-edit migration.
-- Safe to run in production: never updates, creates, or deletes member records.
DO $tests$
DECLARE
  v_body text;
BEGIN
  SELECT pg_get_functiondef('public.admin_update_member_profile(uuid,timestamptz,jsonb)'::regprocedure)
  INTO v_body;
  IF v_body NOT LIKE '%lower(s.role)=''admin''%' THEN
    RAISE EXCEPTION 'Admin-only RPC role guard is missing.';
  END IF;
  IF v_body NOT LIKE '%auth_user_id%' OR v_body NOT LIKE '%login_changed%' THEN
    RAISE EXCEPTION 'RPC identity protections are missing.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='member_profile_edit_audit' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Edit audit table is missing or RLS disabled.';
  END IF;
  IF has_function_privilege('anon','public.admin_update_member_profile(uuid,timestamptz,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous callers can execute profile edit RPC.';
  END IF;
  RAISE NOTICE 'PASS: admin-role guard, identity protections, audit RLS, and anonymous permissions.';
END $tests$;
