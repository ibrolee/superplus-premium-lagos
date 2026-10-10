-- APPLY ONLY AFTER THE CARD PREVIEW IS APPROVED. This is additive and does not
-- change existing QR tokens, memberships, attendance, payments or revenue.
BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.member_card_number_seq AS bigint START WITH 1;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS member_card_number bigint;

-- Assign an immutable number to every historical member in a repeatable order.
-- Existing assigned numbers are never overwritten, even on a rerun.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS position
  FROM public.members WHERE member_card_number IS NULL
), maximum AS (
  SELECT COALESCE(MAX(member_card_number), 0) AS max_number FROM public.members
)
UPDATE public.members AS member
SET member_card_number = maximum.max_number + numbered.position
FROM numbered CROSS JOIN maximum
WHERE member.id = numbered.id AND member.member_card_number IS NULL;

SELECT setval('public.member_card_number_seq', GREATEST((SELECT COALESCE(MAX(member_card_number),0) FROM public.members), 1), (SELECT COUNT(*) > 0 FROM public.members));
ALTER TABLE public.members ALTER COLUMN member_card_number SET DEFAULT nextval('public.member_card_number_seq'::regclass);
ALTER SEQUENCE public.member_card_number_seq OWNED BY public.members.member_card_number;
ALTER TABLE public.members ALTER COLUMN member_card_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS members_member_card_number_unique ON public.members (member_card_number);

CREATE OR REPLACE FUNCTION public.prevent_member_card_number_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.member_card_number IS DISTINCT FROM OLD.member_card_number THEN
    RAISE EXCEPTION 'Permanent member card number cannot be changed';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS members_card_number_immutable ON public.members;
CREATE TRIGGER members_card_number_immutable BEFORE UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.prevent_member_card_number_change();

CREATE TABLE IF NOT EXISTS public.member_card_reissues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id),
  reissued_by uuid NOT NULL,
  reissued_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 8 AND 500)
);
ALTER TABLE public.member_card_reissues ENABLE ROW LEVEL SECURITY;
-- Audit history is deliberately not exposed directly to the browser.
REVOKE ALL ON public.member_card_reissues FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_reissue_member_card(p_member_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role text;
BEGIN
  SELECT lower(role) INTO v_role FROM public.staff_users
  WHERE auth_user_id = auth.uid() AND active = true LIMIT 1;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an active administrator can reissue membership cards';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'Enter a reason between 8 and 500 characters';
  END IF;
  UPDATE public.members SET qr_token = gen_random_uuid() WHERE id = p_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  INSERT INTO public.member_card_reissues(member_id, reissued_by, reason)
  VALUES (p_member_id, auth.uid(), trim(p_reason));
  -- The existing scanner looks up the currently stored token; the old card
  -- immediately stops working. The permanent member number never changes.
  RETURN jsonb_build_object('success', true, 'member_id', p_member_id);
END $$;
REVOKE ALL ON FUNCTION public.admin_reissue_member_card(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reissue_member_card(uuid,text) TO authenticated;

COMMIT;
