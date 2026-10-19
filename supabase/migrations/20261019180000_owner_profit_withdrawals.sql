-- Owner profit withdrawals are distributions, not operating expenses.
CREATE TABLE public.gym_owner_withdrawals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 withdrawal_date date NOT NULL CHECK (withdrawal_date >= DATE '2026-10-01'),
 amount numeric NOT NULL CHECK (amount > 0 AND amount <= 100000000 AND amount = round(amount,2)),
 recipient text NOT NULL DEFAULT 'Owner' CHECK (length(btrim(recipient)) BETWEEN 1 AND 120),
 payment_method text NOT NULL DEFAULT 'Bank Transfer' CHECK (payment_method IN ('Cash','POS','Bank Transfer')),
 reference text NOT NULL DEFAULT '' CHECK (length(reference) <= 200),
 notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 1500),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 voided_at timestamptz,
 voided_by uuid REFERENCES auth.users(id),
 CHECK ((voided_at IS NULL) = (voided_by IS NULL))
);
ALTER TABLE public.gym_owner_withdrawals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gym_owner_withdrawals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gym_owner_withdrawals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gym_owner_withdrawals TO service_role;
CREATE POLICY gym_owner_withdrawals_admin_select ON public.gym_owner_withdrawals FOR SELECT TO authenticated
 USING ((SELECT private.can_manage_staff_salary()));
CREATE POLICY gym_owner_withdrawals_admin_insert ON public.gym_owner_withdrawals FOR INSERT TO authenticated
 WITH CHECK ((SELECT private.can_manage_staff_salary()));
CREATE POLICY gym_owner_withdrawals_admin_update ON public.gym_owner_withdrawals FOR UPDATE TO authenticated
 USING ((SELECT private.can_manage_staff_salary()))
 WITH CHECK ((SELECT private.can_manage_staff_salary()));
CREATE INDEX gym_owner_withdrawals_month_idx ON public.gym_owner_withdrawals(withdrawal_date DESC, id) WHERE voided_at IS NULL;

CREATE OR REPLACE FUNCTION private.guard_gym_owner_withdrawal() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_staff_salary() THEN
  RAISE EXCEPTION 'Active admin or owner required to record owner withdrawals.' USING ERRCODE='42501';
 END IF;
 IF NEW.withdrawal_date > (clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date THEN
  RAISE EXCEPTION 'A withdrawal date cannot be in the future.';
 END IF;
 NEW.recipient := btrim(NEW.recipient);
 NEW.reference := btrim(NEW.reference);
 NEW.notes := btrim(NEW.notes);
 NEW.updated_by := auth.uid();
 NEW.updated_at := clock_timestamp();
 IF TG_OP='INSERT' THEN
  NEW.created_by := auth.uid(); NEW.created_at := clock_timestamp();
  NEW.voided_at := NULL; NEW.voided_by := NULL;
 ELSE
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Withdrawal identity cannot change.'; END IF;
  NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at;
  IF NEW.voided_at IS DISTINCT FROM OLD.voided_at THEN
   NEW.voided_at := CASE WHEN NEW.voided_at IS NULL THEN NULL ELSE clock_timestamp() END;
   NEW.voided_by := CASE WHEN NEW.voided_at IS NULL THEN NULL ELSE auth.uid() END;
  ELSE
   NEW.voided_by := OLD.voided_by;
  END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION private.guard_gym_owner_withdrawal() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER gym_owner_withdrawal_guard BEFORE INSERT OR UPDATE ON public.gym_owner_withdrawals
 FOR EACH ROW EXECUTE FUNCTION private.guard_gym_owner_withdrawal();

CREATE OR REPLACE FUNCTION public.admin_get_owner_withdrawals_month(p_month_start date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $fn$
DECLARE v_end date; v_total numeric; v_count integer; v_rows jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_staff_salary() THEN
  RAISE EXCEPTION 'Owner withdrawals are available to active admin and owner accounts.' USING ERRCODE='42501';
 END IF;
 IF p_month_start IS NULL OR p_month_start < DATE '2026-10-01' OR extract(day from p_month_start) <> 1 THEN
  RAISE EXCEPTION 'Choose a valid month.';
 END IF;
 v_end := (date_trunc('month',p_month_start)+interval '1 month')::date;
 SELECT coalesce(sum(w.amount),0),count(*),
  coalesce(jsonb_agg(to_jsonb(w) ORDER BY w.withdrawal_date DESC,w.created_at DESC,w.id),'[]'::jsonb)
 INTO v_total,v_count,v_rows
 FROM public.gym_owner_withdrawals w
 WHERE w.withdrawal_date >= p_month_start AND w.withdrawal_date < v_end AND w.voided_at IS NULL;
 RETURN jsonb_build_object('month_start',p_month_start,'withdrawal_total',v_total,'withdrawal_count',v_count,'withdrawals',v_rows);
END $fn$;
REVOKE ALL ON FUNCTION public.admin_get_owner_withdrawals_month(date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_owner_withdrawals_month(date) TO authenticated;
NOTIFY pgrst,'reload schema';
