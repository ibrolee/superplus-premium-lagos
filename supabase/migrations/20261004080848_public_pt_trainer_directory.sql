grant select on table public.pt_trainers to anon;

create policy "Public can view active PT trainers"
on public.pt_trainers for select
to anon
using (active is true);
