# Missed-scan reporting: database rollout and acceptance gates

The gym website uses the existing Supabase project configured by `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `src/lib/supabase.ts`. Do not connect gym data to Neon.

## Database status (September 19, 2026)

The missed-scan migration has been applied to the gym Supabase project. Verified that `staff_missed_scan_requests` and `staff_missed_scan_decisions` exist, both have RLS enabled and a read policy, and the authenticated role has no direct INSERT, UPDATE or DELETE table grants. The security-definer RPCs `submit_staff_missed_scan` and `review_staff_missed_scan` are executable by authenticated users and enforce staff ownership or active admin access on the server. The migration did not modify `staff_attendance` or salary records.

The checked-in `docs/sql/staff-missed-scan-requests.sql` is the original draft. Its manager function allows admin/owner/manager roles, while the actually applied migration currently authorizes **active admin only**. Treat the live database as authoritative; reconcile the SQL file with a verified migration before replaying it anywhere else.

## Before release

Test with distinct authenticated staff A, staff B, and admin accounts: staff-only own submission/history; cross-staff read blocked; admin review works; staff cannot self-review; duplicate pending requests rejected; second review rejected; decisions auditable; no fabricated QR scans or automatic salary changes. Verify frontend compilation, route access, final integration branch preview and production release. No overnight-shift workflow. No automatic merge or deployment while checks are outstanding.
