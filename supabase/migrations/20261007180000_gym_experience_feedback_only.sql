-- Remove the app-feedback SP Points path. Gym Experience remains the only
-- private experience-feedback bonus. Existing app feedback/ledger history is
-- preserved; this only prevents new app-feedback submissions and awards.

create or replace function public.submit_my_experience_feedback(
  p_kind text,
  p_overall_rating integer,
  p_ratings jsonb,
  p_comments text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member uuid;
  v_existing uuid;
  v_new boolean := false;
  v_points integer := 10;
  v_balance bigint := 0;
  v_key text;
  v_value text;
begin
  if v_uid is null then
    raise exception 'Sign in required.' using errcode='42501';
  end if;

  select id into v_member
  from public.members
  where auth_user_id=v_uid
  limit 1;

  if v_member is null then
    raise exception 'Member account is not linked yet.';
  end if;

  if p_kind <> 'gym' then
    raise exception 'Only Gym Experience Feedback is currently available for SP Points.';
  end if;

  if p_overall_rating not between 1 and 5 then
    raise exception 'Overall rating must be between 1 and 5.';
  end if;

  if p_ratings is null or jsonb_typeof(p_ratings) <> 'object' then
    raise exception 'Ratings are required.';
  end if;

  if not exists (
    select 1 from public.attendance a
    where a.member_id=v_member
    limit 1
  ) then
    raise exception 'A recorded gym visit is required before rating the gym experience.';
  end if;

  foreach v_key in array array['equipment','cleanliness','staff','facilities']
  loop
    v_value := p_ratings ->> v_key;
    if v_value is null or v_value !~ '^[1-5]$' then
      raise exception 'Complete all gym ratings.';
    end if;
  end loop;

  if p_comments is not null and char_length(p_comments) > 2000 then
    raise exception 'Feedback comment is too long.';
  end if;

  select id into v_existing
  from public.member_experience_feedback
  where member_id=v_member and feedback_kind='gym';

  if v_existing is null then
    insert into public.member_experience_feedback(
      member_id,feedback_kind,overall_rating,ratings,comments,points_awarded
    )
    values(
      v_member,'gym',p_overall_rating,p_ratings,nullif(btrim(p_comments),''),v_points
    );

    insert into public.member_points_ledger(member_id,points,reason,source_key)
    values(
      v_member,
      v_points,
      'Private gym experience feedback bonus',
      'experience-feedback:gym'
    )
    on conflict (member_id,source_key) do nothing;

    v_new := true;
  else
    update public.member_experience_feedback
    set overall_rating=p_overall_rating,
        ratings=p_ratings,
        comments=nullif(btrim(p_comments),''),
        updated_at=now()
    where id=v_existing;
  end if;

  select coalesce(sum(points),0)
  into v_balance
  from public.member_points_ledger
  where member_id=v_member;

  return jsonb_build_object(
    'feedback_kind','gym',
    'new_submission',v_new,
    'points_awarded',case when v_new then v_points else 0 end,
    'balance',v_balance
  );
end
$$;

revoke all on function public.submit_my_experience_feedback(text,integer,jsonb,text)
from public,anon,authenticated;
grant execute on function public.submit_my_experience_feedback(text,integer,jsonb,text)
to authenticated;
