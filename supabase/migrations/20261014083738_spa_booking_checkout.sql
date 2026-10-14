create table public.spa_bookings (
 id uuid primary key default gen_random_uuid(),
 reference text not null unique,
 service_id text not null,
 service_name text not null,
 preferred_staff text check (preferred_staff in ('Salma','James','Chinedu')),
 amount numeric not null check (amount > 0),
 full_name text not null check (char_length(full_name) between 2 and 120),
 email text not null check (char_length(email) <= 254),
 phone text not null check (char_length(phone) between 7 and 30),
 preferred_at timestamptz not null,
 notes text not null default '' check (char_length(notes)<=1000),
 status text not null default 'pending' check (status in ('pending','confirmed','completed','declined','cancelled')),
 staff_note text check (char_length(staff_note)<=1000),
 payment_id uuid unique references public.payments(id),
 paid_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.spa_bookings enable row level security;
revoke all on public.spa_bookings from anon, authenticated;
grant select on public.spa_bookings to authenticated;
grant update (status,staff_note,updated_at) on public.spa_bookings to authenticated;
grant all on public.spa_bookings to service_role;
create policy "Staff view spa bookings" on public.spa_bookings for select to authenticated using (public.is_staff());
create policy "Staff manage spa appointments" on public.spa_bookings for update to authenticated using (public.is_staff() and payment_id is not null) with check (public.is_staff() and payment_id is not null);
create index spa_bookings_paid_status_idx on public.spa_bookings(status,preferred_at) where payment_id is not null;

-- Only the trusted payment verifier calls this. Lock the booking so webhook and callback
-- retries record exactly one payment, atomically with its booking.
create function public.finalize_spa_payment(p_reference text,p_amount_kobo bigint,p_paid_at timestamptz,p_channel text)
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
 return jsonb_build_object('success',true,'reference',b.reference,'service_name',b.service_name,'amount',b.amount,'preferred_at',b.preferred_at,'status',b.status,'preferred_staff',b.preferred_staff);
end $$;
revoke all on function public.finalize_spa_payment(text,bigint,timestamptz,text) from public,anon,authenticated;
grant execute on function public.finalize_spa_payment(text,bigint,timestamptz,text) to service_role;
