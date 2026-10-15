-- Stage 1: versioned content management, independent of membership/payment tables.
-- Public API exposes only approved published data, never private drafts.
create table public.wc_config (
  key text primary key check (key in ('navigation','branding','facilities','testimonials')),
  draft jsonb not null,
  published jsonb not null,
  revision bigint not null default 1,
  published_revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create table public.wc_config_versions (
  id uuid primary key default gen_random_uuid(),
  key text not null references public.wc_config(key),
  version bigint not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique(key,version)
);
create table public.wc_pages (
  slug text primary key check(slug ~ '^[a-z][a-z0-9-]{1,55}$'),
  title text not null check(length(title) between 2 and 100),
  kind text not null check(kind in ('built_in','custom')),
  draft jsonb not null,
  published jsonb,
  revision bigint not null default 1,
  published_revision bigint not null default 0,
  is_published boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create table public.wc_page_versions (
  id uuid primary key default gen_random_uuid(),
  slug text not null references public.wc_pages(slug),
  version bigint not null,
  title text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique(slug,version)
);
create table public.wc_media (
  path text primary key,
  title text not null default '',
  alt_text text not null default '',
  category text not null default 'general',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid
);
alter table public.wc_config enable row level security;
alter table public.wc_config_versions enable row level security;
alter table public.wc_pages enable row level security;
alter table public.wc_page_versions enable row level security;
alter table public.wc_media enable row level security;
revoke all on public.wc_config,public.wc_config_versions,public.wc_pages,public.wc_page_versions,public.wc_media from public,anon,authenticated;
grant select on public.wc_config,public.wc_config_versions,public.wc_pages,public.wc_page_versions,public.wc_media to authenticated;
grant insert,update on public.wc_media to authenticated;
create policy wc_config_admin on public.wc_config for select to authenticated using(private.site_control_admin());
create policy wc_config_history_admin on public.wc_config_versions for select to authenticated using(private.site_control_admin());
create policy wc_pages_admin on public.wc_pages for select to authenticated using(private.site_control_admin());
create policy wc_pages_versions_admin on public.wc_page_versions for select to authenticated using(private.site_control_admin());
create policy wc_media_admin_read on public.wc_media for select to authenticated using(private.site_control_admin());
create policy wc_media_admin_insert on public.wc_media for insert to authenticated with check (
 private.site_control_admin() and created_by=auth.uid()
 and path ~ ('^website/'||auth.uid()::text||'/(homepage|spa-services|content|branding)/[0-9a-f-]{36}[.]jpg$')
);
create policy wc_media_admin_edit on public.wc_media for update to authenticated
 using(private.site_control_admin()) with check(private.site_control_admin());

-- Extend the existing public website image bucket to support general page media and branding.
drop policy if exists "Only website admins upload editor images" on storage.objects;
create policy "Only website admins upload editor images" on storage.objects
for insert to authenticated with check(
 bucket_id='website-editor-images'
 and name ~ ('^website/'||auth.uid()::text||'/(homepage|spa-services|content|branding)/[0-9a-f-]{36}[.]jpg$')
 and private.site_control_admin()
);

insert into public.wc_config(key,draft,published) values
('navigation',
 '{"header":[{"label":"Home","href":"/"},{"label":"App","href":"/app"},{"label":"Membership","href":"/membership"},{"label":"Personal Training","href":"/personal-training"},{"label":"Gallery","href":"/gallery"},{"label":"Spa & Recovery","href":"/spa-recovery"},{"label":"Blog","href":"/blog"},{"label":"About","href":"/about"},{"label":"HMO","href":"/hmo"},{"label":"Contact","href":"/contact"}],"footer":[{"label":"Home","href":"/"},{"label":"Membership","href":"/membership"},{"label":"Spa & Recovery","href":"/spa-recovery"},{"label":"Gallery","href":"/gallery"},{"label":"About","href":"/about"},{"label":"Contact","href":"/contact"}]}'::jsonb,
 '{"header":[{"label":"Home","href":"/"},{"label":"App","href":"/app"},{"label":"Membership","href":"/membership"},{"label":"Personal Training","href":"/personal-training"},{"label":"Gallery","href":"/gallery"},{"label":"Spa & Recovery","href":"/spa-recovery"},{"label":"Blog","href":"/blog"},{"label":"About","href":"/about"},{"label":"HMO","href":"/hmo"},{"label":"Contact","href":"/contact"}],"footer":[{"label":"Home","href":"/"},{"label":"Membership","href":"/membership"},{"label":"Spa & Recovery","href":"/spa-recovery"},{"label":"Gallery","href":"/gallery"},{"label":"About","href":"/about"},{"label":"Contact","href":"/contact"}]}'::jsonb),
('branding',
 '{"logo":"","favicon":"","primary":"#ed1027","accent":"#f76c25","tagline":"Fitness That Fits Your Life"}'::jsonb,
 '{"logo":"","favicon":"","primary":"#ed1027","accent":"#f76c25","tagline":"Fitness That Fits Your Life"}'::jsonb),
('facilities',
 '{"items":[{"id":"strength","name":"Strength Training","description":"Free weights, racks and machines for focused strength work.","image":"/strength-training.png","visible":true},{"id":"cardio","name":"Cardio","description":"Modern cardio equipment for every pace and fitness level.","image":"/cardio.png","visible":true},{"id":"functional","name":"Functional Training","description":"Open training space for movement, conditioning and performance.","image":"/functional-training.png","visible":true},{"id":"classes","name":"Group Classes","description":"Coach-led sessions built around energy, community and progress.","image":"/group-classes.png","visible":true},{"id":"equipment","name":"Modern Equipment","description":"A considered mix of equipment for complete workouts.","image":"/modern-equipment.png","visible":true}]}'::jsonb,
 '{"items":[{"id":"strength","name":"Strength Training","description":"Free weights, racks and machines for focused strength work.","image":"/strength-training.png","visible":true},{"id":"cardio","name":"Cardio","description":"Modern cardio equipment for every pace and fitness level.","image":"/cardio.png","visible":true},{"id":"functional","name":"Functional Training","description":"Open training space for movement, conditioning and performance.","image":"/functional-training.png","visible":true},{"id":"classes","name":"Group Classes","description":"Coach-led sessions built around energy, community and progress.","image":"/group-classes.png","visible":true},{"id":"equipment","name":"Modern Equipment","description":"A considered mix of equipment for complete workouts.","image":"/modern-equipment.png","visible":true}]}'::jsonb),
('testimonials',
 '{"items":[{"id":"ada","name":"Ada O.","detail":"Member, Shomolu","quote":"The team makes training feel structured, welcoming and serious. I have stayed more consistent here than anywhere else.","image":"","visible":true},{"id":"tunde","name":"Tunde A.","detail":"Member","quote":"I can train, recover and get a massage in one place. That convenience has completely changed my routine.","image":"","visible":true},{"id":"mariam","name":"Mariam K.","detail":"Personal training member","quote":"My coach pays attention to form and progress. Every session has a purpose and I can feel the difference.","image":"","visible":true}]}'::jsonb,
 '{"items":[{"id":"ada","name":"Ada O.","detail":"Member, Shomolu","quote":"The team makes training feel structured, welcoming and serious. I have stayed more consistent here than anywhere else.","image":"","visible":true},{"id":"tunde","name":"Tunde A.","detail":"Member","quote":"I can train, recover and get a massage in one place. That convenience has completely changed my routine.","image":"","visible":true},{"id":"mariam","name":"Mariam K.","detail":"Personal training member","quote":"My coach pays attention to form and progress. Every session has a purpose and I can feel the difference.","image":"","visible":true}]}'::jsonb)
on conflict do nothing;

insert into public.wc_config_versions(key,version,snapshot)
select key,1,published from public.wc_config on conflict do nothing;

insert into public.wc_pages(slug,title,kind,draft,published,revision,published_revision,is_published)
select x.slug,x.title,'built_in','{"mode":"extend","heading":"","intro":"","sections":[]}'::jsonb,
 '{"mode":"extend","heading":"","intro":"","sections":[]}'::jsonb,1,1,true from
 (values ('home','Homepage'),('about','About'),('personal-training','Personal Training'),('hmo','HMO Partnerships'),
 ('contact','Contact'),('membership','Membership'),('spa-recovery','Spa & Recovery'),
 ('gallery','Gallery'),('app','Mobile App')) as x(slug,title)
on conflict do nothing;
insert into public.wc_page_versions(slug,version,title,snapshot)
select slug,1,title,published from public.wc_pages on conflict do nothing;

create or replace function private.wc_check_document(p_data jsonb,p_type text)
returns void language plpgsql set search_path='' as $$
declare item jsonb; link text; arr jsonb; k text;
begin
 if jsonb_typeof(p_data)<>'object' or pg_column_size(p_data)>60000 then
   raise exception 'A website document must be an object under 60KB.';
 end if;
 if p_type='page' then
  if coalesce(p_data->>'mode','extend') not in ('extend','replace')
    or length(coalesce(p_data->>'heading',''))>140 or length(coalesce(p_data->>'intro',''))>1000
    or jsonb_typeof(p_data->'sections')<>'array' or jsonb_array_length(p_data->'sections')>30 then
    raise exception 'Invalid page content or too many sections.';
  end if;
  for item in select value from jsonb_array_elements(p_data->'sections') loop
   if coalesce(item->>'type','') not in ('hero','text','image','split','cta','quote')
      or length(coalesce(item->>'heading',''))>180 or length(coalesce(item->>'body',''))>4500
      or length(coalesce(item->>'image',''))>850
      or length(coalesce(item->>'button_label',''))>70
      or coalesce(item->>'image','') ~* '^(javascript|data):' then
      raise exception 'Invalid page section.';
   end if;
   link:=coalesce(item->>'button_href','');
   if length(link)>350 or (link<>'' and link !~ '^(/[^/]|https://)') then
     raise exception 'Button link must be a safe relative path or HTTPS URL.';
   end if;
  end loop;
 elsif p_type='navigation' then
  for k in select unnest(array['header','footer']) loop
   arr:=p_data->k;
   if jsonb_typeof(arr)<>'array' or jsonb_array_length(arr)>25 then raise exception 'Too many menu links.';end if;
   for item in select value from jsonb_array_elements(arr) loop
    link:=coalesce(item->>'href','');
    if length(coalesce(item->>'label','')) not between 1 and 45
      or length(link)>350
      or (link<>'/' and link !~ '^(/[^/]|https://)')
      or link ~ '^/(portal|management|reception|admin|staff)(/|-|$)' then
     raise exception 'Invalid or restricted website navigation link.';
    end if;
   end loop;
  end loop;
 elsif p_type='branding' then
  if coalesce(p_data->>'primary','') !~ '^#[0-9a-fA-F]{6}$'
    or coalesce(p_data->>'accent','') !~ '^#[0-9a-fA-F]{6}$'
    or length(coalesce(p_data->>'tagline',''))>160
    or length(coalesce(p_data->>'logo',''))>850
    or length(coalesce(p_data->>'favicon',''))>850 then
      raise exception 'Invalid branding color or image URL.';
  end if;
 elsif p_type in ('facilities','testimonials') then
   arr:=p_data->'items';
   if jsonb_typeof(arr)<>'array' or jsonb_array_length(arr)>35 then raise exception 'Too many items.';end if;
   for item in select value from jsonb_array_elements(arr) loop
    if length(coalesce(item->>'id','')) not between 3 and 65
     or length(coalesce(item->>'name','')) not between 1 and 120
     or length(coalesce(item->>'description',''))>1200
     or length(coalesce(item->>'quote',''))>1200
     or length(coalesce(item->>'detail',''))>160
     or length(coalesce(item->>'image',''))>850 then raise exception 'Invalid facility or testimonial data.'; end if;
   end loop;
 else raise exception 'Unknown content type.'; end if;
end $$;
revoke all on function private.wc_check_document(jsonb,text) from public,anon,authenticated;

create or replace function public.wc_public_config(p_key text) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce((select c.published from public.wc_config c where c.key=p_key),'{}'::jsonb)
$$;
revoke all on function public.wc_public_config(text) from public,anon,authenticated;
grant execute on function public.wc_public_config(text) to anon,authenticated;

create or replace function public.wc_public_page(p_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('slug',slug,'title',title,'kind',kind,'doc',published)
 from public.wc_pages where slug=p_slug and is_published and published is not null),'{}'::jsonb)
$$;
revoke all on function public.wc_public_page(text) from public,anon,authenticated;
grant execute on function public.wc_public_page(text) to anon,authenticated;

create or replace function public.wc_public_custom_pages() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('slug',slug,'title',title) order by title),'[]'::jsonb)
 from public.wc_pages where kind='custom' and is_published
$$;
revoke all on function public.wc_public_custom_pages() from public,anon,authenticated;
grant execute on function public.wc_public_custom_pages() to anon,authenticated;

create or replace function public.wc_admin_save_config(p_key text,p_data jsonb,p_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_revision bigint;
begin
 if not private.site_control_admin() then raise exception 'Admin/owner only.';end if;
 perform private.wc_check_document(p_data,p_key);
 update public.wc_config set draft=p_data,revision=revision+1,updated_at=now(),updated_by=auth.uid()
 where key=p_key and revision=p_revision returning revision into v_revision;
 if v_revision is null then raise exception 'Settings changed elsewhere. Refresh first.';end if;
 return jsonb_build_object('success',true,'revision',v_revision);
end $$;
revoke all on function public.wc_admin_save_config(text,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.wc_admin_save_config(text,jsonb,bigint) to authenticated;

create or replace function public.wc_admin_publish_config(p_key text,p_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.wc_config%rowtype; ver bigint;
begin
 if not private.site_control_admin() then raise exception 'Admin/owner only.';end if;
 select * into v from public.wc_config where key=p_key for update;
 if v.key is null or v.revision<>p_revision then raise exception 'Reload settings before publishing.';end if;
 perform private.wc_check_document(v.draft,p_key);
 ver:=v.published_revision+1;
 update public.wc_config set published=draft,published_revision=ver where key=p_key;
 insert into public.wc_config_versions(key,version,snapshot,created_by) values(p_key,ver,v.draft,auth.uid());
 return jsonb_build_object('success',true,'version',ver);
end $$;
revoke all on function public.wc_admin_publish_config(text,bigint) from public,anon,authenticated;
grant execute on function public.wc_admin_publish_config(text,bigint) to authenticated;

create or replace function public.wc_admin_restore_config(p_version_id uuid,p_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.wc_config_versions%rowtype; rev bigint;
begin
 if not private.site_control_admin() then raise exception 'Admin/owner only.';end if;
 select * into v from public.wc_config_versions where id=p_version_id;
 if v.id is null then raise exception 'Version not found.';end if;
 update public.wc_config set draft=v.snapshot,revision=revision+1,updated_at=now(),updated_by=auth.uid()
 where key=v.key and revision=p_revision returning revision into rev;
 if rev is null then raise exception 'Reload before restoring.';end if;
 return jsonb_build_object('success',true,'revision',rev);
end $$;
revoke all on function public.wc_admin_restore_config(uuid,bigint) from public,anon,authenticated;
grant execute on function public.wc_admin_restore_config(uuid,bigint) to authenticated;

create or replace function public.wc_admin_save_page(p_slug text,p_title text,p_doc jsonb,p_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_rev bigint; v_kind text; v_allowed boolean;
begin
 if not private.site_control_admin() then raise exception 'Admin/owner only.';end if;
 if p_slug !~ '^[a-z][a-z0-9-]{1,55}$' or length(btrim(coalesce(p_title,''))) not between 2 and 100
 then raise exception 'Choose a valid page title and lowercase URL slug.';end if;
 perform private.wc_check_document(p_doc,'page');
 v_kind:=case when p_slug in ('home','about','personal-training','hmo','contact','membership','spa-recovery','gallery','app') then 'built_in' else 'custom' end;
 if v_kind='custom' and p_slug in ('join','blog','login','member','staff','portal','admin','management','reception','payment','privacy-policy','terms','facilities') then
   raise exception 'This URL slug is reserved.';end if;
 if v_kind='built_in' and coalesce(p_doc->>'mode','extend')='replace'
   and p_slug not in ('about','hmo','personal-training','app')
 then raise exception 'This page contains protected website functionality; use additional sections instead.';end if;
 if p_revision=0 and v_kind='custom' then
  insert into public.wc_pages(slug,title,kind,draft,revision,is_published)
  values(p_slug,btrim(p_title),'custom',p_doc,1,false)
  on conflict do nothing returning revision into v_rev;
 else
  update public.wc_pages
  set title=btrim(p_title),draft=p_doc,revision=revision+1,updated_at=now(),updated_by=auth.uid()
  where slug=p_slug and revision=p_revision returning revision into v_rev;
 end if;
 if v_rev is null then raise exception 'Page changed elsewhere or slug already exists. Reload.';end if;
 return jsonb_build_object('success',true,'revision',v_rev,'slug',p_slug);
end $$;
revoke all on function public.wc_admin_save_page(text,text,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.wc_admin_save_page(text,text,jsonb,bigint) to authenticated;

create or replace function public.wc_admin_publish_page(p_slug text,p_revision bigint,p_publish boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.wc_pages%rowtype; ver bigint;
begin
 if not private.site_control_admin() then raise exception 'Admin/owner only.';end if;
 select * into v from public.wc_pages where slug=p_slug for update;
 if v.slug is null or v.revision<>p_revision then raise exception 'Reload this page first.';end if;
 perform private.wc_check_document(v.draft,'page');
 ver:=v.published_revision+1;
 update public.wc_pages set published=draft,published_revision=ver,is_published=p_publish where slug=p_slug;
 insert into public.wc_page_versions(slug,version,title,snapshot,created_by)
 values(p_slug,ver,v.title,v.draft,auth.uid());
 return jsonb_build_object('success',true,'version',ver,'is_published',p_publish);
end $$;
revoke all on function public.wc_admin_publish_page(text,bigint,boolean) from public,anon,authenticated;
grant execute on function public.wc_admin_publish_page(text,bigint,boolean) to authenticated;

create or replace function public.wc_admin_restore_page(p_version_id uuid,p_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.wc_page_versions%rowtype; rev bigint;
begin
 if not private.site_control_admin() then raise exception 'Admin/owner only.';end if;
 select * into v from public.wc_page_versions where id=p_version_id;
 if v.id is null then raise exception 'Version not found.';end if;
 update public.wc_pages
 set draft=v.snapshot,title=v.title,revision=revision+1,updated_at=now(),updated_by=auth.uid()
 where slug=v.slug and revision=p_revision returning revision into rev;
 if rev is null then raise exception 'Reload before restoring.';end if;
 return jsonb_build_object('success',true,'revision',rev);
end $$;
revoke all on function public.wc_admin_restore_page(uuid,bigint) from public,anon,authenticated;
grant execute on function public.wc_admin_restore_page(uuid,bigint) to authenticated;
