-- Rollback snapshot of public.review_staff_missed_scan from Super Plus Fitness project
-- sytcvezkryjcxwqdimuz, inspected 2026-09-19 before applying the self-review fix.
-- This restores ONLY the previous function; it does not modify request or decision rows.
-- SECURITY WARNING: this original definition permits an administrator to review their own request.
CREATE OR REPLACE FUNCTION public.review_staff_missed_scan(
  p_request_id uuid, p_decision text, p_note text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_request uuid;
BEGIN
  IF NOT public.missed_scan_is_manager() THEN
    RAISE EXCEPTION 'Management access required';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected')
     OR (p_note IS NOT NULL AND char_length(p_note) > 1000) THEN
    RAISE EXCEPTION 'Invalid review decision';
  END IF;
  SELECT id INTO v_request
  FROM public.staff_missed_scan_requests
  WHERE id=p_request_id AND status='pending'
  FOR UPDATE;
  IF v_request IS NULL THEN RAISE EXCEPTION 'Pending request not found'; END IF;
  UPDATE public.staff_missed_scan_requests
  SET status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_note=p_note
  WHERE id=v_request;
  INSERT INTO public.staff_missed_scan_decisions(request_id,decision,reviewer_auth_id,note)
  VALUES(v_request,p_decision,auth.uid(),p_note);
END
$function$;
