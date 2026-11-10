# @linked.cm/capacitor

Native app helpers for social sign-in, WhatsApp one-time codes, safe area, location, and store or bundle updates.

The location term `LocationUpdateAction` (a `schema:UpdateAction`) lives at `https://linked.cm/ont/capacitor/` (prefix `capacitor`), declared in `src/data/capacitor.ttl`, the only source of terms. `linked generate-ontology` writes the accessor modules from it (`package.json` `"linkedOntologies"`), and `linked build` fails when they are stale. Import the terms as a namespace: `import * as capacitor from '@linked.cm/capacitor/ontologies/capacitor'` (`capacitor.LocationUpdateAction`), and `ns`/`loadData` from `@linked.cm/capacitor/ontologies/capacitor.data`. Shape registration uses `@linked.cm/capacitor`.

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
| `@linked.cm/capacitor/hooks/useMandatoryNativeUpdate` | App-supplied minimum-version enforcement for installed iOS and Android binaries |
| `@linked.cm/capacitor/hooks/useReleaseGate` | Non-blocking maintenance, installed-binary, and OTA coordination |
| `@linked.cm/capacitor/utils/releaseStatus` | Shared release-status contract and validation |
| `@linked.cm/capacitor/utils/releaseStatusCache` | Last-valid server cache and framework-light status handler |
| `@linked.cm/capacitor/utils/releaseStatusClient` | Deduplicated, validated status client with last-valid fallback |
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

WhatsApp sign-in asks the backend to send a code, then validates it. `generateOTPWhatsapp` returns `{ sent: true }` after the provider answers HTTP 2xx, and only then stores the code on the browser session. The server reads:

- `WA_D360_API_KEY`
- `WA_D360_USERNAME`
- `WA_D360_PASSWORD`
- `WA_D360_TEMPLATE_NAMESPACE`
- `WA_D360_TEMPLATE_NAME`

## Location and updates

`LocationEnabler` requests the device position only when the switch turns on, then calls `LocationUpdateAction.updateUserLocation`. Turning the switch off clears `enabledLocationServices` on the current account.

`useAutomaticUpdates` runs on iOS and Android. It confirms the current bundle, checks the native store version, polls `{SITE_ROOT}/__health`, and downloads a newer bundle when the server is up. `IOS_APP_STORE_ID` is the numeric store id used when opening the store.

Apps that enforce their own minimum installed-binary version can pause OTA
without delaying application rendering:

```ts
const nativeUpdate = useMandatoryNativeUpdate({
  minimumVersion: status?.minimumVersion,
  fallbackMinimumVersion: COMPILED_MINIMUM_NATIVE_VERSION,
  iosAppStoreId: process.env.IOS_APP_STORE_ID,
  androidPackageName: process.env.APP_ID,
});

useAutomaticUpdates({
  enabled:
    nativeUpdate.state.status === 'not-native' ||
    nativeUpdate.state.status === 'supported',
  checkNativeStoreVersion: false,
});
```

While disabled, automatic updates still call `notifyAppReady()` to prevent a
working Capgo bundle from rolling back, but skip channel, health, store, and OTA
work. Both options default to the previous behavior for existing callers.

For a complete release gate, applications inject their own status loader while
the package owns the reusable lifecycle and native checks:

```ts
const statusClient = new ReleaseStatusClient({
  url: () => `${API_ROOT}/status`,
  headers: () => ({ 'X-App-Version': APP_VERSION }),
});

const gate = useReleaseGate({
  loadStatus: () => statusClient.load(),
  fallbackMinimumVersion: COMPILED_MINIMUM_NATIVE_VERSION,
  iosAppStoreId: IOS_APP_STORE_ID,
  androidPackageName: APP_ID,
});
```

The app renders immediately and decides how to present `gate.state`. Web uses
maintenance only; iOS and Android also enforce the installed store-binary
version. `gate.otaEnabled` remains false until the native binary is confirmed
against the exact effective minimum.

On the server, inject application-owned storage into the cache. The package
does not own configuration files, locks, authorization, or route registration:

```ts
const cache = new ReleaseStatusCache({
  initialStatus: SAFE_COMPILED_STATUS,
  readStatus: () => readReleaseStatusFromApplicationConfig(),
});
server.get('/status', createReleaseStatusHandler(cache));
```

The cache refreshes every minute by default and retains its last valid snapshot
when reading or validation fails. The handler returns validated release fields
with `Cache-Control: no-store`.
