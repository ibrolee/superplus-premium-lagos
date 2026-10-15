-- Permit safe video source blocks in published pages.
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
   if coalesce(item->>'type','') not in ('hero','text','image','split','cta','quote','video')
      or length(coalesce(item->>'heading',''))>180 or length(coalesce(item->>'body',''))>4500
      or length(coalesce(item->>'image',''))>850
      or length(coalesce(item->>'button_label',''))>70
      or coalesce(item->>'image','') ~* '^(javascript|data):' then
      raise exception 'Invalid page section.';
   end if;
   link:=coalesce(item->>'button_href','');
   if length(link)>350 or (link<>'' and link<>'/' and link !~ '^(/[^/]|https://)') then
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
