alter table public.spa_bookings rename column preferred_staff to assigned_staff;
grant update (assigned_staff) on public.spa_bookings to authenticated;
create or replace function public.finalize_spa_payment(p_reference text,p_amount_kobo bigint,p_paid_at timestamptz,p_channel text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare b public.spa_bookings; payment uuid;
begin
 select * into b from public.spa_bookings where reference=p_reference for update;
 if not found then raise exception 'Booking not found'; end if;
 if p_amount_kobo <> b.amount*100 or p_paid_at is null then raise exception 'Payment does not match booking'; end if;
 if b.payment_id is null then
  insert into public.payments(amount,currency,status,payment_method,provider,paystack_reference,paid_at,source,metadata)
  values (b.amount,'NGN','success',p_channel,'paystack',p_reference,p_paid_at,'spa_booking',
   jsonb_build_object('record_type','spa_booking','spa_booking_id',b.id,'service_id',b.service_id,'plan_name',b.service_name,'full_name',b.full_name)) returning id into payment;
  update public.spa_bookings set payment_id=payment,paid_at=p_paid_at,updated_at=now() where id=b.id;
 end if;
 return jsonb_build_object('success',true,'reference',b.reference,'service_name',b.service_name,'amount',b.amount,'preferred_at',b.preferred_at,'status',b.status,'assigned_staff',b.assigned_staff);
end $$;
revoke all on function public.finalize_spa_payment(text,bigint,timestamptz,text) from public,anon,authenticated;
grant execute on function public.finalize_spa_payment(text,bigint,timestamptz,text) to service_role;
