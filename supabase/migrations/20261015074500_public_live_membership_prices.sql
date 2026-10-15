-- Public visitors may read only published active plan price details.
-- Required by the Website Control Centre live pricing on home, join and membership.
-- The existing authenticated staff management policies remain unchanged.
grant select on public.membership_plans to anon;
create policy "Public can view active membership plans"
on public.membership_plans
for select to anon
using (active = true);
