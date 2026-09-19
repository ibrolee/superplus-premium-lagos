# Missed-scan reporting: database and rollout

This feature must use the existing Supabase project configured by `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `src/lib/supabase.ts`. A connected Neon project is **not** evidence that the gym uses Neon; do not migrate or write gym data there.

## Required database setup (before enabling UI)

Create a dedicated `staff_missed_scan_requests` table in the existing Supabase project, with a UUID primary key, `staff_profile_id` referencing `staff_profiles(id)`, work date, kind (`clock_in`, `clock_out`, `both`), approximate times, reason, status (`pending`, `approved`, `rejected`), creation time, review time, reviewer auth ID and review note. Keep original QR scans in `staff_attendance` unchanged. A request is not proof of work and must never change salary automatically.

**Security gate:** Inspect the actual Supabase schema, `staff_profiles.auth_user_id`, `staff_users` role/active definitions and current RLS policies first. Use database-side authorization for staff to insert/read only their own requests and for active management to read/review all. Prevent staff from setting their own status/reviewer or changing submitted records; prevent unauthenticated access. Ensure decisions are auditable (immutable decision record or separate history). Validate work date in Lagos, times, reason length and duplicate requests server-side. Do not trust client-supplied staff IDs or roles. Verify table grants and RLS with two staff accounts and a manager before rollout.

## Deployment gate

There is no checked-in `supabase/` migration directory on `main`. Locate the existing Supabase migration/deployment process and confirm project identity before applying any SQL. Back up schema and define rollback. Build frontend on its own feature branch, keep PR #18 separate, verify final-head preview and signed-in workflows before merging. No overnight-shift workflow. Do not claim this document implements a working submission system.
