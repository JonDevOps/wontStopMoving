# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Run locally against the Firebase emulators

Nothing touches production data in this mode.

1. One-time setup: install Java 21 (`brew install openjdk@21`).
2. Terminal 1: `npm run emulators` starts Auth + Firestore. Data persists in `.emulator-data/`.
3. Terminal 2: `npm run seed:local` creates test accounts and sample data. Run it once, or again whenever you want to reset the samples.
4. Terminal 2: `npm run dev:local`, then open http://localhost:9002/login.

Test logins (password `password123`): `admin@wsm.test`, `rep@wsm.test`, `customer@wsm.test`, `provider@wsm.test`.

The browser's Firebase traffic goes through the dev server (see `rewrites` in `next.config.ts`), so the app runs on a single origin. Stripe, email and SMS still need their own test keys in `.env.local`.
