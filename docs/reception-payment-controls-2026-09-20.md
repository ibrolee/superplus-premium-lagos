# Reception payment controls — September 20, 2026

## Deployment state

The production Supabase project `sytcvezkryjcxwqdimuz` received several incident/security migrations **before** the website PR was merged. These migration SQL statements are stored in the Supabase migration history (`supabase_migrations.schema_migrations.statements`); the exact applied source must be exported from there before attempting to reconstruct or replay a database. The repository file is an operational audit and rollout guide, not a substitute for an exported database migration. **Do not replay the one-time member reconciliation on another database.**

Applied migrations (verify version/name against the production `supabase_migrations.schema_migrations` table):

- `audit_member_payment_reconciliation_20260920`: one-time correction, audit trail preserved; incorrect manual payment voided, duplicate membership cancelled, real Paystack plan corrected.
- `secure_reception_financial_approvals_20260920`: no receptionist direct successful-payment or membership writes; pending request and independent manager review functions.
- `admin_verified_returning_member_claims_20260920`: returning-member identity claim and administrator approval, with no paid plan or revenue created.
- `secure_reception_member_creation_20260920` (confirm exact live name): disallow direct new-profile creation and source/ownership reassignment by reception.
- `secure_new_walkin_intake_and_cross_channel_reference_registry_20260920`: pending walk-in identity/payment request; independent approval creates all three member/payment/membership records atomically; verified reference uniquely registered across both offline payment workflows and checked against Paystack references.
- `allow_audited_admin_approved_member_sources_20260920`: permit two explicitly audited member-source labels without weakening the existing source constraint.

## How the forms behave

1. New online customer uses public `/join` and the Paystack verification path. The new manual approval database changes do not alter Paystack Edge Functions.
2. New walk-in paying offline: reception uses `/management-new-member-intake`. Before approval the request is **pending**, not a payment, receipt of verified funds, member profile or valid plan. It shows the plan price and compulsory registration fee. A different management user verifies the actual gym bank/POS receipt or separately reconciles cash and approves the request. Approval creates the member profile, successful payment and plan within one database transaction; failed approvals roll everything back.
3. Existing member paying cash/POS/transfer: reception uses `/management-payment-desk`; manager verifies and approves. Paystack charges must never also be manually entered.
4. Previously enrolled offline member who needs a login: reception submits a returning-member claim. Only Admin/Owner can independently approve it. This creates/recognises a profile but does not record revenue, create a paid membership or grant access. The verified member signs in via their email and renews using `/member` Paystack checkout, which does not add a *new-member* registration fee.
5. Existing old direct-success forms display links to safe workflows instead of recording successful payments.

## Owner reconciliation responsibilities

The generated `SPF-...` number on a pending request is an **acknowledgement number only**, not proof of an actual bank credit or a paid membership. Use separate daily controls: check Paystack and bank settlements, count cash physically, compare against both pending/approved/rejected requests, confirm sequential acknowledgement numbers, and investigate any gap. A receptionist can still conceal an entirely unrecorded cash collection without member-facing acknowledgements, independent cash counts and bank reconciliation; software permissions alone do not eliminate this risk.

## Read-only verification (no dummy financial transactions)

```sql
SELECT id,status,amount,source,paid_at FROM public.payments
 WHERE member_id = (SELECT id FROM public.members WHERE lower(full_name) = lower('Chigozie Afoma') LIMIT 1)
 ORDER BY created_at;

SELECT conname,pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid='public.members'::regclass AND conname='members_source_check';

SELECT c.relrowsecurity FROM pg_class c WHERE c.oid='public.fitness_new_member_requests'::regclass;
SELECT has_table_privilege('authenticated','public.fitness_new_member_requests','INSERT'); -- must be false
SELECT has_table_privilege('authenticated','public.fitness_new_member_requests','UPDATE'); -- must be false
SELECT count(*) FROM public.fitness_verified_collection_refs;
```

## Release gates

- Confirm Vercel preview build READY at the exact PR head SHA.
- Check as actual reception and manager accounts: role visibility, no self-approval, duplicate name/email/phone rejection, mandatory new-member registration fee, payment status only after review, RLS and unique reference behaviour.
- Never use a real card or production money for test transactions. Use a separate test database and Paystack test keys for end-to-end financial QA.
- Confirm production revenue after deploy remains consistent with verified provider/bank credits, and do not deploy by merging until the owner approves the preview.
