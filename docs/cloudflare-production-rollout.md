# Cloudflare production rollout (14 October 2026)

Owner explicitly requested continuing to move Super Plus Fitness from Vercel to Cloudflare with Vercel as fallback.

## Production state

- `main` includes verified Cloudflare Wrangler configuration for existing Worker `superplus-fitness-preview`.
- This commit exists to trigger a production-branch build on Cloudflare's GitHub integration. It changes documentation only and must not change user-facing behavior at Vercel.
- Live website remains on Vercel until its registrar-controlled nameservers and Cloudflare Workers route are updated.

## Domain preparation

- Wix is the domain registrar, and nameservers previously observed: `ns0.wixdns.net`, `ns1.wixdns.net`.
- Cloudflare discovered A apex `216.198.79.1`, CNAME `www` → `c33a3deb88288462.vercel-dns-017.com`, and TXT `resend._domainkey`. Compare with Wix DNS before changing nameservers. Preserve any other records.
- Stage with original A/CNAME as **proxied** in Cloudflare to maintain Vercel as origin during DNS nameserver transition. Once zone is active, attach `superplusfitness.com/*` and `www.superplusfitness.com/*` as **Worker Routes** to the deployed Worker, retaining original DNS records for quick rollback by deleting/disabling the routes. Do not configure a Custom Domain simultaneously on a hostname with an existing CNAME; Worker Routes are the deliberate temporary rollback-friendly bridge.
- After Cloudflare becomes authoritative, Vercel may see proxy IPs instead of its original A/CNAME, so verify origin SSL and requests work while routed through Cloudflare. The final Worker-origin Custom Domains setup can be done later without dropping Vercel backup until fully verified.

## Operational verification

- Test both HTTPS apex and www, ensure apex canonicalizes to www as before.
- Member, admin, staff, receptionist login and role access. Test read-only first.
- Existing live Supabase service remains unchanged (project ID `sytcvezkryjcxwqdimuz`). Mobile clients and Edge Functions remain untouched.
- Paystack hosted checkout callback URLs in Edge Functions currently use both apex and www. Must confirm both hostnames work.
- Ensure Cloudflare Access is not inadvertently blocking the customer-facing production Worker/Routes.
- Monitor billing and error logs for an agreed period before cancelling Vercel Pro.

## Rollback

1. In Cloudflare Worker > Settings > Domains & Routes, remove/disable the domain Worker Routes for apex and www.
2. Keep the original Cloudflare proxied DNS A / CNAME records intact. They point to Vercel, which can then resume serving the site without requiring a slow nameserver rollback, subject to SSL/caching and normal DNS conditions.
3. Confirm Vercel live website and payment callbacks.
4. Keep Wix NS at Cloudflare until stable or revert nameservers in Wix after carefully restoring equivalent DNS records; nameserver reversion may take up to 48 hours.
