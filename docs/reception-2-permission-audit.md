# Reception Dashboard 2.0 — permissions and release review

Reviewed on the integration branch on 19 September 2026. This is a **source-code inspection and implementation record**, supplemented by limited read-only database inspection. It is **not** an authenticated browser test or comprehensive RLS audit. Do not merge based solely on this document.

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
| Missed-scan decisions | `src/routes/staff-missed-scans.tsx` and `docs/sql/prevent-missed-scan-self-review.sql` | Frontend shows review controls to an active admin only. The self-review prevention migration was confirmed **already installed** in the correct Supabase project `sytcvezkryjcxwqdimuz` by read-only function-definition inspection on September 19. Do **not** reapply it. Earlier transactionally rolled-back impersonation tests reportedly passed; signed-in browser checks are still outstanding. |

`src/components/reception/ReceptionRouteGate.tsx` is a **client-side route/component guard**. It does not change database privileges or protect direct Supabase API calls. Its checks are not a substitute for tested row-level security or RPC authorisation. Original scanner and profile components still contain their older checks; the shared route guard blocks them before mounting in the current root layout.

## Preview and backups — September 19 update

- Exact integration commit `f1a331ed16ee106de778a7e72562b690cf20d201` passed immutable dependency installation, application build, strict TypeScript and source-integrity checks in GitHub Actions run `35439740118`.
- Vercel preview deployment `dpl_HV6u3U5tZrkNozj51Z5ewGTNdCgg` was READY but returned HTTP 500 at runtime: `Missing VITE_SUPABASE_URL`. A settings screenshot showed both Supabase `VITE_` variables assigned to **Production only**, explaining the Preview failure. The owner subsequently reported adding Preview scope for both and redeploying; **verify a new deployment from the integration branch and actual HTTP responses before calling the issue fixed**. The immediately observed redeployment `dpl_GiqX9mb4yk1VCqzcMcKzqLjowXK9` used `main`, not the integration commit.
- Private backup artifact `10582536743` exists as of this review, created September 19 at 10:23 UTC with expiration September 20 at 10:23 UTC. Durable storage and an independent restore test are **not verified**; no further database migration or data mutation is authorized by this audit.

## Required sign-off tests — NOT YET RUN as authenticated browser flows

1. Signed out: receptionist workspace denies; legacy scanner still shows its own login form; direct `/reception-dashboard` and `/reception-member/<actual id>` deny.
2. Approved active receptionist: registration/renewal, Custom Plan, search, exact member profile and scanner all open; revenue, salary and missed-scan approval deny even when URLs are entered directly.
3. Approved active admin: reception tools and management reports open; administrators cannot approve or reject their own missed-scan requests. Migration is installed; do not reapply.
4. Active regular staff/trainer, suspended and inactive account: direct scanner/dashboard/member-profile paths deny; management finance pages deny.
5. Supabase RLS and RPC: replay the member, attendance, payment, revenue, salary and missed-scan requests using each role's real authenticated token. A hidden link or browser guard is not sufficient evidence of denied access.
6. Build, navigation, and regression: run project build and TypeScript checks against the final exact commit, test scanner's embedded login/logout and camera flow, registration/renewal and payment confirmation with **non-production test fixtures**, and verify Vercel preview HTTP responses and client behavior.

**Release gate:** No merge or production deployment, no live fake payments, attendance/payroll edits or additional production database changes until backups and the relevant checks succeed and the owner explicitly approves the merge. Preserve historical member, payment, attendance and salary records.
