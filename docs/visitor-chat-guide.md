# Public visitor chat — preview, September 21, 2026

The floating **Ask Super Plus** guide is enabled only on the homepage, membership, personal training, facilities, gallery, spa/recovery, about, HMO, contact, blog/article and public Join pages. It does not appear on staff, reception, management or member-account routes. Visitors can enter questions or tap the suggested prompts; each grounded answer links to a relevant page. The chat is kept only in current browser component memory (no persistent chat logs).

## Sources and maintenance

- Published membership prices, registration fees, benefits, spa service descriptions/prices, facilities, contact and opening hours are imported from `src/lib/site-data.ts`. Correct that canonical file first when a price or hours changes.
- Published blog titles and excerpts are fetched from `blog_posts` with the same `published` and `published_at <= now` constraints as the public blog listing. The chat does not fetch member, staff, attendance, transaction or private details.
- Other factual website guidance, synonyms and the fallback are curated in `src/lib/visitor-guide.ts` and should be updated when business policies change. If a policy is not published, the assistant explicitly asks visitors to check with reception rather than guessing.
- The widget is in `src/components/visitor/VisitorChat.tsx`; route allowlist is in `src/routes/__root.tsx`. The homepage's separate back-to-top button is offset so both controls stay visible.

## Capabilities and boundaries

This is a **no-API-cost, public-website question matcher**, not a generative AI model. It supports common natural-language questions and short follow-ups, but cannot guarantee an answer to every possible visitor question or search the full text of blog articles. Unknown questions hand off to reception/WhatsApp. It does not take payments, verify real-time class availability, make bookings, provide medical advice or retrieve a visitor's private membership status. Never ask for or store password, OTP, bank card or private health data.

If a true generative chat is requested later, obtain separate approval for a server-side model provider, usage budget, secret key, abuse/rate limits, approved public knowledge index, factual citations and monitoring. Do not embed an API key in frontend JavaScript or give a model database access to private gym records.

## Preview QA before merge

Check the iPhone overlay and close/send buttons on home and Join, route exclusions on `/management-payment-desk` and `/member`, accurate monthly/first-payment numbers, HMO question, opening times, a returning-member question, an unknown policy fallback, blog links and the homepage back-to-top control. Only merge after owner approval. No production financial writes are involved.
