# @linked.cm/capacitor

## 0.3.0

### Minor Changes

- [#9](https://github.com/linked-cm/capacitor/pull/9) [`19f4d89`](https://github.com/linked-cm/capacitor/commit/19f4d890aa9775c64471b1aed10cff6543a01530) Thanks [@flyon](https://github.com/flyon)! - Depend on `@_linked/auth@^3.1.0` (was `^1.2.3`), so an app on `@_linked/react` 2 no longer installs `@_linked/react` 1 through auth 1.x. `@_linked/server-utils` moves from `~1.0` to `^1.12.0`: auth 3 needs `^1.9.0`, and the old range installed a second copy whose `BackendProvider` differed from auth's.

  Minor rather than patch: an app that installs this release runs auth 3, which changes what it stores and how it signs in. This is a breaking change for consumers, and minor is the breaking-change bump for a 0.x package.

  **Before deploying, the app must be ready for auth 3.** See auth's changelog for 2.0.0 and 3.0.0:

  - **Stored auth data needs a one-time migration.** Auth 2.0 moved every auth class and property from `http://lincd.org/ont/auth/` to `https://linked.cm/ont/auth/`. Until `migrateAuthNamespace(store)` from `@_linked/auth/utils/migrateNamespace` has run on each dataset that holds auth shapes, credentials written by auth 1.x are invisible, including the `AuthCredential` records this package creates for WhatsApp sign-ups. This package does not migrate anything itself.
  - Browsers now get the auth tokens as httpOnly cookies set by the server, and access tokens last 15 minutes. Native apps keep receiving the refresh token in the body once `CapacitorProvider` registers its token storage, as before.
  - Apple sign-in needs `APPLE_CLIENT_ID` and/or `APPLE_CLIENT_ID_IOS` on the server, or every Apple sign-in is rejected.

  Changes in this package for auth 3:

  - **Apple sign-in uses a server-issued nonce.** `SigninWithAppleButton` now calls `createOAuthNonce` first and requests the identity token with that nonce. It used to generate the nonce on the device. Auth 3 rejects any nonce it did not issue ("Invalid or expired Apple sign-in nonce"), so every Apple sign-in would have failed. The new `signinWithApple(auth, scopes)` runs the same flow. `loginWithApple(scopes, nonce?)` takes the nonce as a second argument and leaves it out of the payload when none is given. `createAppleNonce` is deprecated. An app with an RPC exposure list must expose `createOAuthNonce: 'public'`.
  - **Facebook sign-in no longer works.** Auth 3 does not verify Facebook tokens, so it rejects `signinOAuth('facebook', …)` and `SigninWithFacebookButton` calls `onCallback` with `{ error: 'Unsupported OAuth provider' }`. The button stays exported. Hide it until auth supports Facebook.
  - OAuth `onCallback` can receive `{ error, action: 'sign_in_to_link' }` when the email belongs to an account that already has a password. The user signs in the usual way and then calls `useAuth().linkOAuthIdentity`.
  - WhatsApp sign-in passes `refreshTokenExpiresIn`/`refreshTokenExpiresAt` to `updateAuth`, so native storage keeps the refresh token for as long as the server does.
  - Account-removal listeners are now awaited, and a failure stops the removal. If deleting the account's `LocationUpdateAction` fails, the account is no longer removed.

## 0.2.0

### Minor Changes

- [#7](https://github.com/linked-cm/capacitor/pull/7) [`e8cb340`](https://github.com/linked-cm/capacitor/commit/e8cb340225d3f4fceaacbbd51ee821e399440551) Thanks [@flyon](https://github.com/flyon)! - Depend on `@_linked/react@^2.0.0` (was `^1.1.0`), and on the first releases of its linked dependencies that use it: `@_linked/primitives@^1.8.0` (was `^1.7.0`), `@_linked/schema@^1.5.0` (was `~1.0`) and `@_linked/sioc@^1.4.0` (was `1.x`). `@_linked/core` moves to `^2.27.0`, the core peer range `@_linked/react` 2 requires.

  The APIs used from `@_linked/react` — `createLinkedComponentFn` and `cl` — did not change in 2.0.

  `@_linked/auth` stays at `^1.2.3`. Auth 1.x still depends on `@_linked/react@^1`, so one copy of react 1 remains, nested under auth, until this package moves to auth 3 — a separate change, since auth 2 and 3 changed stored data and the token transport.

  Minor: this is a 0.x package and the change is a dependency move that consumers do not have to act on.

## 0.1.0

### Minor Changes

- [#2](https://github.com/linked-cm/capacitor/pull/2) [`bd088c4`](https://github.com/linked-cm/capacitor/commit/bd088c450ad047e66cd595097444d6ac7d220a8d) Thanks [@abdipramana](https://github.com/abdipramana)! - First release of the native app helpers. Shape registration stays `@linked.cm/capacitor`. The location term stays `http://lincd.org/ont/lincd-capacitor/LocationUpdateAction`.

  Import the sign-in buttons from their component paths. Each one takes `onCallback`. A cancelled prompt does not call it. Any other failure calls it with `{ error }`.

  ```tsx
  import { SigninWithGoogleButton } from "@linked.cm/capacitor/components/SigninWithGoogleButton";
  import { SigninWithAppleButton } from "@linked.cm/capacitor/components/SigninWithAppleButton";
  import { SigninWithFacebookButton } from "@linked.cm/capacitor/components/SigninWithFacebookButton";
  import { SigninWithWhatsappButton } from "@linked.cm/capacitor/components/SignInWithWhatsapp";

  <SigninWithGoogleButton onCallback={(result) => {}} />;
  ```

  `SigninWithAppleButton` renders nothing on Android. `SigninWithWhatsappButton` collects a phone number, sends a code, then accepts a 6-digit code. The server reads `WA_D360_API_KEY`, `WA_D360_USERNAME`, `WA_D360_PASSWORD`, `WA_D360_TEMPLATE_NAMESPACE`, and `WA_D360_TEMPLATE_NAME`.

  `LocationEnabler` stores the device position through `LocationUpdateAction.updateUserLocation` when the switch turns on. `SafeAreaContainer` writes the native insets to `--safe-area-*`. `CapacitorProvider` handles deep links and stores auth tokens in native preferences.

  `useAutomaticUpdates` confirms the current bundle, checks the store version, polls `{SITE_ROOT}/__health`, and downloads a newer bundle. `useNativeAppUpdate` prompts for a store update. `IOS_APP_STORE_ID` is the numeric store id.

  Import `CapacitorBackendProvider` from `@linked.cm/capacitor/backend` on the server only. See `readme.md` for the entry points and the sign-in environment variables.
