-- Additive-only storage for staff-confirmed WhatsApp reminders.
-- Target Supabase project: sytcvezkryjcxwqdimuz ONLY.
-- Never infer message delivery from a WhatsApp link click: a staff member must
-- explicitly confirm after sending. This table does not alter existing records.
BEGIN;

CREATE TABLE IF NOT EXISTS public.member_reminder_send_status (
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('birthday', 'renewal')),
  reminder_key text NOT NULL CHECK (char_length(reminder_key) BETWEEN 1 AND 100),
  occasion_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  confirmed_by uuid NOT NULL REFERENCES auth.users(id),
  PRIMARY KEY (member_id, reminder_type, reminder_key)
);

CREATE INDEX IF NOT EXISTS member_reminder_send_status_occasion_idx
  ON public.member_reminder_send_status (occasion_date, reminder_type);

ALTER TABLE public.member_reminder_send_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reception can read confirmed reminders"
  ON public.member_reminder_send_status
  FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

CREATE POLICY "Reception can mark reminders sent"
  ON public.member_reminder_send_status
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_staff()) AND confirmed_by = (SELECT auth.uid()));

CREATE POLICY "Reception can update own confirmation"
  ON public.member_reminder_send_status
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_staff()))
  WITH CHECK ((SELECT public.is_staff()) AND confirmed_by = (SELECT auth.uid()));

REVOKE ALL ON public.member_reminder_send_status FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.member_reminder_send_status TO authenticated;

COMMIT;

-- No policy permits DELETE. Members, signed-out visitors, inactive staff, and
-- non-reception roles cannot read or mark confirmations. No sent messages are
-- transmitted by this migration; only a manual staff acknowledgement is stored.
