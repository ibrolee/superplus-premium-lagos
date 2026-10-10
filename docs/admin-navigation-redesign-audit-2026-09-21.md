# Admin navigation redesign — audit and release gates (21 September 2026)

## Source and scope

Based on `main` at `689b8824a11c6bcd31c7a0d66c2c09fcf7dcc6b7`. This is a UI-only preview branch; no migration, data mutation, RLS modification, Paystack change or production merge is part of this work. The existing administration page and all existing routes remain present.

## Existing page/function inventory

| Existing entry | Functions preserved | Redesign approach |
| --- | --- | --- |
| `/portal/admin` | Dedicated admin sign-in and fixed-email/active-role check | Redirect authorised admin entry to `/admin-workspace`; authentication logic otherwise unchanged. |
| `/staff-admin` | Original revenue ledger, staff search, profile changes, account approvals/roles/status, salary records, daily staff attendance, strict-admin historical-member manager and logout | Retained intact for specialist functions and comparison; linked in navigation. Deep controls remain in its legacy expandable sections in this stage. |
| `/management-preview` and `/management-operations` | Existing reception/management read-only metrics and operations routing | Retained, accessible from the new navigation. |
| `/management-revenue` | Read-only management revenue, period/source filters, canonical baseline and exclusion safeguards | Linked from Finance and the dashboard. |
| `/management-payment-desk` | Existing-member payment requests, returning-member claims, manager approval | Link directly; no alteration to request/approval logic. |
| `/management-new-member-intake` | New offline member request, independent collection verification and atomic approval | Link directly; no alteration to payments, fee calculations or creation logic. |
| `/management-members`, `/management-profiles`, `/reception-member/$memberId` | Member directory, history, full protected member profile | Original preserved. `/admin-members` adds an admin-only simplified list with no overview cards and an explicit View Profile link to the protected original profile. |
| `/management-standard-plan`, `/management-custom-plan`, `/management-member-cards`, `/management-communications` | Registration/renewal redirects, custom plan, ID cards, birthday/expiry outreach | Existing destinations reused; no changes to their data writes. |
| `/management-attendance`, `/management-attendance-export`, `/reception-checkin` | Visit reports, export, live QR scan | Existing destinations reused. |
| `/management-staff`, `/management-staff-monthly`, `/management-payroll`, `/management-payroll-export`, `/staff-attendance` | Staff records, monthly attendance, salary ledger, payroll export, staff QR | Existing destinations reused. |
| `/staff-gallery`, `/staff-blog` | Website gallery and blog editing | Existing destinations reused. |

## New admin UX

- `/admin-workspace`: financial reporting comes first, then quick actions. It reads the existing `admin_revenue_baseline` and paginated `admin_revenue_rows` RPCs and counts **only** successful, non-excluded, non-historical-import rows at or after the database baseline, using Lagos calendar dates. It treats a failed revenue load as unavailable, not ₦0. It performs the management-role check before revenue RPC requests.
- `AdminWorkspaceShell`: six collapsible sections (Overview, Finance, Members, Attendance, Team & payroll, Website), responsive mobile menu and global keyword search for actions and existing members. Results link to protected original pages. Sidebar visibility is *not* authorization; individual route checks and database RLS remain authoritative. Historical-member shortcut is shown only for strict admin.
- `/admin-members`: straightforward read-only member directory, name/phone/email search, 25-row pagination and explicit **View Profile** links. No membership-overview statistic cards.

## Financial and privacy invariants

1. No changes to `payments`, `members`, `memberships`, financial SQL/RPC implementations, RLS policies, role tables, secret keys or production data.
2. Keep reception collections pending; approval is independent from the collector. A request number is not a receipt. Existing duplicate-reference and unique-pending-member safeguards remain authoritative.
3. Do not replay the one-time member reconciliation or publish identifiable reconciliation details.
4. Avoid testing new payment or member creation against production from a preview. Use a separate test database and Paystack test credentials for authenticated end-to-end coverage.
5. Member search queries read only data available to the current authorised manager; do not put a privileged Supabase key in the browser. Existing member profile route has its own access guard.

## Release verification checklist

- [ ] Vercel preview READY at the final branch SHA.
- [ ] GitHub CI: frozen Bun installation, Vite/SSR build, strict TypeScript and route-preservation checks succeed on PR.
- [ ] Desktop and narrow-mobile review: sidebar, group toggles, overlays, keyboard interaction, search results, finance-first order and member list pagination.
- [ ] Signed-in admin review: actual revenue matches existing report across today/month/baseline, with no false zero when data unavailable.
- [ ] Role matrix: admin, manager, owner, reception, staff and logged-out; especially historical-member controls and finance access.
- [ ] On a separate test database, verify request/approval workflows (including different approver, amount, duplicate references and retry), registration fee exceptions, and unchanged memberships/payment ledger.
- [ ] Owner explicitly approves the *preview* before merge or production release.

**Unfinished scope:** This stage provides a new admin entry, grouped links and two new dedicated pages but does not migrate all legacy staff/profile/attendance editing controls out of `/staff-admin` into their own redesigned pages or re-skin every already-existing management route. These changes require further bounded, regression-tested stages; do not report a full UX migration or fully tested finances before the corresponding checks are complete.
