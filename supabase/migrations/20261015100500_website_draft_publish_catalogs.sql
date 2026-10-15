
-- Draft/publish/versioned controls for website content and spa/booking catalogues.
-- Published settings are exposed through a curated read-only function; drafts are private.
create table public.website_settings (
  setting_key text primary key check(setting_key in ('homepage','business','spa_services','booking','membership_display','website_content')),
  draft jsonb not null default '{}'::jsonb,
  published jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  published_revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  published_at timestamptz not null default now(),
  published_by uuid,
  constraint website_settings_doc_sizes check (
    pg_column_size(draft) <= 40000 and pg_column_size(published) <= 40000
  )
);
alter table public.website_settings enable row level security;
revoke all on public.website_settings from public,anon,authenticated;
grant select on public.website_settings to authenticated;
create policy website_settings_management_read on public.website_settings
for select to authenticated using(private.site_control_admin());

create table public.website_settings_history (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null references public.website_settings(setting_key),
  version bigint not null,
  snapshot jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid,
  unique(setting_key,version)
);
alter table public.website_settings_history enable row level security;
revoke all on public.website_settings_history from public,anon,authenticated;
grant select on public.website_settings_history to authenticated;
create policy website_settings_history_admin_read on public.website_settings_history
for select to authenticated using(private.site_control_admin());

insert into public.website_settings(setting_key,draft,published) values
('homepage',
  '{"title":"Build stronger.","highlight":"Live better.","subtitle":"Modern fitness, personal training, spa and recovery — all under one roof in Shomolu, Lagos.","image":"","announcement":"","announcement_enabled":false}'::jsonb,
  '{"title":"Build stronger.","highlight":"Live better.","subtitle":"Modern fitness, personal training, spa and recovery — all under one roof in Shomolu, Lagos.","image":"","announcement":"","announcement_enabled":false}'::jsonb),
('business',
  '{"phone":"07054263170","email":"spfitnessandspa@gmail.com","address":"No. 105 Apata Street, Shomolu, Lagos, Nigeria","whatsapp":"+2347054263170","mon_sat_hours":"6:00 AM – 8:30 PM","sun_hours":"6:30 AM – 7:00 PM","instagram":"https://www.instagram.com/superplusfitnessandspa/"}'::jsonb,
  '{"phone":"07054263170","email":"spfitnessandspa@gmail.com","address":"No. 105 Apata Street, Shomolu, Lagos, Nigeria","whatsapp":"+2347054263170","mon_sat_hours":"6:00 AM – 8:30 PM","sun_hours":"6:30 AM – 7:00 PM","instagram":"https://www.instagram.com/superplusfitnessandspa/"}'::jsonb),
('booking',
  '{"mon_sat_open":"06:00","mon_sat_close":"20:30","sun_open":"06:30","sun_close":"19:00","slot_minutes":30,"max_concurrent":3,"lead_hours":1,"advance_days":90}'::jsonb,
  '{"mon_sat_open":"06:00","mon_sat_close":"20:30","sun_open":"06:30","sun_close":"19:00","slot_minutes":30,"max_concurrent":3,"lead_hours":1,"advance_days":90}'::jsonb),
('membership_display',
  '{"registration_individual":7000,"registration_family":20000,"plans":{}}'::jsonb,
  '{"registration_individual":7000,"registration_family":20000,"plans":{}}'::jsonb),
('website_content',
  '{"faq":[{"question":"Do I need to register first?","answer":"New members pay a one-time registration fee when joining. Existing registered members do not register again."},{"question":"Can I book spa services without a gym membership?","answer":"Yes. Choose a spa service, pay online and await confirmation of your preferred appointment."}],"rules":["Use equipment responsibly and return weights after use.","Respect other members and staff.","Wear appropriate training shoes."]}'::jsonb,
  '{"faq":[{"question":"Do I need to register first?","answer":"New members pay a one-time registration fee when joining. Existing registered members do not register again."},{"question":"Can I book spa services without a gym membership?","answer":"Yes. Choose a spa service, pay online and await confirmation of your preferred appointment."}],"rules":["Use equipment responsibly and return weights after use.","Respect other members and staff.","Wear appropriate training shoes."]}'::jsonb),
('spa_services',
 jsonb_build_object('items',jsonb_build_array(
  jsonb_build_object('id','vip-chair','name','VIP Chair','description','A dedicated relaxation and wellness session.','price',7000,'duration_minutes',60,'active',true,'image',''),
  jsonb_build_object('id','ultra-slim-machine','name','Ultra Slim Machine','description','A focused wellness session using our Ultra Slim machine.','price',5000,'duration_minutes',30,'active',true,'image',''),
  jsonb_build_object('id','blood-circulation-machine','name','Blood Circulation Machine','description','A wellness session using our blood circulation machine.','price',5000,'duration_minutes',30,'active',true,'image',''),
  jsonb_build_object('id','foot-massager','name','Foot Massager','description','A dedicated foot relaxation and recovery session.','price',5000,'duration_minutes',30,'active',true,'image',''),
  jsonb_build_object('id','pulse-massager','name','Pulse Massager','description','A focused massage session using our pulse massager.','price',7000,'duration_minutes',30,'active',true,'image',''),
  jsonb_build_object('id','detox-machine','name','Detox Machine','description','A wellness session using our detox machine.','price',7000,'duration_minutes',30,'active',true,'image',''),
  jsonb_build_object('id','full-body-massage','name','Full Body Massage','description','A full-body massage session.','price',15000,'duration_minutes',30,'active',true,'image',''),
  jsonb_build_object('id','quantum-therapy','name','Quantum Therapy','description','A dedicated quantum therapy session.','price',7000,'duration_minutes',30,'active',true,'image',''),
  jsonb_build_object('id','pedicure','name','Pedicure','description','Professional pedicure service.','price',10000,'duration_minutes',30,'active',true,'image','')
 )),
 jsonb_build_object('items',jsonb_build_array(
  jsonb_build_object('id','vip-chair','name','VIP Chair','description','A dedicated relaxation and wellness session.','price',7000,'duration_minutes',60,'active',true,'image',''),
  jsonb_build_object('id','ultra-slim-machine','name','Ultra Slim Machine','description','A focused wellness session using our Ultra Slim machine.','price',5000,'duration_minutes',30,'active',true,'image',''),
  jsonb_build_object('id','blood-circulation-machine','name','Blood Circulation Machine','description','A wellness session using our blood circulation machine.','price',5000,'duration_minutes',30,'active',true,'image',''),
  jsonb_build_object('id','foot-massager','name','Foot Massager','description','A dedicated foot relaxation and recovery session.','price',5000,'duration_minutes',30,'active',true,'image',''),
  jsonb_build_object('id','pulse-massager','name','Pulse Massager','description','A focused massage session using our pulse massager.','price',7000,'duration_minutes',30,'active',true,'image',''),
  jsonb_build_object('id','detox-machine','name','Detox Machine','description','A wellness session using our detox machine.','price',7000,'duration_minutes',30,'active',true,'image',''),
  jsonb_build_object('id','full-body-massage','name','Full Body Massage','description','A full-body massage session.','price',15000,'duration_minutes',30,'active',true,'image',''),
  jsonb_build_object('id','quantum-therapy','name','Quantum Therapy','description','A dedicated quantum therapy session.','price',7000,'duration_minutes',30,'active',true,'image',''),
  jsonb_build_object('id','pedicure','name','Pedicure','description','Professional pedicure service.','price',10000,'duration_minutes',30,'active',true,'image','')
 )))
on conflict (setting_key) do nothing;

insert into public.website_settings_history(setting_key,version,snapshot)
select setting_key,1,published from public.website_settings on conflict do nothing;

-- Public never reads private drafts.
create or replace function public.website_published_setting(p_key text)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select published from public.website_settings
   where setting_key=p_key and p_key in ('homepage','business','spa_services','booking','membership_display','website_content')),'{}'::jsonb)
$$;
revoke all on function public.website_published_setting(text) from public,anon,authenticated;
grant execute on function public.website_published_setting(text) to anon,authenticated,service_role;

create or replace function private.validate_website_setting(p_key text,p_value jsonb)
returns void language plpgsql set search_path='' as $$
declare x jsonb; v_ids text[]:=array[]::text[];
begin
 if jsonb_typeof(p_value) <> 'object' or pg_column_size(p_value)>40000 then
   raise exception 'Settings must be a small JSON object.'; end if;
 if p_key='spa_services' then
   if jsonb_typeof(p_value->'items')<>'array' or jsonb_array_length(p_value->'items')>40 then
     raise exception 'Spa services must be a list of at most 40 services.'; end if;
   for x in select value from jsonb_array_elements(p_value->'items') loop
     if coalesce(x->>'id','') !~ '^[a-z0-9-]{2,60}$'
       or length(btrim(coalesce(x->>'name',''))) not between 2 and 100
       or length(coalesce(x->>'description',''))>750
       or not ((x->>'price') ~ '^[0-9]{1,8}(\\.[0-9]{1,2})?$')
       or (x->>'price')::numeric<100
       or (x->>'duration_minutes') not in ('15','30','45','60','75','90','120','150','180','240')
       or (x->>'active') not in ('true','false')
       or length(coalesce(x->>'image',''))>800
       or (coalesce(x->>'image','')<>'' and coalesce(x->>'image','') !~ '^https://')
     then raise exception 'Invalid spa service name, price, duration, image URL or status.'; end if;
     if x->>'id'=any(v_ids) then raise exception 'Duplicate spa service ID.';end if;
     v_ids:=array_append(v_ids,x->>'id');
   end loop;
 elsif p_key='booking' then
   if coalesce(p_value->>'mon_sat_open','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or coalesce(p_value->>'mon_sat_close','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or coalesce(p_value->>'sun_open','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or coalesce(p_value->>'sun_close','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or p_value->>'mon_sat_open'>=p_value->>'mon_sat_close'
    or p_value->>'sun_open'>=p_value->>'sun_close'
    or coalesce(p_value->>'slot_minutes','') not in ('15','30','60')
    or (p_value->>'max_concurrent') not in ('1','2','3','4','5','6','7','8','9','10')
    or (p_value->>'lead_hours') not in ('0','1','2','3','4','6','12','24','48')
    or (p_value->>'advance_days') not in ('7','14','30','60','90')
   then raise exception 'Invalid booking hours or capacity options.'; end if;
 elsif p_key='homepage' then
   if length(coalesce(p_value->>'title','')) not between 2 and 110
     or length(coalesce(p_value->>'highlight','')) not between 2 and 110
     or length(coalesce(p_value->>'subtitle',''))>450
     or length(coalesce(p_value->>'announcement',''))>280
     or (coalesce(p_value->>'image','')<>'' and coalesce(p_value->>'image','') !~ '^https://')
     or length(coalesce(p_value->>'image',''))>800
   then raise exception 'Homepage content has invalid title or image URL.'; end if;
 elsif p_key='business' then
   if length(coalesce(p_value->>'phone','')) not between 5 and 25
    or length(coalesce(p_value->>'email','')) not between 6 and 150
    or coalesce(p_value->>'email','') not like '%@%.%'
    or length(coalesce(p_value->>'address','')) not between 5 and 400
    or coalesce(p_value->>'whatsapp','') !~ '^\\+?[0-9]{10,16}$'
    or length(coalesce(p_value->>'mon_sat_hours',''))>80
    or length(coalesce(p_value->>'sun_hours',''))>80
   then raise exception 'Contact information must include valid phone, email, address and hours.'; end if;
 elsif p_key='website_content' then
   if jsonb_typeof(p_value->'faq')<>'array' or jsonb_array_length(p_value->'faq')>35
    or jsonb_typeof(p_value->'rules')<>'array' or jsonb_array_length(p_value->'rules')>35 then
     raise exception 'FAQ and gym rules must be arrays with at most 35 items.'; end if;
   for x in select value from jsonb_array_elements(p_value->'faq') loop
     if length(coalesce(x->>'question','')) not between 2 and 220
       or length(coalesce(x->>'answer','')) not between 2 and 1300
     then raise exception 'Invalid FAQ question or answer.'; end if;
   end loop;
   for x in select value from jsonb_array_elements(p_value->'rules') loop
     if jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 3 and 350
     then raise exception 'Invalid gym rule.'; end if;
   end loop;
 elsif p_key='membership_display' then
   if jsonb_typeof(p_value->'plans')<>'object'
     or (p_value->>'registration_individual') not in ('7000')
     or (p_value->>'registration_family') not in ('20000')
   then raise exception 'Registration fees are currently fixed while checkout integrations are being verified.';end if;
 else raise exception 'Unknown website setting key.'; end if;
end $$;
revoke all on function private.validate_website_setting(text,jsonb) from public,anon,authenticated;

create or replace function public.admin_website_save_draft(p_key text,p_value jsonb,p_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_revision bigint;
begin
 if not private.site_control_admin() then raise exception 'Admin/owner only.'; end if;
 perform private.validate_website_setting(p_key,p_value);
 update public.website_settings
 set draft=p_value,revision=revision+1,updated_at=now(),updated_by=auth.uid()
 where setting_key=p_key and revision=p_revision
 returning revision into v_revision;
 if v_revision is null then raise exception 'Settings were changed by someone else. Reload before saving.';end if;
 return jsonb_build_object('revision',v_revision,'success',true);
end $$;
revoke all on function public.admin_website_save_draft(text,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.admin_website_save_draft(text,jsonb,bigint) to authenticated;

create or replace function public.admin_website_publish(p_key text,p_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.website_settings%rowtype; v_next bigint;
begin
 if not private.site_control_admin() then raise exception 'Admin/owner only.'; end if;
 select * into v from public.website_settings where setting_key=p_key for update;
 if v.setting_key is null or v.revision<>p_revision then raise exception 'Settings have changed. Refresh and retry.';end if;
 perform private.validate_website_setting(p_key,v.draft);
 v_next:=v.published_revision+1;
 update public.website_settings set published=draft,published_revision=v_next,published_at=now(),published_by=auth.uid()
 where setting_key=p_key;
 insert into public.website_settings_history(setting_key,version,snapshot,published_by)
 values(p_key,v_next,v.draft,auth.uid());
 insert into public.website_control_audit(changed_by,kind,record_key,previous_value,next_value)
 values(auth.uid(),'website_publish',p_key,v.published,v.draft);
 return jsonb_build_object('success',true,'published_revision',v_next);
end $$;
revoke all on function public.admin_website_publish(text,bigint) from public,anon,authenticated;
grant execute on function public.admin_website_publish(text,bigint) to authenticated;

create or replace function public.admin_website_restore(p_history_id uuid,p_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.website_settings_history%rowtype; v_revision bigint;
begin
 if not private.site_control_admin() then raise exception 'Admin/owner only.'; end if;
 select * into h from public.website_settings_history where id=p_history_id;
 if h.id is null then raise exception 'Version was not found.';end if;
 perform private.validate_website_setting(h.setting_key,h.snapshot);
 update public.website_settings
 set draft=h.snapshot,revision=revision+1,updated_at=now(),updated_by=auth.uid()
 where setting_key=h.setting_key and revision=p_revision
 returning revision into v_revision;
 if v_revision is null then raise exception 'The draft was changed elsewhere. Refresh and retry.';end if;
 return jsonb_build_object('success',true,'revision',v_revision,'setting_key',h.setting_key);
end $$;
revoke all on function public.admin_website_restore(uuid,bigint) from public,anon,authenticated;
grant execute on function public.admin_website_restore(uuid,bigint) to authenticated;
