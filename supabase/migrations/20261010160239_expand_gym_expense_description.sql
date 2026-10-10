-- Allow detailed expense paragraphs while retaining a required, bounded description.
ALTER TABLE public.gym_expenses
 DROP CONSTRAINT gym_expenses_description_check,
 ADD CONSTRAINT gym_expenses_description_check
 CHECK (length(btrim(description)) BETWEEN 1 AND 10000);
