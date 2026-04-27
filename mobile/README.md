# ShortStack Mobile (Expo)

A thin React Native + Expo shell that wraps the production web app with
a sprinkle of native goodness. The strategy is intentionally
"WebView-first":

- **WebView wraps `app.shortstack.work`** so 100% of the agency OS is
  available on day one.
- **Native screens** for the things mobile users actually want at a
  glance — Inbox, Settings.
- **Native bonuses** layered on top: biometric unlock, push
  notifications, offline inbox cache.

It is not a full re-implementation. We do not maintain a parallel UI.

## Stack

| Concern              | Choice                                             |
| -------------------- | -------------------------------------------------- |
| Framework            | Expo SDK 53 (React Native 0.76, New Architecture)  |
| Auth                 | `@supabase/supabase-js` + `expo-secure-store`      |
| Web view             | `react-native-webview` 13                          |
| Push                 | `expo-notifications` (Expo push service)           |
| Biometric            | `expo-local-authentication`                        |
| Navigation           | `@react-navigation/bottom-tabs`                    |
| OTA updates          | `expo-updates` via EAS Update                      |

## Project layout

```
mobile/
├── App.tsx                # Auth gate + bottom-tab navigator
├── app.json               # Expo config (icons, splash, plugins, deep links)
├── eas.json               # EAS build + submit profiles
├── babel.config.js
├── metro.config.js
├── package.json
├── tsconfig.json          # TypeScript strict
├── .env.example
└── src/
    ├── theme.ts
    ├── lib/
    │   ├── supabase.ts        # SecureStore-backed Supabase client
    │   ├── push.ts            # Expo push token registration
    │   ├── biometric.ts       # FaceID / Fingerprint gate
    │   └── offline-cache.ts   # AsyncStorage-backed inbox cache
    └── screens/
        ├── LoginScreen.tsx
        ├── MainScreen.tsx     # WebView wrapping app.shortstack.work
        ├── InboxScreen.tsx    # Native, offline-aware inbox
        └── SettingsScreen.tsx # Push toggle + sign-out
```

## Local development

```bash
cd mobile
npm install            # one-time
cp .env.example .env   # fill in the anon key
npm run typecheck      # tsc --noEmit
npm start              # opens Expo Dev Tools
```

You'll need either:

- **Expo Go** on a physical device (scan the QR code).
- An Android emulator (`npm run android`).
- An iOS simulator on macOS (`npm run ios`).

> Push notifications and biometric checks require a **physical device**.
> Both fail gracefully on the simulator.

## Provisioning EAS

This project uses [EAS Build](https://docs.expo.dev/build/introduction/)
for CI binaries and [EAS Update](https://docs.expo.dev/eas-update/introduction/)
for OTA JS bundle updates.

```bash
npm install --global eas-cli
eas login
eas init                 # creates the EAS project + projectId
```

Update `app.json`:
- `expo.extra.eas.projectId`
- `expo.updates.url`

with the values printed by `eas init`.

## Building the binaries

### Android (Play Store)

```bash
eas build --platform android --profile production
```

Outputs an `.aab`. Submit:

```bash
eas submit --platform android
```

You'll need:
- A Google Play Console account ($25 one-time).
- A service account JSON for automated submission, **or** upload the
  `.aab` manually the first time.

### iOS (App Store)

```bash
eas build --platform ios --profile production
```

Then:

```bash
eas submit --platform ios
```

You'll need:
- An Apple Developer account ($99/year).
- App Store Connect app record created.
- Replace the placeholders in `eas.json` (`appleId`, `ascAppId`,
  `appleTeamId`).

## Push notifications

The shell talks to the Expo push service. The flow:

1. User toggles **Settings → Push notifications**.
2. `registerForPushNotifications()` in `src/lib/push.ts` requests OS
   permission, gets an Expo push token, and POSTs it to the backend
   route `POST /api/mobile/push-tokens`.
3. The backend stores one row per `(profile_id, expo_token)` in the
   `mobile_push_tokens` table.
4. To send a notification, the backend hits the Expo push API
   (`https://exp.host/--/api/v2/push/send`).

Admins can trigger a test notification with:

```http
POST /api/mobile/push-tokens/notify
Authorization: Bearer <service-role>
Content-Type: application/json

{
  "profile_id": "...uuid...",
  "title": "New client message",
  "body": "Acme Corp replied: 'Yes, ship it.'",
  "data": { "url": "https://app.shortstack.work/dashboard/conversations" }
}
```

## Biometric unlock

After a successful sign-in, `LoginScreen.tsx` calls
`biometricGate(...)`. On devices with Face ID, Touch ID, or fingerprint
enrolled, the user must pass the OS prompt. On devices without
biometric hardware, the gate is a no-op (we don't lock you out of the
app).

The Supabase session itself is stored in `expo-secure-store` (Keychain
on iOS, EncryptedSharedPreferences on Android). If the session blob
exceeds the SecureStore size limit on Android (~2 KB), the storage
adapter falls back to AsyncStorage.

## Offline support

`InboxScreen.tsx` shows the last cached inbox immediately, then fetches
fresh data in the background. If the network call fails, the user keeps
seeing cached data with a "Showing cached inbox" banner. The cache is
seven days TTL, capped at the most recent 100 conversations.

We do **not** queue mutations offline. Sending a reply requires the
network. This keeps the data model simple and avoids divergence with
the web app.

## Releasing OTA updates

For JS-only changes (no native modules added), skip the App Store and
ship via EAS Update:

```bash
eas update --branch production --message "Fix inbox refresh bug"
```

Users get the new bundle on next launch. Native module changes
(adding/removing an Expo plugin, bumping SDK version, etc.) require a
new binary and a fresh App Store / Play Store submission.

## Common pitfalls

- **"EAS projectId is not configured"** — run `eas init` and copy the
  printed projectId into `app.json` (`expo.extra.eas.projectId` and
  `expo.updates.url`).
- **WebView blank on Android** — check that `app.shortstack.work` is
  reachable from the device. The shell does not support self-signed
  certificates in production builds.
- **Push works in dev, not prod** — Apple production push uses a
  different APNs environment. Make sure the EAS production build is
  uploaded to TestFlight at least once before testing push.
- **Session lost on app restart on Android** — confirm
  `expo-secure-store` is in the build. Without it, sessions live only
  in memory.

## Scripts

| Command                         | What it does                                |
| ------------------------------- | ------------------------------------------- |
| `npm start`                     | Expo dev server                             |
| `npm run android` / `ios` / `web` | Targeted dev launch                       |
| `npm run typecheck`             | `tsc --noEmit`                              |
| `npm run build:android`         | `eas build --platform android --profile production` |
| `npm run build:ios`             | `eas build --platform ios --profile production`     |
| `npm run submit:android`        | `eas submit --platform android`             |
| `npm run submit:ios`            | `eas submit --platform ios`                 |
