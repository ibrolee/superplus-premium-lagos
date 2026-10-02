# Super Plus Fitness Mobile

Member-facing iOS and Android app for Super Plus Fitness & Spa.

## v0.1 foundation

- Email/password login and member-login creation
- Same Supabase member identity used by the website
- Home dashboard with membership state and announcements
- Membership history and Family Plan summary
- Permanent member QR card using the same QR token as reception
- Attendance and successful payment history
- Profile and logout
- iOS and Android identifiers reserved as `com.superplusfitness.app`

The app intentionally reuses the production Super Plus Supabase project. It does not contain a service-role key. The public publishable key is safe for client apps because access is enforced by the existing Row Level Security policies.

## Run locally

Requirements: Node.js 22.13+.

```bash
cd mobile
npm install
npx expo install --check
npm run typecheck
npm start
```

Scan the Expo QR code with Expo Go for the first device test.

## Environment

Expo public environment variables can override the checked-in defaults:

```bash
cp .env.example .env
```

Never put a Supabase service-role key, Paystack secret key, Apple private key, or Google Play credential in `EXPO_PUBLIC_*` variables.

## Next milestones

1. Real-device testing and UI polish
2. Password reset/deep links
3. Native Paystack renewal flow
4. Push notifications and expiry reminders
5. Verify branded icon/splash on standalone devices
6. EAS preview builds, TestFlight and Play testing
7. Store submission

## Official branding and native image safety

`BrandLogo` is the shared, accessible image component for login, account loading,
account-link help, the home header, QR card, and profile footer. It bundles the
images locally, preserves their aspect ratio, and requires no network request.
The full logo is the official uploaded circular Super Plus Fitness artwork.
The small mark uses the athlete and red-to-orange ring without tiny text.
The existing screen structure, green UI theme, routes, auth, data, and payment
logic are preserved.

| Asset | Format | Purpose |
| --- | --- | --- |
| `assets/splash-logo.png` | 1024 × 1024, 8-bit RGB | Official full logo in the UI and native splash |
| `assets/icon.png` | 1024 × 1024, opaque RGB | iOS and legacy Android app icon; compact UI mark |
| `assets/adaptive-icon.png` | 1024 × 1024, RGBA | Android foreground; artwork fits inside the central safe circle |
| `assets/notification-icon.png` | 96 × 96, white RGBA symbol | Android notification silhouette |
| `assets/brand-mark.svg` | Editable vector | Athlete from the existing website logo, with the brand ring |

PNG assets are decoded and freshly encoded as non-interlaced RGB/RGBA, with no
indexed palette or copied metadata. The earlier `icon.png` failed Expo's Jimp
decoder with `Unrecognised filter type - 46`, even though its PNG header appeared
valid. Checking file extensions or dimensions alone is insufficient.

Run the same gates as mobile CI before shipping asset/config changes:

```bash
cd mobile
npm install --package-lock=false
npx expo install --check
npm run typecheck
npm run check:assets
npx expo prebuild --no-install --platform android
npx expo export --platform android --output-dir /tmp/superplus-mobile-android
npx expo export --platform ios --output-dir /tmp/superplus-mobile-ios
```

`check:assets` checks the PNG headers and runs decode/resize through the installed
Expo SDK's own Jimp image processor. Prebuild checks the actual native config
plugins too. Generated `android/` and `ios/` folders stay untracked so EAS can
regenerate them from `app.json`. Expo prebuild may rewrite the local `android`
and `ios` package scripts; keep the committed Expo Go start scripts unchanged.

The EAS project, app identifiers, build profiles, and dependency versions remain
unchanged. Native icon/splash changes require a new standalone build and install;
reloading Expo Go only updates the in-app branding. Expo Go does not reproduce
the standalone native splash. Validate a cold launch and home-screen icon on a
new Android preview APK and an iPhone build before release. A successful prebuild
and JS export do not replace the full EAS native compile/signing step.
