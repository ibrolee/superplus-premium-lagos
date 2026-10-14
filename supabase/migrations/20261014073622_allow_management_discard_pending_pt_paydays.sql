-- Admins/owners may discard only unpaid, unlocked PT payday drafts.
-- Recorded salary payments retain their foreign-key relationship and history.
grant delete on public.pt_semimonthly_payout_runs to authenticated;

create policy "Management can discard pending PT paydays"
on public.pt_semimonthly_payout_runs
for delete to authenticated
using (
  (select auth.uid()) is not null
  and (select private.can_manage_staff_salary())
  and status = 'pending'
  and paid_at is null
  and financial_locked = false
  and not exists (
    select 1 from public.staff_salary_records salary
    where salary.pt_payout_run_id = pt_semimonthly_payout_runs.id
  )
);
