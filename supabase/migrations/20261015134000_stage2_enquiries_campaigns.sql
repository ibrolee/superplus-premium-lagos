-- Stage 2: public contact collection, private follow-up inbox, scheduled events and promotions.
create table public.wc_enquiries(
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('contact','hmo','partnership')),
 full_name text not null check(length(full_name) between 2 and 120),
 email text not null check(length(email) between 6 and 190),
 phone text not null default '' check(length(phone)<=30),
 organization text not null default '' check(length(organization)<=180),
 message text not null check(length(message) between 10 and 5000),
 status text not null default 'new' check(status in ('new','contacted','in_progress','resolved','spam')),
 assigned_staff uuid references public.staff_users(auth_user_id),
 internal_note text not null default '' check(length(internal_note)<=5000),
 received_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 updated_by uuid
);
create index wc_enquiries_recent on public.wc_enquiries(received_at desc);
create index wc_enquiries_email_throttle on public.wc_enquiries(lower(email),received_at desc);
alter table public.wc_enquiries enable row level security;
revoke all on public.wc_enquiries from public,anon,authenticated;
grant select on public.wc_enquiries to authenticated;
create policy wc_enquiries_admin_read on public.wc_enquiries for select to authenticated
using(private.site_control_admin());

create or replace function public.wc_submit_enquiry(
 p_kind text,p_name text,p_email text,p_phone text,p_message text,p_organization text default '',p_website text default ''
) returns jsonb language plpgsql security definer set search_path='' as $$
declare n text:=btrim(coalesce(p_name,''));e text:=lower(btrim(coalesce(p_email,'')));m text:=btrim(coalesce(p_message,''));k text:=coalesce(p_kind,'contact');
begin
 -- Hidden honeypot traps automated submissions without storing private data.
 if btrim(coalesce(p_website,''))<>'' then return jsonb_build_object('received',true);end if;
 if k not in ('contact','hmo','partnership') or length(n) not between 2 and 120
    or e !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    or length(e)>190 or length(m) not between 10 and 5000
    or length(coalesce(p_phone,''))>30 or length(coalesce(p_organization,''))>180
 then raise exception 'Please provide your name, valid email and a message of at least 10 characters.';end if;
 -- Advisory lock ensures simultaneous requests from the same address cannot bypass throttling.
 perform pg_advisory_xact_lock(hashtextextended(e,1781));
 if (select count(*) from public.wc_enquiries where lower(email)=e and received_at>now()-interval '1 hour')>=3
 then raise exception 'Too many requests. Please contact us by phone or try again later.';end if;
 if exists(select 1 from public.wc_enquiries where lower(email)=e and message=m and received_at>now()-interval '10 minutes')
 then return jsonb_build_object('received',true);end if;
 insert into public.wc_enquiries(kind,full_name,email,phone,organization,message)
 values(k,n,e,btrim(coalesce(p_phone,'')),btrim(coalesce(p_organization,'')),m);
 return jsonb_build_object('received',true);
end $$;
revoke all on function public.wc_submit_enquiry(text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.wc_submit_enquiry(text,text,text,text,text,text,text) to anon,authenticated;

create or replace function public.wc_admin_update_enquiry(
 p_id uuid,p_status text,p_assigned_staff uuid default null,p_note text default ''
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.site_control_admin() then raise exception 'Admin or owner only.';end if;
 if p_status not in ('new','contacted','in_progress','resolved','spam') or length(coalesce(p_note,''))>5000
 then raise exception 'Invalid status or internal note.';end if;
 if p_assigned_staff is not null and not exists(select 1 from public.staff_users
   where auth_user_id=p_assigned_staff and active) then raise exception 'Staff member unavailable.';end if;
 update public.wc_enquiries set status=p_status,assigned_staff=p_assigned_staff,internal_note=coalesce(p_note,''),
   updated_at=now(),updated_by=auth.uid() where id=p_id;
 if not found then raise exception 'Enquiry not found.';end if;
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.wc_admin_update_enquiry(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.wc_admin_update_enquiry(uuid,text,uuid,text) to authenticated;

create table public.wc_campaigns(
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('event','promotion')),
 title text not null check(length(title) between 3 and 120),
 description text not null default '' check(length(description)<=1500),
 image_url text not null default '' check(length(image_url)<=850),
 button_label text not null default '' check(length(button_label)<=60),
 button_url text not null default '' check(length(button_url)<=350),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 changed_by uuid,
 constraint campaign_duration check(ends_at>starts_at)
);
create index wc_campaigns_live on public.wc_campaigns(kind,starts_at,ends_at) where published;
alter table public.wc_campaigns enable row level security;
revoke all on public.wc_campaigns from public,anon,authenticated;
grant select on public.wc_campaigns to authenticated;
create policy wc_campaigns_admin_read on public.wc_campaigns for select to authenticated using(private.site_control_admin());

create or replace function public.wc_public_campaigns(p_kind text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'title',title,'description',description,
 'image_url',image_url,'button_label',button_label,'button_url',button_url,
 'starts_at',starts_at,'ends_at',ends_at) order by starts_at asc),'[]'::jsonb)
 from public.wc_campaigns where published and starts_at<=now() and ends_at>now()
 and (p_kind is null or kind=p_kind)
$$;
revoke all on function public.wc_public_campaigns(text) from public,anon,authenticated;
grant execute on function public.wc_public_campaigns(text) to anon,authenticated;

create or replace function public.wc_admin_save_campaign(
 p_id uuid,p_kind text,p_title text,p_description text,p_image_url text,p_button_label text,p_button_url text,
 p_starts_at timestamptz,p_ends_at timestamptz,p_published boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare campaign_id uuid;
begin
 if not private.site_control_admin() then raise exception 'Admin or owner only.';end if;
 if p_kind not in ('event','promotion') or length(btrim(coalesce(p_title,''))) not between 3 and 120
 or length(coalesce(p_description,''))>1500 or length(coalesce(p_image_url,''))>850
 or (coalesce(p_image_url,'')<>'' and p_image_url !~ '^https://')
 or length(coalesce(p_button_label,''))>60 or length(coalesce(p_button_url,''))>350
 or (coalesce(p_button_url,'')<>'' and p_button_url<>'/' and p_button_url !~ '^(/[^/]|https://)')
 or p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at or p_ends_at>now()+interval '3 years'
 then raise exception 'Invalid event details, dates, button URL or image.';end if;
 if p_id is null then
  insert into public.wc_campaigns(kind,title,description,image_url,button_label,button_url,starts_at,ends_at,published,changed_by)
  values(p_kind,btrim(p_title),coalesce(p_description,''),coalesce(p_image_url,''),coalesce(p_button_label,''),
  coalesce(p_button_url,''),p_starts_at,p_ends_at,p_published,auth.uid()) returning id into campaign_id;
 else
  update public.wc_campaigns set kind=p_kind,title=btrim(p_title),description=coalesce(p_description,''),
  image_url=coalesce(p_image_url,''),button_label=coalesce(p_button_label,''),button_url=coalesce(p_button_url,''),
  starts_at=p_starts_at,ends_at=p_ends_at,published=p_published,changed_by=auth.uid(),updated_at=now()
  where id=p_id returning id into campaign_id;
  if campaign_id is null then raise exception 'Campaign not found.';end if;
 end if;
 return jsonb_build_object('success',true,'id',campaign_id);
end $$;
revoke all on function public.wc_admin_save_campaign(uuid,text,text,text,text,text,text,timestamptz,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.wc_admin_save_campaign(uuid,text,text,text,text,text,text,timestamptz,timestamptz,boolean) to authenticated;

create or replace function public.wc_admin_remove_campaign(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.site_control_admin() then raise exception 'Admin or owner only.';end if;
 -- Soft unpublish preserves promotional records; explicit delete is unnecessary.
 update public.wc_campaigns set published=false,updated_at=now(),changed_by=auth.uid() where id=p_id;
 if not found then raise exception 'Campaign not found.';end if;
 return jsonb_build_object('unpublished',true);
end $$;
revoke all on function public.wc_admin_remove_campaign(uuid) from public,anon,authenticated;
grant execute on function public.wc_admin_remove_campaign(uuid) to authenticated;
