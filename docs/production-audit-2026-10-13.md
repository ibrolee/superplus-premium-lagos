# Super Plus Fitness — production audit (13 October 2026)

## Scope and safeguards
Reviewed source repository `ibrolee/superplus-premium-lagos`, Vercel production metadata/runtime errors, and **read-only** Supabase schema/advisors and aggregate checks. This branch is for review; **no production database rows, business rules, or production deployment were changed**. Operational staff/member data are not embedded here.

## Confirmed observations
| Area | Evidence | Assessment/action |
| --- | --- | --- |
| Production | Vercel production `dpl_4zip2xH6aV68Zt29Xqk7uyPqRGbu`, source `f6e1b12`, state READY | Deploy is ready; runtime error summary reported no errors in 7-day lookback. That does not prove all client workflows work. |
| Memberships | 501 membership rows, 351 member rows | Record counts alone do not validate renewals, dates or payment reconciliation. |
| PT assignment | 25 PT assignments; zero duplicate assignment keys or orphaned references. **Four paid PT cycles overlap Oct 1–13 without an assignment** | Review these four in the PT management dashboard before payout. Do **not** auto-assign a coach. |
| PT commission | `calculatePtPayout` reserved commissions using **all** previous payout snapshots, including unlocked unpaid drafts | Fixed to reserve memberships from **paid or financially locked** runs only. The 3+ trainee threshold, 50/30/20 and ₦10,000 low-volume commission remain unchanged. |
| Salary | Admin salary page fell back to net `record.amount` when `gross_salary_amount` was null, while monthly finance report added salary-advance deductions | Shared `grossSalaryFromRecord` helper now reconstructs gross identically in both pages. No salary value or payroll row was changed. |
| Finance | 20 expense rows; none before October 2026 or at nonpositive amount | Dates and basic data check pass; bank settlement and revenue completeness require authorized end-to-end testing. |
| Attendance | 110 staff attendance records; 11 open sessions, 7 from before Oct 13, 2026; zero negative-duration completed sessions | Prior-day open sessions require management review, NOT invented auto clock-outs. Existing display rules do not alter records. |
| Security | Supabase advisor flags missing RLS for `public.fitness_verified_collection_refs` | Verified `anon` and `authenticated` lack SELECT/INSERT/UPDATE/DELETE grants on table at audit time. **No automatic RLS change**: assess service functions, define policies, test before applying. |
| Security | Advisor flags 19 anonymous-callable SECURITY DEFINER functions, 68 authenticated-callable SECURITY DEFINER functions, 2 mutable search paths, leaked-password protection warning | Review individual function grants, internal auth checks and trigger usage, then restrict only safe-to-restrict functions. Do not bulk revoke or assume advisory proves exploitation. |
| Performance | Supabase advisor identified multiple unindexed foreign keys | Profile important query paths before indexing. |
| Mobile | Responsive styles/routes exist; current authenticated portal interaction was not exercised with real small-screen browsers | Real device inspection still required for registration, scanning, payroll filters and admin screens. |

## Regressions included in this branch
1. An **unpaid/unlocked** PT payout draft cannot suppress payment eligibility in another period.
2. A **paid or financially locked** PT payout snapshot still prevents double commission.
3. Old salary rows without `gross_salary_amount` reconstruct gross from net and advance deduction, matching finance and salary pages.
4. Pull-request CI now includes the PT payout and monthly finance unit tests, in addition to existing integration checks.

## Business rules intentionally retained
- Paid PT memberships count when their dates overlap the selected payout period; cancelled/paused/unpaid memberships are excluded.
- In-house coaches with **three or more trainees** participate in the 50/30/20 pool; low-volume coaches receive ₦10,000 per payable trainee, and part-time coach accounting remains separate.
- Commission periods run 1st–15th and 16th–month end, paid on 16th and 1st respectively.
- Salaries are monthly, with salary advances deducted from net pay but not from gross operating costs.
- Expense reporting starts October 2026, and date handling remains Lagos-local.

## Before merging or deploying
- Confirm CI regression tests, static type check, and production-equivalent build pass.
- Inspect changed files and Vercel preview, especially admin salary and commission screens.
- Run authenticated permission tests using disposable staff/member accounts for access controls and enrollment; never run tests that create actual gym payments.
- Review older unclosed staff attendance records with management; do not bulk-close scans.
- Perform a separate RLS/RPC hardening review and database backup before migrations.
- Test responsive layouts on an actual narrow iPhone and tablet viewport and verify keyboard, horizontal overflow, and QR scanner camera access.
- Check production release logs and service availability after approved deployment.

## Rollback
PR contains application-only changes; revert the merged commit if payroll/commission display regresses. Do not erase paid payout snapshots or alter financial history.