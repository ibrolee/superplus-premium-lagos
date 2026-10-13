# Super Plus Fitness — Cloudflare migration readiness (NO LIVE CUTOVER)

**Scope:** test-only branch `migration/cloudflare-spf-2026-10-13` of the existing Super Plus Fitness application. This branch must not be merged into `main` or pointed at `superplusfitness.com` until approved functional tests pass.

## Architecture

- Web app: Lovable TanStack Start + Nitro, with Vite building a Cloudflare-targeted server artifact. Existing `src/server.ts` must not be bypassed.
- Production web host: Vercel, unchanged.
- Database and authentication: Supabase external to Vercel. Keep production tables and policies in place; do **not** copy or reset production data.
- Server payment processing: Supabase Edge Functions (`initialize-payment`, `initialize-public-payment`, `verify-payment`, `verify-public-payment`, `paystack-webhook`), not Vercel functions.
- iOS/Android mobile app: inside `mobile/` of this repo, unchanged.

## Build gate

GitHub Actions `cloudflare-spf-migration-dryrun.yml` installs frozen Bun deps, runs the original `bun run build`, asserts Nitro output, and checks `wrangler deploy --dry-run` with no credentials.

**Important:** GitHub CI does NOT inject the production Supabase values. A green CI build validates packaging, not whether the Cloudflare preview successfully logs users in or loads real data.

## Preview deployment setup

1. Use a separate Cloudflare Worker called `superplus-fitness-preview` connected to GitHub.
2. Deploy the migration branch only. Do not assign `superplusfitness.com` or `www.superplusfitness.com` at this stage.
3. Build command `bun run build`, deploy command `npx wrangler deploy`; use `wrangler.jsonc` from this branch.
4. Configure the exact intended Supabase public configuration as **Cloudflare build-time variables** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) and verify which environments are receiving them. Neither variable is a service-role secret; never add a service-role key or Paystack secret to a public `VITE_*` variable. Avoid committing real tokens. The Vite app reads these at build time.
5. If authentication sends external redirects, review Supabase Auth allowed callback/site URLs for the temporary HTTPS preview *without removing existing production URLs*. Do not change Paystack webhook URLs to a Cloudflare preview.
6. If the Worker is publicly accessible, assume it can reach the live Supabase backend when configured with production endpoints. Restrict test accounts and avoid financial/data mutations during initial evaluation. For transaction testing, provision an isolated sandbox Supabase project and Paystack test configuration; do not charge real customers.

## Critical testing gates (before any DNS cutover)

1. Visual: public homepage, membership pricing, join, blog, facilities, mobile responsiveness, images, favicon, direct URL loading, dark/light mode where applicable, sitemap and HTTPS.
2. Auth: member, staff, receptionist, and admin authentication, email code login and return URLs; logout/password reset.
3. Payments: initialize and verify flows; registration fee, membership renewal, PT-only, family plan, public registration-only and callbacks; failure/retry/idempotency paths using test payments only.
4. Member workflow: member QR card, entry/exit scanning, missed scan, day boundary (Lagos timezone), membership expiry, member card fields, points/rewards.
5. Staff/admin workflow: attendance, salary information permissions, salary advances, payroll period rules, PT commissions, expenses and month-end reporting; test with isolated dummy records, never modify live payroll.
6. Browser APIs: reception QR scanner camera permissions on mobile HTTPS; push/notification behavior if applicable.
7. Mobile compatibility: verify Super Plus Fitness iOS/Android app is not dependent on the Vercel hostname for downloads, callbacks, URLs, or deep links; preserve active downloads.
8. Security: confirm sensitive endpoints remain protected, browser only uses Supabase publishable key, no service-role or Paystack secrets in client bundles, no role-policy regressions.
9. Performance and monitoring: check Cloudflare Worker logs, SSR errors, cold starts, static assets, mobile navigation and bot abuse controls.
10. Repeat against production domain after a controlled cutover. Keep Vercel available for rollback until stable.

## No-interruption handoff

Keep production on Vercel while building and verifying a temporary `*.workers.dev` preview. When approved, prepare DNS/SSL and hostname rollback. Make the public switch only after the owner approves a tested configuration. Cancel Vercel Pro only after the portfolio and gym are both stable on Cloudflare. JIS Beauty & Fashion is not launched; do not migrate or launch it unintentionally.

## Preview trigger after Cloudflare project connection — 13 October 2026

Cloudflare Worker creation was reported completed by the owner. This documentation-only commit triggers a new build of the isolated migration branch if Cloudflare GitHub Preview Builds are enabled for the connected repository. The first deployment may have originated from `main`, which does **not** include this branch's Wrangler configuration; validate this branch specifically. Do not switch domains, change Paystack callbacks, merge this branch, or perform production member/payroll mutations as part of preview setup.
