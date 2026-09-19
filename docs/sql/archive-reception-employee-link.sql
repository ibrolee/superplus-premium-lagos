-- STAGED ONLY: do not execute until separate portals pass owner acceptance.
-- Target project: sytcvezkryjcxwqdimuz only.
-- Never delete an auth user, member, historical staff profile, attendance or payment.
-- Existing staff_users rows are the access-role directory, NOT employee profiles;
-- preserve receptionist and admin entries so all existing RLS checks still work.
BEGIN;

DO $check$
DECLARE
  reception_user uuid;
  reception_profile uuid;
BEGIN
  SELECT u.id INTO STRICT reception_user
  FROM auth.users u
  WHERE lower(u.email) = 'spfitnessandspa@gmail.com';

  IF (SELECT count(*) FROM public.staff_users su
      WHERE su.auth_user_id = reception_user AND su.active AND su.role = 'reception') <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one active dedicated reception role; stopping.';
  END IF;

  SELECT sp.id INTO STRICT reception_profile
  FROM public.staff_profiles sp
  WHERE sp.auth_user_id = reception_user;

  IF (SELECT count(*) FROM public.staff_attendance sa WHERE sa.staff_profile_id = reception_profile) <> 0
     OR (SELECT count(*) FROM public.staff_salary_records sr WHERE sr.staff_profile_id = reception_profile) <> 0
     OR (SELECT count(*) FROM public.staff_missed_scan_requests mr WHERE mr.staff_profile_id = reception_profile) <> 0 THEN
    RAISE EXCEPTION 'Reception profile has employee history; preserve and review manually.';
  END IF;

  IF (SELECT count(*) FROM auth.users u
      JOIN public.staff_users su ON su.auth_user_id = u.id
      WHERE lower(u.email) = 'admin@superplusfitness.com'
        AND su.role = 'admin' AND su.active
        AND NOT EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.auth_user_id = u.id)) <> 1 THEN
    RAISE EXCEPTION 'Expected one active independent admin identity; stopping.';
  END IF;
END;
$check$;

-- NULL allows retaining the existing employee profile as an archived historical
-- row without tying it to the reception login. The unique index permits NULL.
ALTER TABLE public.staff_profiles ALTER COLUMN auth_user_id DROP NOT NULL;

UPDATE public.staff_profiles sp
SET auth_user_id = NULL, status = 'inactive'
FROM auth.users u
WHERE sp.auth_user_id = u.id
  AND lower(u.email) = 'spfitnessandspa@gmail.com'
  AND sp.status = 'approved'
  AND sp.role = 'reception';

DO $verify$
BEGIN
  IF (SELECT count(*) FROM public.staff_profiles sp
      JOIN auth.users u ON u.id = sp.auth_user_id
      WHERE lower(u.email) IN ('spfitnessandspa@gmail.com', 'admin@superplusfitness.com')) <> 0 THEN
    RAISE EXCEPTION 'Portal accounts still have staff profiles; rolling back.';
  END IF;
  IF (SELECT count(*) FROM public.staff_profiles
      WHERE auth_user_id IS NULL AND status = 'inactive' AND role = 'reception') < 1 THEN
    RAISE EXCEPTION 'Archived reception profile not found; rolling back.';
  END IF;
END;
$verify$;
COMMIT;
-- Rollback requires guarded reassociation of archived profile using verified
-- auth identity; do not create a new auth account or reassign payment records.
