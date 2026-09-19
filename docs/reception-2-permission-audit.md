# Reception Dashboard 2.0 — permissions review

Reviewed on the integration branch on 19 September 2026. This is a **source-code inspection and implementation record**, not an authenticated browser test or a verified Supabase RLS audit. Do not merge based solely on this document.

## Intended roles

- Active `reception`, `admin`, `owner`, or `manager`: reception workspace, registration and renewals, Custom Plans, member directory and profiles, and member QR scanner.
- Active `admin`, `owner`, or `manager` only: revenue and salary reports.
- Active `admin` only: the missed-scan approval/rejection RPC and review controls (separate from read-only staff QR exception review).
- Other staff or unauthenticated visitors: no receptionist member-record pages. Signed-out visitors may still see the legacy scanner login form, which is required for that existing workflow.

## Inspected code and changes

| Feature | Implementation | Source finding |
| --- | --- | --- |
| Reception 2.0 | `src/routes/reception-workspace.tsx` | Checks `staff_users.active` and the four approved roles before reading members or plans. Revenue shortcut is management-only. No writes. |
| New registration and renewal | `src/routes/management-standard-plan.tsx` | Checks four reception/management roles before form access; retains existing payment confirmation and transactional RPC. |
| Custom Plan | `src/routes/management-custom-plan.tsx` | Checks four reception/management roles before member search and payment form. |
| Member directory | `src/routes/management-members.tsx` | Checks four roles before loading member and membership records; links to individual member profiles. |
| Other member profiles | `src/routes/management-profiles.tsx` | Checks four roles before member search and profile reads. |
| Existing reception dashboard | `src/routes/reception-dashboard.tsx` | Its own original check accepts any active staff. The new `ReceptionRouteGate` checks the four roles **before this page mounts**; the original registration and payment handlers were not changed. |
| Individual member profile | `src/routes/reception-member.$memberId.tsx` | Its original check accepts any active staff. `ReceptionRouteGate` prevents this page and its member/payment queries from mounting for unauthorised roles. |
| Member QR scanner | `src/routes/reception-checkin.tsx` | Original check accepts any active staff. `ReceptionRouteGate` checks the four reception roles before mounting the scanner for signed-in users while keeping the original login form for signed-out users. |
| Revenue | `src/routes/management-revenue.tsx` | Checks management-only roles before loading revenue rows. Reception 2.0 also hides its revenue shortcut for the receptionist role. |
| Salary records | `src/routes/management-payroll.tsx` | Checks management-only roles before fetching salary records. Reception 2.0 has no payroll link. |
| Staff action search | `src/components/management/ActionSearch.tsx` | Adds Reception 2.0, shows reception actions to four authorised roles, hides financial actions from non-management and shows the missed-scan review action only to admins. |
| Missed-scan decisions | `src/routes/staff-missed-scans.tsx` and `docs/sql/prevent-missed-scan-self-review.sql` | Frontend shows review controls to an active admin only. Self-review prevention SQL is **committed but not applied**; live DB still requires migration and testing after verified backup. |

`src/components/reception/ReceptionRouteGate.tsx` is a **client-side route/component guard**. It does not change database privileges or protect direct Supabase API calls. Its checks are not a substitute for tested row-level security or RPC authorisation. Original scanner and profile components still contain their older checks; the shared route guard blocks them before mounting in the current root layout.

## Required sign-off tests — NOT YET RUN

1. Signed out: receptionist workspace denies; legacy scanner still shows its own login form; direct `/reception-dashboard` and `/reception-member/<actual id>` deny.
2. Approved active receptionist: registration/renewal, Custom Plan, search, exact member profile and scanner all open; revenue, salary and missed-scan approval deny even when URLs are entered directly.
3. Approved active admin: reception tools and management reports open; unrelated administrators cannot approve their own missed-scan requests once SQL is applied.
4. Active regular staff/trainer, suspended and inactive account: direct scanner/dashboard/member-profile paths deny; management finance pages deny.
5. Supabase RLS and RPC: replay the member, attendance, payment, revenue, salary and missed-scan requests using each role's real authenticated token. A hidden link or browser guard is not sufficient evidence of denied access.
6. Build, navigation, and regression: run project build and TypeScript checks, test scanner's embedded login/logout and camera flow, registration/renewal and payment confirmation with **non-production test fixtures**, and verify the Vercel preview for the exact final integration HEAD.

**Release gate:** No merge, deployment, live fake payments, attendance/payroll edits or production database migration until backups and the relevant checks succeed. Preserve historical member, payment, attendance and salary records.
