# RESCENE PRIVATE — Android native app (Expo)
This is a separate React Native application. The existing Vite web app remains unchanged.

## First run
1. Run `cd mobile && npm install` (Node 20+ recommended).
2. Copy `.env.example` to `.env` and enter the **same Supabase project URL and publishable/anon key** as the web app. Never use a service-role or secret key.
3. In Supabase SQL Editor run `supabase/admin-invite-readonly.sql` first (with the correct admin email), then **only if you accept public disclosure** run `supabase/android-public-read.sql`.
4. Run `npx expo start` and open on Android with Expo Go. For an APK: `npm install -g eas-cli`, `eas login`, `eas build:configure`, `eas build --platform android --profile preview`.

## Security and privacy
The public-read SQL exposes **all existing and future event rows and linked photos** to anyone with the Supabase public key. It does not grant anonymous writes. Do not run if the data is confidential. The mobile app reads anonymously on Home/Calendar; only the Admin tab requests email/password and verifies `app_members.role='admin'`. Supabase RLS is the actual write barrier.

## Compatibility
- Same events, event_images, legacy image_path and event-images Storage as web.
- Existing web pages and their login requirement remain unchanged.
- Expo code is cross-platform friendly, but only Android builds are currently targeted.
- Dates are entered in ISO-like local form YYYY-MM-DDTHH:mm, converted to UTC on save.
- Multiple images up to 10; 5MB each; uploads and deletes use existing admin RLS.
- A real device and Supabase migration test are still required before release.
