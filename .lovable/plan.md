Plan: Prepare Rope Rush for Capacitor iOS export

Goal: Bundle the existing web game as a Capacitor iOS app that builds and runs locally in Xcode, while keeping the online leaderboard working.

Why changes are needed

- TanStack Start `createServerFn` calls target the current page origin (`/__server`). Inside a Capacitor WebView the origin is `capacitor://localhost` or `file://`, so there is no co-located server to receive those calls. The leaderboard will silently fail unless we route it to the deployed web backend over HTTP.
- The app currently uses SSR/isomorphic TanStack Start. For a Capacitor package we need a static SPA build.
- iOS has a few native quirks: no `navigator.vibrate`, a safe-area notch, and the audio context must be started by a user gesture.

What will be changed

1. Add Capacitor tooling
   - Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/status-bar`, and `@capacitor/haptics`.
   - Create `capacitor.config.ts` with `appId: 'com.roperush.app'`, `appName: 'Rope Rush'`, `webDir: 'dist'`.
   - Add iOS platform with `npx cap add ios`.

2. Enable SPA mode for the static bundle
   - Update `vite.config.ts` to set `tanstackStart.spa.enabled: true` (via the Lovable config wrapper) so `vite build` produces a static shell Capacitor can copy into the native app.

3. Replace leaderboard server functions with API routes
   - Create `src/routes/api/leaderboard/start.ts` — returns a signed session token (same HMAC logic as today).
   - Create `src/routes/api/leaderboard/scores.ts` — `GET` returns top scores; `POST` submits a score with validation.
   - Create `src/routes/api/leaderboard/continue.ts` — deletes a score row for the "Continue" ad flow.
   - Each route includes CORS headers for `capacitor://localhost`, `http://localhost`, and the published origin so the iOS WebView can reach them.

4. Create a native-aware API client
   - Add a small helper in `src/lib/leaderboard.api.ts` that picks the base URL:
     - Web: relative `/api/leaderboard/...` (works in browser and published site).
     - Native: `import.meta.env.VITE_SERVER_BASE_URL` + `/api/leaderboard/...`.
   - Use `Capacitor.isNativePlatform()` to detect native.

5. Update game UI to use the API client
   - `src/game/RopeRush.tsx` calls `startSession()` from the API client instead of `useServerFn(startGameSession)`.
   - `src/game/ui/Leaderboard.tsx` fetches top scores via the API client.
   - `src/game/ui/GameOver.tsx` submits and deletes scores via the API client.

6. Add production base URL environment variable
   - Add `VITE_SERVER_BASE_URL=https://rope-rush.lovable.app` to `.env` (this is public by definition, so the `VITE_` prefix is correct).
   - Leave it empty/unset for local web dev so relative calls still work.

7. iOS-specific polish
   - In `capacitor.config.ts` set `backgroundColor: '#0d0b1a'`, hide the native status bar or match it to the dark theme, and allow the game to draw under the safe area (it already handles its own max-width and portrait layout).
   - Add a small Capacitor haptics bridge so the existing `haptics` setting works on iOS (optional for the first local build; can be skipped if not needed).
   - Confirm the audio engine is resumed from the first tap — it already is, but add a guard for the WebView `audioSession` if needed.

Build and run steps

1. `bun install` (or `npm install`) to install the new Capacitor packages.
2. `bun run build` (or `npm run build`) to produce the static web bundle.
3. `npx cap sync` to copy the bundle into the iOS project and install native pods.
4. `npx cap open ios` to open the generated `ios/App/App.xcworkspace` in Xcode.
5. In Xcode, select a simulator or connected device and run.

What you need on your Mac

- Xcode 15+ installed.
- CocoaPods installed (`sudo gem install cocoapods` or Homebrew).
- A valid Apple Developer team selected in Xcode if you want to run on a physical device (simulator works without it).

Out of scope for this first pass

- App Store assets (1024x1024 icon, launch storyboard, App Store screenshots). These are only needed for submission, not for a local Xcode build.
- Real rewarded ads. The existing "Continue" button simulates an ad; swapping in a real provider (AdMob, Chartboost, etc.) is a separate integration.
- Native sign-in / Game Center. Leaderboard will continue to use the existing name-based leaderboard.

Expected result

After the plan is implemented, the game builds as a local iOS app, starts on tap, plays audio, and can still submit/fetch scores from the deployed Lovable backend.