---
'@linked.cm/capacitor': minor
---

Depend on `@_linked/auth@^3.1.0` (was `^1.2.3`), so an app on `@_linked/react` 2 no longer installs `@_linked/react` 1 through auth 1.x. `@_linked/server-utils` moves from `~1.0` to `^1.12.0`: auth 3 needs `^1.9.0`, and the old range installed a second copy whose `BackendProvider` differed from auth's.

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
