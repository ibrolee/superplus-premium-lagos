-- Accept an optional leading + in business WhatsApp numbers.
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
    or (length(coalesce(p_value->>'whatsapp','')) not between 10 and 17
         or length(translate(coalesce(p_value->>'whatsapp',''),'+0123456789',''))>0)
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
