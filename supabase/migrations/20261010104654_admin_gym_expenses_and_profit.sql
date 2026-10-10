-- Admin/owner-only operating expense ledger. Salaries are handled by payroll, never entered twice here.
CREATE TABLE public.gym_expenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 expense_date date NOT NULL CHECK (expense_date >= DATE '2026-10-01'),
 category text NOT NULL CHECK (category IN ('internet','electricity','petrol','gas','other')),
 description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 250),
 amount numeric NOT NULL CHECK (amount > 0 AND amount <= 100000000 AND amount = round(amount,2)),
 payment_method text NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash','POS','Bank Transfer')),
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
ALTER TABLE public.gym_expenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gym_expenses FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gym_expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gym_expenses TO service_role;
CREATE POLICY gym_expenses_admin_select ON public.gym_expenses FOR SELECT TO authenticated
 USING ((SELECT private.can_manage_staff_salary()));
CREATE POLICY gym_expenses_admin_insert ON public.gym_expenses FOR INSERT TO authenticated
 WITH CHECK ((SELECT private.can_manage_staff_salary()));
CREATE POLICY gym_expenses_admin_update ON public.gym_expenses FOR UPDATE TO authenticated
 USING ((SELECT private.can_manage_staff_salary()))
 WITH CHECK ((SELECT private.can_manage_staff_salary()));
CREATE INDEX gym_expenses_month_idx ON public.gym_expenses(expense_date DESC, id) WHERE voided_at IS NULL;
CREATE INDEX gym_expenses_created_by_idx ON public.gym_expenses(created_by);
CREATE INDEX gym_expenses_updated_by_idx ON public.gym_expenses(updated_by);
CREATE INDEX gym_expenses_voided_by_idx ON public.gym_expenses(voided_by) WHERE voided_by IS NOT NULL;

CREATE OR REPLACE FUNCTION private.guard_gym_expense() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_staff_salary() THEN
  RAISE EXCEPTION 'Active admin or owner required to record gym expenses.' USING ERRCODE='42501';
 END IF;
 IF NEW.expense_date > (clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date THEN
  RAISE EXCEPTION 'An expense date cannot be in the future.';
 END IF;
 NEW.description := btrim(NEW.description);
 NEW.reference := btrim(NEW.reference);
 NEW.notes := btrim(NEW.notes);
 NEW.updated_by := auth.uid();
 NEW.updated_at := clock_timestamp();
 IF TG_OP='INSERT' THEN
  NEW.created_by := auth.uid(); NEW.created_at := clock_timestamp();
  NEW.voided_at := NULL; NEW.voided_by := NULL;
 ELSE
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Expense identity cannot change.'; END IF;
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
REVOKE ALL ON FUNCTION private.guard_gym_expense() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER gym_expense_guard BEFORE INSERT OR UPDATE ON public.gym_expenses
 FOR EACH ROW EXECUTE FUNCTION private.guard_gym_expense();

CREATE OR REPLACE FUNCTION public.admin_get_finance_month(p_month_start date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $fn$
DECLARE
 v_end date; v_start_ts timestamptz; v_end_ts timestamptz; v_baseline timestamptz;
 v_revenue numeric; v_revenue_count integer; v_foreign_count integer;
 v_expenses numeric; v_expense_count integer; v_rows jsonb; v_categories jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_staff_salary() THEN
  RAISE EXCEPTION 'Expenses and profit are available to active admin and owner accounts.' USING ERRCODE='42501';
 END IF;
 IF p_month_start IS NULL OR p_month_start < DATE '2026-10-01' OR extract(day from p_month_start) <> 1 THEN RAISE EXCEPTION 'Choose a valid month.'; END IF;
 v_end := (date_trunc('month',p_month_start)+interval '1 month')::date;
 v_start_ts := p_month_start::timestamp AT TIME ZONE 'Africa/Lagos';
 v_end_ts := v_end::timestamp AT TIME ZONE 'Africa/Lagos';
 v_baseline := public.admin_revenue_baseline();
 SELECT coalesce(sum(r.amount) FILTER (WHERE upper(coalesce(r.currency,'NGN'))='NGN'),0),
  count(*) FILTER (WHERE upper(coalesce(r.currency,'NGN'))='NGN'),
  count(*) FILTER (WHERE upper(coalesce(r.currency,'NGN')) <> 'NGN')
 INTO v_revenue,v_revenue_count,v_foreign_count
 FROM public.admin_revenue_rows() r
 WHERE coalesce(r.paid_at,r.created_at) >= v_start_ts AND coalesce(r.paid_at,r.created_at) < v_end_ts;
 SELECT coalesce(sum(e.amount),0),count(*),
  coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.expense_date DESC,e.created_at DESC,e.id),'[]'::jsonb)
 INTO v_expenses,v_expense_count,v_rows
 FROM public.gym_expenses e WHERE e.expense_date >= p_month_start AND e.expense_date < v_end AND e.voided_at IS NULL;
 SELECT coalesce(jsonb_object_agg(category,total),'{}'::jsonb) INTO v_categories FROM (
  SELECT e.category,sum(e.amount) as total FROM public.gym_expenses e
  WHERE e.expense_date >= p_month_start AND e.expense_date < v_end AND e.voided_at IS NULL GROUP BY e.category
 ) totals;
 RETURN jsonb_build_object('month_start',p_month_start,'month_end',v_end-1,'revenue',v_revenue,
  'revenue_count',v_revenue_count,'foreign_revenue_count',v_foreign_count,
  'revenue_baseline',v_baseline,'revenue_complete',v_start_ts>=v_baseline,
  'expense_total',v_expenses,'expense_count',v_expense_count,'category_totals',v_categories,'expenses',v_rows);
END $fn$;
REVOKE ALL ON FUNCTION public.admin_get_finance_month(date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_finance_month(date) TO authenticated;
NOTIFY pgrst,'reload schema';

