-- Authenticated portal users may invoke the private boolean role predicate from
-- row-level security policies. The predicate remains outside exposed API schemas.
-- It returns TRUE only for an active admin or owner, and never returns settings.
grant execute on function private.site_control_admin() to authenticated;
revoke execute on function private.site_control_admin() from anon, public;

-- Keep drafts and publish history strictly admin/owner-scoped.
-- RLS SELECT policies already call private.site_control_admin().
comment on function private.site_control_admin()
  is 'Private active admin/owner access predicate used by website settings RLS. Authenticated may execute; anonymous may not.';
