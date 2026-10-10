-- Follow-up migration for the already installed missed-scan RPC.
-- Apply only to the Super Plus Fitness Supabase project after a verified backup.
-- No attendance, payroll, request history or audit rows are modified.
-- This replaces the existing review RPC with the same signature and privileges.
CREATE OR REPLACE FUNCTION public.review_staff_missed_scan(
  p_request_id uuid,
  p_decision text,
  p_note text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_request uuid;
  v_submitted_by uuid;
BEGIN
  IF NOT public.missed_scan_is_manager() THEN
    RAISE EXCEPTION 'Management access required';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected')
     OR (p_note IS NOT NULL AND char_length(p_note) > 1000) THEN
    RAISE EXCEPTION 'Invalid review decision';
  END IF;

  SELECT id, submitted_by INTO v_request, v_submitted_by
  FROM public.staff_missed_scan_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Pending request not found';
  END IF;
  IF v_submitted_by = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'You cannot review your own missed-scan request';
  END IF;

  UPDATE public.staff_missed_scan_requests
  SET status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
  WHERE id = v_request;
  INSERT INTO public.staff_missed_scan_decisions(request_id, decision, reviewer_auth_id, note)
  VALUES(v_request, p_decision, auth.uid(), p_note);
END
$function$;

-- Rollback: restore the previous function definition from the verified backup.
-- Verification after applying: an authenticated admin must be unable to approve or reject
-- their own pending request, but may review a different staff member's pending request;
-- an ordinary staff user must not be able to review any request.
