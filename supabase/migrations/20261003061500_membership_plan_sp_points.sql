-- Award 5 SP Points whenever a paid membership is created or becomes paid.
-- This applies to first-time membership registration and every future renewal.
-- Registration-fee-only records do not create memberships, so they do not earn this reward.

create or replace function public.award_membership_plan_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
begin
  if new.payment_status is distinct from 'paid' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.payment_status is not distinct from 'paid' then
    return new;
  end if;

  if exists (
    select 1
    from public.memberships m
    where m.member_id = new.member_id
      and m.id <> new.id
      and m.payment_status = 'paid'
  ) then
    v_reason := 'Membership renewal';
  else
    v_reason := 'Membership registration';
  end if;

  insert into public.member_points_ledger(
    member_id,
    points,
    reason,
    source_key
  )
  values(
    new.member_id,
    5.00,
    v_reason,
    'membership-plan:' || new.id::text
  )
  on conflict (member_id, source_key) do nothing;

  return new;
end
$$;

drop trigger if exists award_membership_plan_points on public.memberships;

create trigger award_membership_plan_points
after insert or update of payment_status
on public.memberships
for each row
execute function public.award_membership_plan_points();
