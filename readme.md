# @linked.cm/capacitor

Native app helpers for social sign-in, WhatsApp one-time codes, safe area, location, and store or bundle updates.

The location term stays on `http://lincd.org/ont/lincd-capacitor/`. Shape registration uses `@linked.cm/capacitor`.

## Public entry points

| Import | What it is |
|---|---|
| `@linked.cm/capacitor` | Social login helpers: `loginWithGoogle`, `loginWithApple`, `loginWithFacebook`, `SocialLoginError` |
| `@linked.cm/capacitor/components/SigninWithGoogleButton` | Google sign-in button |
| `@linked.cm/capacitor/components/SigninWithAppleButton` | Apple sign-in button. Renders nothing on Android |
| `@linked.cm/capacitor/components/SigninWithFacebookButton` | Facebook sign-in button |
| `@linked.cm/capacitor/components/SignInWithWhatsapp` | `SigninWithWhatsappButton`, phone then 6-digit code |
| `@linked.cm/capacitor/components/LocationEnabler` | Switch that stores the device position |
| `@linked.cm/capacitor/components/SafeAreaContainer` | Native safe-area insets as CSS variables |
| `@linked.cm/capacitor/hooks/useCapacitor` | `CapacitorProvider` for deep links and native token storage |
| `@linked.cm/capacitor/hooks/useAutomaticUpdates` | OTA bundle updates and a maintenance check |
| `@linked.cm/capacitor/hooks/useNativeAppUpdate` | Store update prompt on iOS and Android |
| `@linked.cm/capacitor/shapes/LocationUpdateAction` | `LocationUpdateAction.updateUserLocation` |
| `@linked.cm/capacitor/shapes/index` | Registers the location shape without loading the components |
| `@linked.cm/capacitor/utils/helper` | `normalizeTelephone` and `replaceLocalhostWithSiteRoot` |
| `@linked.cm/capacitor/backend` | `CapacitorBackendProvider` |

## Sign-in

Google, Apple, and Facebook buttons call `auth.signinOAuth` and pass the result to `onCallback`. A cancelled prompt does not call `onCallback`. Any other failure calls it with `{ error }`.

```tsx
import { SigninWithGoogleButton } from '@linked.cm/capacitor/components/SigninWithGoogleButton';

<SigninWithGoogleButton onCallback={(result) => {}} />
```

Google web login needs `GOOGLE_CLIENT_ID` and `SITE_ROOT` (the callback is `{SITE_ROOT}/signin`). Apple on the web needs `APPLE_SIGN_IN_CLIENT_ID` and `APPLE_SIGN_IN_REDIRECT_URI`. Facebook needs `FACEBOOK_CLIENT_ID`.

Sign-in is verified by `@_linked/auth` 3:

- **Apple**: the button asks the server for a single-use nonce (`createOAuthNonce`) and requests the identity token with it; `signinWithApple(auth, scopes)` does the same outside the button. The server needs `APPLE_CLIENT_ID` (web, the Services ID) and/or `APPLE_CLIENT_ID_IOS` (the app's bundle ID), or it rejects every Apple sign-in. Calling `loginWithApple` yourself with a nonce the server did not issue gets the sign-in rejected.
- **Google**: the server needs `GOOGLE_CLIENT_ID` (and `GOOGLE_CLIENT_ID_IOS` for iOS).
- **Facebook**: auth 3 does not verify Facebook tokens yet and answers `{ error: 'Unsupported OAuth provider' }`. Hide the Facebook button until it does.
- When the provider's email belongs to an existing account that signed in another way, `onCallback` gets `{ error, action: 'sign_in_to_link' }`. Sign the user in the way they did before, then call `useAuth().linkOAuthIdentity`.
- An app with an RPC exposure list must expose auth's `createOAuthNonce: 'public'` for Apple sign-in, and `linkOAuthIdentity: 'user'` to link a provider.

WhatsApp sign-in asks the backend to send a code, then validates it. The server reads:

- `WA_D360_API_KEY`
- `WA_D360_USERNAME`
- `WA_D360_PASSWORD`
- `WA_D360_TEMPLATE_NAMESPACE`
- `WA_D360_TEMPLATE_NAME`

## Location and updates

`LocationEnabler` requests the device position only when the switch turns on, then calls `LocationUpdateAction.updateUserLocation`. Turning the switch off clears `enabledLocationServices` on the current account.

`useAutomaticUpdates` runs on iOS and Android. It confirms the current bundle, checks the native store version, polls `{SITE_ROOT}/__health`, and downloads a newer bundle when the server is up. `IOS_APP_STORE_ID` is the numeric store id used when opening the store.
