-- Prevent the same social profile from earning follow bonuses for multiple members.
-- Rejected handles can be reused; pending/approved handles are unique per platform.

update public.member_social_follow_claims
set handle = lower(regexp_replace(btrim(handle), '^@+', ''));

create unique index if not exists member_social_follow_active_handle_uidx
on public.member_social_follow_claims(platform, lower(handle))
where status in ('pending','approved');

create or replace function public.submit_my_social_follow_claim(
  p_platform text,
  p_handle text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member uuid;
  v_platform text := lower(btrim(p_platform));
  v_handle text := lower(regexp_replace(btrim(p_handle), '^@+', ''));
  v_row public.member_social_follow_claims%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in required.' using errcode='42501';
  end if;

  select id into v_member
  from public.members
  where auth_user_id = v_uid
  limit 1;

  if v_member is null then
    raise exception 'Member account is not linked yet.';
  end if;

  if v_platform not in ('instagram','tiktok') then
    raise exception 'Unknown social platform.';
  end if;

  if char_length(v_handle) < 2 or char_length(v_handle) > 100 then
    raise exception 'Enter the username you followed with.';
  end if;

  select *
  into v_row
  from public.member_social_follow_claims
  where member_id = v_member
    and platform = v_platform;

  if found and v_row.status = 'approved' then
    return jsonb_build_object(
      'status','approved',
      'points_reward',v_row.points_reward,
      'already_approved',true
    );
  end if;

  begin
    insert into public.member_social_follow_claims(
      member_id,
      platform,
      handle,
      status,
      staff_note,
      reviewed_at,
      reviewed_by,
      updated_at
    )
    values(
      v_member,
      v_platform,
      v_handle,
      'pending',
      null,
      null,
      null,
      now()
    )
    on conflict (member_id,platform)
    do update set
      handle = excluded.handle,
      status = 'pending',
      staff_note = null,
      reviewed_at = null,
      reviewed_by = null,
      updated_at = now()
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'That social username is already being used for another member bonus claim.';
  end;

  return jsonb_build_object(
    'status',v_row.status,
    'points_reward',v_row.points_reward,
    'already_approved',false
  );
end
$$;

revoke all on function public.submit_my_social_follow_claim(text,text)
from public, anon, authenticated;
grant execute on function public.submit_my_social_follow_claim(text,text)
to authenticated;
