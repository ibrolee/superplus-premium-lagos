-- Track membership card production costs as their own operating expense category.
ALTER TABLE public.gym_expenses
 DROP CONSTRAINT gym_expenses_category_check,
 ADD CONSTRAINT gym_expenses_category_check
 CHECK (category IN ('internet','electricity','petrol','gas','membership_cards','other'));
