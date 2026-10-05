# Saved app changes — awaiting testing approval

Keep this work on its feature branch. Do not bump app versions, merge into main,
build/publish APKs, deploy the website/functions, or apply database migrations
until the owner explicitly requests testing or launch. Main has automatic builds
and deployment hooks.

## Prepared behavior

- Compact membership cards retain all existing membership fields and actions.
  Narrow cards and larger system text stack date/footer fields; long names wrap.
- Signup stores the entered name in auth metadata and refreshes the linked gym
  profile before opening the dashboard. Existing canonical profile names remain
  authoritative; real signup names can replace old demo labels for display.
- Blog is the fifth bottom tab; the old blog route and saved-post actions remain.
- A signed-in member can manually claim 0.05 SP per Lagos calendar day. A missed
  day resets the current streak, while the best streak and earned points remain.
- One server-selected weekly spin per Lagos Monday–Sunday week. Prizes:
  0.05/0.10/0.15/0.20/0.25/0.50 SP, with odds 35/25/20/10/7/3 percent.
- Amounts and availability are configurable through app_daily_reward_settings.
  Claims cannot set payouts or write the points ledger from the client.

## Database status

The owner authorised applying the two migrations on 5 October 2026. Both are
applied to Supabase project sytcvezkryjcxwqdimuz. Daily/spin calls and duplicate
claim protection passed checks in rolled-back transactions; no permanent test
points were added. Reward tables have RLS and clients cannot insert claims or
change payouts. The mobile code remains on this feature branch, with no version
bump, APK build, main merge, or website deployment.

An Expo Go preview tunnel was attempted but automatic approval review blocked
exposing the development bundle through ngrok. Obtain explicit authorisation
for that temporary tunnel before retrying; no preview URL is available yet.

## Checks

Mobile TypeScript check and Android JavaScript export passed. Isolated Postgres
checks cover reward replay, account isolation, permissions, missed-day resets,
weekly eligibility, disabled rewards, and signup metadata. Run them with:

```sh
npm install --prefix /tmp/spf-rewards-check @electric-sql/pglite --no-audit --no-fund
PGLITE_MODULE=/tmp/spf-rewards-check/node_modules/@electric-sql/pglite/dist/index.js node --test tests/mobile/daily-rewards.test.mjs
```

Native screen layout, larger accessibility text, free signup, saved Blog posts,
and wheel animation still need testing on a device before release. A browser
layout check was attempted but the browser binary download failed in this workspace.
