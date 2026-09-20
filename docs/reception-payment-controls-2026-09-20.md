# Reception payment controls — September 20, 2026

## Deployment state

The production Supabase project received incident/security migrations **before** the website PR was merged. Their exact SQL is in the Supabase migration history (`supabase_migrations.schema_migrations.statements`); export and review the applied source before rebuilding a database. This is an operational audit and rollout guide, not a replacement for the migrations. **Never replay the one-time member reconciliation on another database. Do not publish member-specific reconciliation SQL or identifiers in this public repository.**

Applied migrations (verify the exact names and versions against production migration history):

- `audit_member_payment_reconciliation_20260920`: one-time correction preserving history; incorrect manual payment voided, duplicate membership cancelled, verified Paystack plan corrected.
- `secure_reception_financial_approvals_20260920`: block reception direct successful-payment/membership writes; introduce pending payment requests and independent approval functions.
- `admin_verified_returning_member_claims_20260920`: returning-member identity claim and Admin/Owner approval, without payment or plan creation.
- `secure_reception_member_creation_20260920` (check exact live name): restrict direct receptionist profile creation and changes to account ownership/source.
- `secure_new_walkin_intake_and_cross_channel_reference_registry_20260920`: pending walk-in intake and atomic approval; unique verified reference shared by both offline approval flows, with Paystack-reference check.
- `allow_audited_admin_approved_member_sources_20260920`: allow the two audited member-source labels.
- September 20 follow-up PT-only registration fee migration (check exact live name): preserve the original ₦0 registration fee for Personal Training Only in both intake and approval; Family ₦20,000, Semi-Annual/VIP Gold ₦3,000, other published plans ₦7,000.
- `prevent_duplicate_pending_walkin_phone_20260920`: unique partial index on normalised last 10 phone digits for pending walk-in requests, complementing existing unique pending email index.

## Workflow

1. Online new customer uses `/join` and verified Paystack checkout. Do not also submit a manual request for a Paystack transaction.
2. New offline walk-in: reception submits `/management-new-member-intake`; no member, paid plan, or successful payment is created while pending. A DIFFERENT authorised manager checks actual bank/POS settlement or independently reconciled cash and approves. Approval writes member, plan, and one payment atomically; a failed transaction rolls back.
3. Existing member paying cash/POS/transfer: submit `/management-payment-desk`; a separate manager checks actual funds and approves. A pending request is not proof of receipt.
4. Returning offline member without an online profile: reception requests historical-member recognition; only Admin/Owner can approve. This creates/recognises their identity but does **not** record revenue or activate a membership. The member verifies their email and uses `/member` Paystack renewal without new-member registration.
5. The unsafe old direct-success forms link to the protected replacements instead of letting reception create successful payments.

## Owner reconciliation — essential manual controls

A generated `SPF-...` request number is only an acknowledgement, **not** a paid receipt. Compare Paystack settlement and bank deposits with successful website payments; reconcile cash against physically counted cash, receipts and deposits each shift with someone other than the collector. Include pending/rejected requests and investigate gaps in acknowledgement numbers. A cashier can conceal a completely unrecorded cash collection without member-facing acknowledgements and independent reconciliation; application permissions alone cannot prevent theft.

## Read-only release verification

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.members'::regclass AND conname = 'members_source_check';

SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'fitness_new_member_requests'
  AND indexname IN ('fitness_new_pending_email_unique', 'fitness_new_pending_phone_unique');

SELECT c.relrowsecurity FROM pg_class c
WHERE c.oid = 'public.fitness_new_member_requests'::regclass;
SELECT has_table_privilege('authenticated', 'public.fitness_new_member_requests', 'INSERT'); -- false
SELECT has_table_privilege('authenticated', 'public.fitness_new_member_requests', 'UPDATE'); -- false
SELECT count(*) FROM public.fitness_verified_collection_refs;
```

Review any specific member's payment history privately in the admin database, not in the public GitHub repository.

## Release gates

- Preview build READY at the exact PR head SHA and owner's mobile review completed.
- Authenticated two-person end-to-end test with reception and management on **a separate test database**, using Paystack test credentials. Verify role visibility, self-approval rejection, duplicate email/phone rejection, fees and special-plan exemptions, retries, and payment/membership creation only after independent approval. Do not submit preview forms against production just for QA.
- Preserve actual production payment/revenue records, confirm reconciliation against external settlements, and obtain explicit owner approval before merging the website PR.
- Export approved, sanitised reusable migrations before future environment rebuilds. Keep the one-time incident correction private.
