-- STAGED ONLY: do not execute until a durable independent restore has succeeded,
-- the reception member-profile frontend uses reception_member_payment_history,
-- and the owner has reviewed the coordinated cutover.
-- Target project: sytcvezkryjcxwqdimuz (never run on another project).
-- All statements run atomically: an error rolls back the entire migration.
BEGIN;

-- The intended receptionist login has a reception access role in staff_users,
-- but one associated staff_profiles row is incorrectly labelled admin.
-- Refuse to guess if the number of mismatches changes.
DO $guard$
DECLARE mismatches integer;
BEGIN
  SELECT count(*) INTO mismatches
  FROM public.staff_profiles sp
  JOIN public.staff_users su ON su.auth_user_id = sp.auth_user_id
  WHERE lower(su.role) = 'reception' AND su.active IS TRUE
    AND lower(sp.role) = 'admin';
  IF mismatches <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one receptionist/admin profile mismatch; found %. No changes applied.', mismatches;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='payments'
      AND policyname='Members can view own payments'
      AND cmd='SELECT' AND qual LIKE '%is_staff()%'
  ) THEN
    RAISE EXCEPTION 'Existing payments SELECT policy changed; manual review required. No changes applied.';
  END IF;
END;
$guard$;

-- Adjust the DISPLAY role only; keep staff_users permissions, identity,
-- historical attendance, payment and salary references unchanged.
UPDATE public.staff_profiles sp
SET role = 'reception', updated_at = now()
FROM public.staff_users su
WHERE su.auth_user_id = sp.auth_user_id
  AND lower(su.role) = 'reception' AND su.active IS TRUE
  AND lower(sp.role) = 'admin';

-- A receptionist can view the payment history of a specific existing member
-- through this checked, member-scoped function, not select every payment row.
-- Admins and managers retain their separate revenue-reporting mechanisms.
CREATE OR REPLACE FUNCTION public.reception_member_payment_history(p_member_id uuid)
RETURNS TABLE (
  id uuid, member_id uuid, membership_id uuid, amount numeric,
  currency text, status text, payment_method text, provider text,
  paystack_reference text, paid_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.staff_users su
    WHERE su.auth_user_id = (SELECT auth.uid())
      AND su.active IS TRUE
      AND lower(su.role) IN ('reception','admin','owner','manager')
  ) THEN
    RAISE EXCEPTION 'Authorized reception account required.' USING ERRCODE='42501';
  END IF;

  IF p_member_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.members m WHERE m.id = p_member_id
  ) THEN
    RAISE EXCEPTION 'Member not found.' USING ERRCODE='P0002';
  END IF;

  RETURN QUERY
  SELECT p.id,p.member_id,p.membership_id,p.amount,p.currency,p.status,
         p.payment_method,p.provider,p.paystack_reference,p.paid_at,p.created_at
  FROM public.payments p
  WHERE p.member_id=p_member_id
  ORDER BY p.created_at DESC,p.id DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.reception_member_payment_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reception_member_payment_history(uuid) TO authenticated, service_role;

-- Existing ALL policy already permits admin/owner/manager payment management.
-- Restrict normal SELECT to the member's own history only.
DROP POLICY "Members can view own payments" ON public.payments;
CREATE POLICY "Members can view own payments"
ON public.payments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = payments.member_id AND m.auth_user_id=(SELECT auth.uid())
  )
);

COMMIT;

-- Post-cutover verification (run separately with actual role-scoped sessions):
-- * receptionist cannot SELECT arbitrary public.payments rows;
-- * receptionist can call reception_member_payment_history(one real member id);
-- * unauthenticated, member and inactive staff cannot invoke that RPC;
-- * member can still SELECT own payments, but not other member payments;
-- * management revenue RPCs and admin payment access still work;
-- * staff_users role remains reception; only staff_profiles display role changes.
-- IMPORTANT: this function scopes one request, but cannot prevent an authorized
-- receptionist from requesting many member IDs; add audit/rate-limit controls
-- if complete cross-member revenue secrecy is a requirement.
