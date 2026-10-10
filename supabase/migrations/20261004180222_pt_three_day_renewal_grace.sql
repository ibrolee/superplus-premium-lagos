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
  renewal_cycles as (
    select m.id, m.member_id, m.created_at, m.end_date
    from public.memberships m
    join public.pt_assignments a on a.membership_id = m.id
    join me on me.staff_profile_id = a.trainer_staff_profile_id
    where m.payment_status = 'paid'
      and lower(coalesce(m.plan_name,'')) like 'personal training%'
      and m.end_date between
        ((clock_timestamp() at time zone 'Africa/Lagos')::date - 92)
        and ((clock_timestamp() at time zone 'Africa/Lagos')::date - 3)
  ),
  renewal_summary as (
    select
      count(*)::int as renewal_eligible,
      count(*) filter (
        where exists (
          select 1
          from public.memberships candidate
          join public.pt_assignments candidate_assignment
            on candidate_assignment.membership_id = candidate.id
          join me on me.staff_profile_id = candidate_assignment.trainer_staff_profile_id
          where candidate.member_id = cycle.member_id
            and candidate.id <> cycle.id
            and candidate.payment_status = 'paid'
            and lower(coalesce(candidate.plan_name,'')) like 'personal training%'
            and candidate.created_at > cycle.created_at
            and candidate.end_date > cycle.end_date
            and candidate.start_date <= (cycle.end_date + 3)
        )
      )::int as renewed_same_coach
    from renewal_cycles cycle
  )
  select
    me.staff_profile_id,
    me.display_name as coach_name,
    coalesce(cs.current_trainees,0) as current_trainees,
    coalesce(es.evaluation_count,0) as evaluation_count,
    coalesce(es.evaluation_count,0) >= 3 as rating_established,
    case when coalesce(es.evaluation_count,0) >= 3 then round(es.overall_rating,2) end as overall_rating,
    case when coalesce(es.evaluation_count,0) >= 3 then round(es.professionalism_rating,2) end as professionalism_rating,
    case when coalesce(es.evaluation_count,0) >= 3 then round(es.punctuality_rating,2) end as punctuality_rating,
    case when coalesce(es.evaluation_count,0) >= 3 then round(es.communication_rating,2) end as communication_rating,
    case when coalesce(es.evaluation_count,0) >= 3 then round(es.coaching_quality_rating,2) end as coaching_quality_rating,
    case when coalesce(es.evaluation_count,0) >= 3 then round(es.motivation_rating,2) end as motivation_rating,
    case when coalesce(es.evaluation_count,0) >= 3 then round(es.program_consistency_percent,1) end as program_consistency_percent,
    case when coalesce(es.evaluation_count,0) >= 3 then round(es.continue_rate,1) end as continue_rate,
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
