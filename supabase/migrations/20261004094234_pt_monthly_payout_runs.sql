create table public.pt_payout_runs (
  id uuid primary key default gen_random_uuid(),
  payout_month date not null unique,
  payout_pool numeric(12,2) not null check (payout_pool >= 0),
  team_weight numeric(5,4) not null default 0.5000 check (team_weight between 0 and 1),
  workload_weight numeric(5,4) not null default 0.3000 check (workload_weight between 0 and 1),
  performance_weight numeric(5,4) not null default 0.2000 check (performance_weight between 0 and 1),
  breakdown jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_trunc('month', payout_month)::date = payout_month),
  check (abs((team_weight + workload_weight + performance_weight) - 1.0) < 0.0001)
);

alter table public.pt_payout_runs enable row level security;

revoke all on table public.pt_payout_runs from anon, authenticated;
grant select, insert, update on table public.pt_payout_runs to authenticated;
grant select, insert, update, delete on table public.pt_payout_runs to service_role;

create policy "Management can view PT payout runs"
on public.pt_payout_runs
for select
to authenticated
using ((select private.is_staff_admin()));

create policy "Management can create PT payout runs"
on public.pt_payout_runs
for insert
to authenticated
with check ((select private.is_staff_admin()));

create policy "Management can update PT payout runs"
on public.pt_payout_runs
for update
to authenticated
using ((select private.is_staff_admin()))
with check ((select private.is_staff_admin()));
