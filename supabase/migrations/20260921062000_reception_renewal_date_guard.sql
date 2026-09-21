-- Existing membership access is date-gated: a paid row with status='active' and a
-- future start_date is UPCOMING, not currently usable. Preserve that convention;
-- changing future renewals to 'pending' would prevent access on their start date.
-- This guard ensures a new reception membership never overlaps another paid,
-- non-cancelled membership for the same member. The registration RPC already
-- locks the member row before calculating renewal dates.
CREATE OR REPLACE FUNCTION public.reception_prevent_membership_overlap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF NEW.source NOT IN ('reception_direct','reception_renewal') THEN
  RETURN NEW;
 END IF;
 IF NEW.start_date IS NULL OR NEW.end_date IS NULL OR NEW.end_date < NEW.start_date THEN
  RAISE EXCEPTION 'Invalid reception membership dates.';
 END IF;
 IF EXISTS (
  SELECT 1 FROM public.memberships existing
  WHERE existing.member_id = NEW.member_id
    AND existing.id IS DISTINCT FROM NEW.id
    AND existing.payment_status = 'paid'
    AND existing.status IN ('active','pending','paused')
    AND existing.start_date <= NEW.end_date
    AND existing.end_date >= NEW.start_date
 ) THEN
  RAISE EXCEPTION 'Membership dates overlap an existing paid membership. Review the member history before collecting another payment.';
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.reception_prevent_membership_overlap() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS reception_prevent_membership_overlap ON public.memberships;
CREATE TRIGGER reception_prevent_membership_overlap
BEFORE INSERT OR UPDATE OF member_id, start_date, end_date, status, payment_status, source
ON public.memberships FOR EACH ROW
WHEN (NEW.source IN ('reception_direct','reception_renewal'))
EXECUTE FUNCTION public.reception_prevent_membership_overlap();
