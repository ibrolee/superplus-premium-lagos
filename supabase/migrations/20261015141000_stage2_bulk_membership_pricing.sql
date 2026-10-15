-- Bulk pricing is atomic and uses the same protected official membership plan records
-- as the existing single-price editor. It cannot change registration fees or durations.
create or replace function public.admin_site_bulk_update_prices(p_updates jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb; v_id uuid; v_price numeric; v_old public.membership_plans%rowtype;
 v_count integer:=0; v_ids uuid[]:=array[]::uuid[];
begin
 if not private.site_control_admin() then raise exception 'Admin or owner only.';end if;
 if jsonb_typeof(p_updates)<>'array' or jsonb_array_length(p_updates) not between 1 and 20
 then raise exception 'Select 1–20 membership plans.';end if;
 for item in select value from jsonb_array_elements(p_updates) loop
  if coalesce(item->>'id','') !~ '^[0-9a-f-]{36}$' or coalesce(item->>'price','') !~ '^[0-9]{1,9}([.][0-9]{1,2})?$'
  then raise exception 'Each plan requires a valid ID and monetary amount.';end if;
  v_id:=(item->>'id')::uuid;v_price:=(item->>'price')::numeric;
  if v_id=any(v_ids) then raise exception 'A plan was submitted twice.';end if;
  v_ids:=array_append(v_ids,v_id);
  if v_price<100 or v_price>100000000 then raise exception 'Price must be between ₦100 and ₦100,000,000.';end if;
  select * into v_old from public.membership_plans where id=v_id for update;
  if v_old.id is null or v_old.name='Custom Plan' or v_old.duration_days is null
  then raise exception 'An unsupported plan was selected.';end if;
  if v_old.price is distinct from v_price then
   update public.membership_plans set price=v_price,updated_at=now() where id=v_id;
   insert into public.website_control_audit(changed_by,kind,record_key,previous_value,next_value)
   values(auth.uid(),'membership_price',v_old.name,jsonb_build_object('price',v_old.price),jsonb_build_object('price',v_price));
   v_count:=v_count+1;
  end if;
 end loop;
 return jsonb_build_object('updated',v_count);
end $$;
revoke all on function public.admin_site_bulk_update_prices(jsonb) from public,anon,authenticated;
grant execute on function public.admin_site_bulk_update_prices(jsonb) to authenticated;
