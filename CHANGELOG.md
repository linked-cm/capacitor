# @linked.cm/capacitor

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
