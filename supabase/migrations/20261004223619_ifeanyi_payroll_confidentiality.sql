-- Salary history is private to each staff member. Full payroll is admin/owner-only.
alter policy "Admins manage salaries" on public.staff_salary_records
 using ((select private.can_manage_staff_salary()))
 with check ((select private.can_manage_staff_salary()));
alter policy "Staff can view own salary" on public.staff_salary_records
 using (exists(select 1 from public.staff_profiles sp where sp.id=staff_salary_records.staff_profile_id and sp.auth_user_id=(select auth.uid())));
alter policy "Management can view semi-monthly PT payout runs" on public.pt_semimonthly_payout_runs
 using ((select private.can_manage_staff_salary()));
-- Keep operational PT assignment/evaluation permissions; restrict only finance RPCs.
do $$ declare v_name text; v_def text; begin
 foreach v_name in array array['public.management_save_pt_semimonthly_payout_run(date,numeric,numeric,jsonb)','public.management_mark_pt_semimonthly_payout_paid(uuid)'] loop
 v_def:=pg_get_functiondef(v_name::regprocedure);
 v_def:=replace(v_def,'private.is_staff_admin()','private.can_manage_staff_salary()');
 execute v_def;
 end loop;
end $$;

-- Contract text is stored privately, rather than embedded in public page assets.
create table private.staff_contract_terms (
 staff_profile_id uuid primary key references public.staff_profiles(id),
 terms text not null, updated_at timestamptz not null default now()
);
alter table private.staff_contract_terms enable row level security;
revoke all on private.staff_contract_terms from public,anon,authenticated;
create function public.get_my_staff_contract_terms() returns text
language sql stable security definer set search_path='' as $$
 select ct.terms from private.staff_contract_terms ct join public.staff_profiles sp on sp.id=ct.staff_profile_id
 where sp.auth_user_id=(select auth.uid());
$$;
revoke all on function public.get_my_staff_contract_terms() from public,anon;
grant execute on function public.get_my_staff_contract_terms() to authenticated;
-- This RPC already requires active admin/owner access. Add the private terms to
-- its authorized response without opening the underlying table to the API.
do $$ declare v_def text; begin
 v_def:=pg_get_functiondef('public.management_get_ifeanyi_payroll(date)'::regprocedure);
 v_def:=replace(v_def,'''staff_id'',v_id,''periods'',v_result','''staff_id'',v_id,''periods'',v_result,''contract_terms'',(select terms from private.staff_contract_terms where staff_profile_id=v_id)');
 execute v_def;
end $$;
