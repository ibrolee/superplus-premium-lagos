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
5. Branded app icon/splash assets
6. EAS preview builds, TestFlight and Play testing
7. Store submission
