import { Capacitor } from '@capacitor/core';
import type {
  InitializeOptions,
  SocialLoginPlugin,
} from '@capgo/capacitor-social-login';
type OAuthProfilePayload = {
  email?: string;
  name?: string;
  familyName?: string;
  givenName?: string;
  fullName?: string;
  imageUrl?: string;
};

export type GoogleOAuthPayload = OAuthProfilePayload & {
  authentication: { idToken: string };
};

export type AppleOAuthPayload = OAuthProfilePayload & {
  identityToken: string;
  authorizationCode?: string;
  /** The server-issued nonce the token was requested with, sent back for the server to redeem. */
  nonce?: string;
};

export type FacebookOAuthPayload = {
  accessToken: string;
};

type SocialLoginModule = { SocialLogin: SocialLoginPlugin };

function readEnv(read: () => string | undefined): string | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

const env = {
  googleClientId: readEnv(() => process.env.GOOGLE_CLIENT_ID),
  googleIosClientId: readEnv(() => process.env.GOOGLE_CLIENT_ID_IOS),
  siteRoot: readEnv(() => process.env.SITE_ROOT),
  appleClientId: readEnv(() => process.env.APPLE_SIGN_IN_CLIENT_ID),
  appleRedirectUri: readEnv(() => process.env.APPLE_SIGN_IN_REDIRECT_URI),
  facebookClientId: readEnv(() => process.env.FACEBOOK_CLIENT_ID),
  facebookClientToken: readEnv(() => process.env.FACEBOOK_CLIENT_TOKEN),
};

let pluginModulePromise: Promise<SocialLoginModule> | undefined;
let initializationPromise: Promise<void> | undefined;

export type SocialLoginErrorKind =
  | 'cancelled'
  | 'configuration'
  | 'network'
  | 'provider';

const SOCIAL_LOGIN_MESSAGES: Record<SocialLoginErrorKind, string> = {
  cancelled: 'Sign-in was cancelled.',
  configuration:
    'Sign-in is not available right now. Please try another sign-in method.',
  network:
    "We couldn't connect to the sign-in service. Check your internet connection and try again.",
  provider:
    "We couldn't complete sign-in. Please try again or use another sign-in method.",
};

export class SocialLoginError extends Error {
  constructor(
    public readonly kind: SocialLoginErrorKind,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'SocialLoginError';
  }
}

function configurationError(detail: string): SocialLoginError {
  return new SocialLoginError(
    'configuration',
    SOCIAL_LOGIN_MESSAGES.configuration,
    new Error(detail)
  );
}

export function resolveGoogleRedirectUri(
  siteRoot: string | undefined,
  platform: string
): string | undefined {
  if (platform !== 'web') return undefined;
  const root = siteRoot?.trim();
  if (!root) {
    throw configurationError('SITE_ROOT is required for Google web login');
  }
  try {
    return new URL('/signin', root).toString();
  } catch (error) {
    throw new SocialLoginError(
      'configuration',
      SOCIAL_LOGIN_MESSAGES.configuration,
      { detail: 'SITE_ROOT is not a valid URL', error }
    );
  }
}

export function classifySocialLoginError(error: unknown): SocialLoginError {
  if (error instanceof SocialLoginError) return error;
  const details =
    error && typeof error === 'object'
      ? [
          error instanceof Error ? error.message : undefined,
          (error as { message?: unknown }).message,
          (error as { error?: unknown }).error,
          (error as { code?: unknown }).code,
          (error as { errorCode?: unknown }).errorCode,
        ]
          .filter((value) => value !== undefined)
          .join(' ')
      : String(error);
  // Each provider SDK phrases a user cancellation differently, including numeric codes.
  if (
    /cancel(?:led|ed|lation)?|popup[_\s-]+(?:was[_\s-]+)?closed(?:[_\s-]+by[_\s-]+user)?|access[_\s-]?denied|user.*denied|dismiss(?:ed|al)?|sign[_\s-]?in[_\s-]?cancelled|user[_\s-]?cancelled[_\s-]?authorize|12501|getcredentialcancellationexception|authorizationerror[^\d]*1001/i.test(
      details
    )
  ) {
    return new SocialLoginError(
      'cancelled',
      SOCIAL_LOGIN_MESSAGES.cancelled,
      error
    );
  }
  if (/network|fetch|offline/i.test(details)) {
    return new SocialLoginError(
      'network',
      SOCIAL_LOGIN_MESSAGES.network,
      error
    );
  }
  return new SocialLoginError(
    'provider',
    SOCIAL_LOGIN_MESSAGES.provider,
    error
  );
}

async function loadPluginModule(): Promise<SocialLoginModule> {
  if (!pluginModulePromise) {
    pluginModulePromise = import('@capgo/capacitor-social-login').catch(
      (error) => {
        pluginModulePromise = undefined;
        throw error;
      }
    );
  }
  return pluginModulePromise;
}

export function initializeSocialLogin(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = loadPluginModule()
      .then(({ SocialLogin }) => {
        const platform = Capacitor.getPlatform();
        const options: InitializeOptions = {};

        if (env.googleClientId) {
          options.google = {
            webClientId: env.googleClientId,
            iOSClientId: env.googleIosClientId,
            iOSServerClientId: env.googleClientId,
            redirectUrl: resolveGoogleRedirectUri(env.siteRoot, platform),
            mode: 'online',
          };
        }
        if (platform === 'ios') {
          options.apple = {};
        } else if (
          platform === 'web' &&
          env.appleClientId &&
          env.appleRedirectUri
        ) {
          options.apple = {
            clientId: env.appleClientId,
            redirectUrl: env.appleRedirectUri,
          };
        }
        if (env.facebookClientId) {
          options.facebook = {
            appId: env.facebookClientId,
            clientToken: env.facebookClientToken,
          };
        }
        return SocialLogin.initialize(options);
      })
      .catch((error) => {
        initializationPromise = undefined;
        throw classifySocialLoginError(error);
      });
  }
  return initializationPromise;
}

export async function resumePendingSocialLoginRedirect(): Promise<boolean> {
  if (typeof globalThis.window === 'undefined') return false;
  let pendingOAuthState: string | null;
  try {
    pendingOAuthState =
      globalThis.localStorage?.getItem('social_login_oauth_pending') ?? null;
  } catch {
    return false;
  }

  const callbackUrl = `${globalThis.location?.search ?? ''}&${
    globalThis.location?.hash ?? ''
  }`;
  const hasResponse = /(?:^|[?#&])(code|access_token|id_token|error)=/i.test(
    callbackUrl
  );
  const hasContext = /(?:^|[?#&])(state|iss)=/i.test(callbackUrl);
  if (
    Capacitor.getPlatform() !== 'web' ||
    pendingOAuthState === null ||
    !globalThis.window.opener ||
    !hasResponse ||
    !hasContext
  ) {
    return false;
  }

  await initializeSocialLogin();
  return true;
}

export function isAppleLoginSupported(): boolean {
  return ['ios', 'web'].includes(Capacitor.getPlatform());
}

/**
 * A random base64url nonce, generated on the device.
 *
 * @deprecated `@_linked/auth` 3 only accepts nonces it issued itself (`createOAuthNonce`), and
 * rejects an Apple sign-in that carries any other nonce. `loginWithApple` no longer uses this.
 */
export function createAppleNonce(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
    ''
  );
  const encoded =
    typeof globalThis.btoa === 'function'
      ? globalThis.btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function buildGoogleLoginOptions(
  platform: string,
  scopes: string[]
): Record<string, never> | { scopes: string[] } {
  // Android rejects a caller-supplied scopes list and uses the plugin default.
  return platform === 'android' ? {} : { scopes };
}

export async function loginWithGoogle(
  scopes = ['email', 'profile']
): Promise<GoogleOAuthPayload> {
  if (!env.googleClientId) {
    throw configurationError('GOOGLE_CLIENT_ID is not configured');
  }
  await initializeSocialLogin();
  try {
    const { result } = await (
      await loadPluginModule()
    ).SocialLogin.login({
      provider: 'google',
      options: buildGoogleLoginOptions(Capacitor.getPlatform(), scopes),
    });
    if (result.responseType !== 'online' || !result.idToken) {
      throw new Error('Google login did not return an ID token');
    }
    return { authentication: { idToken: result.idToken } };
  } catch (error) {
    throw classifySocialLoginError(error);
  }
}

/**
 * Run the Apple sign-in prompt.
 *
 * @param nonce a nonce from `useAuth().createOAuthNonce()`. Apple puts it in the identity token
 *   and it is returned in the payload, so the server can check it issued the nonce and redeem it
 *   once. Without one the token carries no nonce, which `@_linked/auth` only accepts while
 *   `AUTH_APPLE_NONCE` is `optional`. Do not pass a nonce the server did not issue: the server
 *   rejects it.
 */
export async function loginWithApple(
  scopes = ['email', 'name'],
  nonce?: string
): Promise<AppleOAuthPayload> {
  if (!isAppleLoginSupported()) {
    throw new SocialLoginError(
      'configuration',
      'Apple sign-in is not available on this device.'
    );
  }
  if (Capacitor.getPlatform() === 'web') {
    if (!env.appleClientId) {
      throw configurationError('APPLE_SIGN_IN_CLIENT_ID is not configured');
    }
    if (!env.appleRedirectUri) {
      throw configurationError('APPLE_SIGN_IN_REDIRECT_URI is not configured');
    }
  }
  await initializeSocialLogin();
  try {
    const { result } = await (
      await loadPluginModule()
    ).SocialLogin.login({
      provider: 'apple',
      options: nonce ? { scopes, nonce } : { scopes },
    });
    if (!result.idToken) {
      throw new Error('Apple login did not return an ID token');
    }
    return {
      email: result.profile.email,
      givenName: result.profile.givenName,
      familyName: result.profile.familyName,
      identityToken: result.idToken,
      authorizationCode: result.authorizationCode,
      ...(nonce ? { nonce } : {}),
    };
  } catch (error) {
    throw classifySocialLoginError(error);
  }
}

/** The part of `useAuth()` an Apple sign-in needs. */
export type AppleSigninAuth = {
  createOAuthNonce: () => Promise<{ nonce: string }>;
  signinOAuth: (provider: 'apple', payload: AppleOAuthPayload) => Promise<any>;
};

/**
 * Sign in with Apple the way `@_linked/auth` 3 verifies it: ask the server for a single-use
 * nonce, request the identity token with it, and send both back to `signinOAuth`.
 *
 * @param login the prompt to run; replaceable for tests
 */
export async function signinWithApple(
  auth: AppleSigninAuth,
  scopes = ['email', 'name'],
  login: typeof loginWithApple = loginWithApple
) {
  const { nonce } = await auth.createOAuthNonce();
  const payload = await login(scopes, nonce);
  return auth.signinOAuth('apple', payload);
}

export async function loginWithFacebook(
  permissions = ['email', 'public_profile']
): Promise<FacebookOAuthPayload> {
  if (!env.facebookClientId) {
    throw configurationError('FACEBOOK_CLIENT_ID is not configured');
  }
  await initializeSocialLogin();
  try {
    const { result } = await (
      await loadPluginModule()
    ).SocialLogin.login({
      provider: 'facebook',
      options: { permissions, limitedLogin: false },
    });
    if (!result.accessToken?.token) {
      throw new Error('Facebook login did not return an access token');
    }
    return { accessToken: result.accessToken.token };
  } catch (error) {
    throw classifySocialLoginError(error);
  }
}
