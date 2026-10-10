CREATE OR REPLACE FUNCTION private.get_my_pt_coaching_performance()
 RETURNS TABLE(staff_profile_id uuid, coach_name text, current_trainees integer, evaluation_count integer, rating_established boolean, overall_rating numeric, professionalism_rating numeric, punctuality_rating numeric, communication_rating numeric, coaching_quality_rating numeric, motivation_rating numeric, program_consistency_percent numeric, continue_rate numeric, renewal_eligible integer, renewed_same_coach integer, renewal_rate numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with me as (
    select t.staff_profile_id, t.display_name
    from public.pt_trainers t
    join public.staff_profiles sp on sp.id = t.staff_profile_id
    where sp.auth_user_id = (select auth.uid())
      and sp.status = 'approved'
      and t.active is true
    limit 1
  ),
  eval_summary as (
    select
      count(*)::int as evaluation_count,
      avg(e.overall_rating)::numeric as overall_rating,
      avg(e.professionalism_rating)::numeric as professionalism_rating,
      avg(e.punctuality_rating)::numeric as punctuality_rating,
      avg(e.communication_rating)::numeric as communication_rating,
      avg(e.coaching_quality_rating)::numeric as coaching_quality_rating,
      avg(e.motivation_rating)::numeric as motivation_rating,
      (100.0 * count(*) filter (where e.program_consistency) / nullif(count(*),0))::numeric as program_consistency_percent,
      (100.0 * count(*) filter (where e.continuation_choice = 'continue') / nullif(count(*),0))::numeric as continue_rate
    from public.pt_evaluations e
    join me on me.staff_profile_id = e.trainer_staff_profile_id
  ),
  current_summary as (
    select count(distinct m.member_id)::int as current_trainees
    from public.memberships m
    join public.pt_assignments a on a.membership_id = m.id
    join me on me.staff_profile_id = a.trainer_staff_profile_id
    where m.status = 'active'
      and m.payment_status = 'paid'
      and lower(coalesce(m.plan_name,'')) like 'personal training%'
      and m.start_date <= (clock_timestamp() at time zone 'Africa/Lagos')::date
      and m.end_date >= (clock_timestamp() at time zone 'Africa/Lagos')::date
  ),
  all_pt_cycles as (
    select
      m.id,
      m.member_id,
      m.created_at,
      m.start_date,
      m.end_date,
      a.trainer_staff_profile_id,
      row_number() over (
        partition by m.member_id
        order by m.start_date, m.created_at, m.id
      ) as cycle_number
    from public.memberships m
    join public.pt_assignments a on a.membership_id = m.id
    where m.payment_status = 'paid'
      and lower(coalesce(m.plan_name,'')) like 'personal training%'
      and m.start_date <= (clock_timestamp() at time zone 'Africa/Lagos')::date
  ),
  first_renewals as (
    select
      second_cycle.member_id,
      second_cycle.cycle_number as second_cycle_number,
      second_cycle.end_date as second_cycle_end,
      second_cycle.trainer_staff_profile_id
    from all_pt_cycles first_cycle
    join all_pt_cycles second_cycle
      on second_cycle.member_id = first_cycle.member_id
     and second_cycle.cycle_number = first_cycle.cycle_number + 1
    join me
      on me.staff_profile_id = first_cycle.trainer_staff_profile_id
     and me.staff_profile_id = second_cycle.trainer_staff_profile_id
    where second_cycle.end_date > first_cycle.end_date
      and second_cycle.start_date <= (first_cycle.end_date + 3)
  ),
  eligible_clients as (
    select distinct member_id
    from first_renewals
    where second_cycle_end <= ((clock_timestamp() at time zone 'Africa/Lagos')::date - 3)
  ),
  retained_clients as (
    select distinct first_renewals.member_id
    from first_renewals
    join all_pt_cycles second_cycle
      on second_cycle.member_id = first_renewals.member_id
     and second_cycle.cycle_number = first_renewals.second_cycle_number
    join all_pt_cycles third_cycle
      on third_cycle.member_id = first_renewals.member_id
     and third_cycle.cycle_number = first_renewals.second_cycle_number + 1
    where first_renewals.second_cycle_end <= ((clock_timestamp() at time zone 'Africa/Lagos')::date - 3)
      and third_cycle.trainer_staff_profile_id = first_renewals.trainer_staff_profile_id
      and third_cycle.end_date > second_cycle.end_date
      and third_cycle.start_date <= (second_cycle.end_date + 3)
  ),
  renewal_summary as (
    select
      (select count(*)::int from eligible_clients) as renewal_eligible,
      (select count(*)::int from retained_clients) as renewed_same_coach
  )
  select
    me.staff_profile_id,
    me.display_name as coach_name,
    coalesce(cs.current_trainees,0) as current_trainees,
    coalesce(es.evaluation_count,0) as evaluation_count,
    coalesce(es.evaluation_count,0) >= 2 as rating_established,
    case when coalesce(es.evaluation_count,0) >= 2 then round(es.overall_rating,2) end as overall_rating,
    case when coalesce(es.evaluation_count,0) >= 2 then round(es.professionalism_rating,2) end as professionalism_rating,
    case when coalesce(es.evaluation_count,0) >= 2 then round(es.punctuality_rating,2) end as punctuality_rating,
    case when coalesce(es.evaluation_count,0) >= 2 then round(es.communication_rating,2) end as communication_rating,
    case when coalesce(es.evaluation_count,0) >= 2 then round(es.coaching_quality_rating,2) end as coaching_quality_rating,
    case when coalesce(es.evaluation_count,0) >= 2 then round(es.motivation_rating,2) end as motivation_rating,
    case when coalesce(es.evaluation_count,0) >= 2 then round(es.program_consistency_percent,1) end as program_consistency_percent,
    case when coalesce(es.evaluation_count,0) >= 2 then round(es.continue_rate,1) end as continue_rate,
    coalesce(rs.renewal_eligible,0) as renewal_eligible,
    coalesce(rs.renewed_same_coach,0) as renewed_same_coach,
    case
      when coalesce(rs.renewal_eligible,0) > 0
      then round(100.0 * rs.renewed_same_coach / rs.renewal_eligible,1)
    end as renewal_rate
  from me
  cross join eval_summary es
  cross join current_summary cs
  cross join renewal_summary rs;
$function$
;
