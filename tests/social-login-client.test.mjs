import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildGoogleLoginOptions,
  createAppleNonce,
  classifySocialLoginError,
  resolveGoogleRedirectUri,
  signinWithApple,
} from '../lib/esm/auth/SocialLoginClient.js';

test('resolves the Google web callback from SITE_ROOT', () => {
  assert.equal(
    resolveGoogleRedirectUri('https://example.com/', 'web'),
    'https://example.com/signin'
  );
  assert.equal(resolveGoogleRedirectUri(undefined, 'android'), undefined);
  assert.throws(
    () => resolveGoogleRedirectUri(undefined, 'web'),
    (error) => error?.kind === 'configuration'
  );
});

test('omits custom Google scopes on Android', () => {
  assert.deepEqual(buildGoogleLoginOptions('android', ['email']), {});
  assert.deepEqual(buildGoogleLoginOptions('ios', ['email']), {
    scopes: ['email'],
  });
});

test('keeps the SocialLogin proxy nested inside the imported module', async () => {
  const source = await readFile(
    new URL('../lib/esm/auth/SocialLoginClient.js', import.meta.url),
    'utf8'
  );
  assert.match(source, /pluginModulePromise\s*=\s*import\(['"]@capgo\/capacitor-social-login['"]\)/);
  assert.doesNotMatch(source, /return\s+SocialLogin\s*;/);
});

test('creates a 32-byte base64url Apple nonce without padding', () => {
  assert.match(createAppleNonce(), /^[A-Za-z0-9_-]{43}$/);
});

test('classifies cancellation and network failures', () => {
  for (const cancellation of [
    new Error('User cancelled'),
    new Error('Popup closed'),
    new Error('popup_closed_by_user'),
    { error: 'user_cancelled_authorize' },
    new Error(
      'The operation couldn’t be completed. (AuthenticationServices.AuthorizationError error 1001.)'
    ),
    new Error('access_denied'),
    { message: 'The user dismissed the sign-in dialog' },
    { code: 12501, message: 'Google Sign-In failed' },
    { errorCode: 'GetCredentialCancellationException' },
  ]) {
    assert.equal(classifySocialLoginError(cancellation).kind, 'cancelled');
  }
  assert.equal(
    classifySocialLoginError(new Error('Network offline')).kind,
    'network'
  );
  assert.match(
    classifySocialLoginError(new Error('Network offline')).message,
    /internet connection/i
  );
  assert.equal(
    classifySocialLoginError(new Error('Invalid client configuration')).kind,
    'provider'
  );
  assert.equal(
    classifySocialLoginError(new Error('Invalid client configuration')).message,
    "We couldn't complete sign-in. Please try again or use another sign-in method."
  );
});

for (const provider of ['Apple', 'Google', 'Facebook']) {
  test(`${provider} button guards duplicate login and forwards direct props`, async () => {
    const source = await readFile(
      new URL(
        `../lib/esm/components/SigninWith${provider}Button.js`,
        import.meta.url
      ),
      'utf8'
    );
    assert.match(source, /loginInFlight\.current/);
    assert.match(source, /if \(result\)\s+onCallback\(result\)/);
    assert.match(source, /\.\.\.buttonProps/);
    assert.match(source, /disabled:\s*loading\s*\|\|\s*disabledByCaller/);
    assert.ok(
      source.indexOf('onClick:') > source.indexOf('...buttonProps'),
      'forwarded props must not override the internal login handler'
    );
    assert.ok(
      source.indexOf('onCallback(result)') > source.indexOf('finally'),
      'consumer callback must run outside provider error classification'
    );
  });
}

test('signs in with Apple using the nonce the server issued', async () => {
  const calls = [];
  const auth = {
    createOAuthNonce: async () => {
      calls.push('createOAuthNonce');
      return { nonce: 'server.nonce.hmac', expiresAt: '2030-01-01T00:00:00Z' };
    },
    signinOAuth: async (provider, payload) => {
      calls.push(['signinOAuth', provider, payload]);
      return { auth: {}, accessToken: 'a' };
    },
  };
  const login = async (scopes, nonce) => {
    calls.push(['login', scopes, nonce]);
    return { identityToken: 'token', nonce };
  };

  const result = await signinWithApple(auth, ['email'], login);

  assert.deepEqual(result, { auth: {}, accessToken: 'a' });
  assert.deepEqual(calls, [
    'createOAuthNonce',
    ['login', ['email'], 'server.nonce.hmac'],
    ['signinOAuth', 'apple', { identityToken: 'token', nonce: 'server.nonce.hmac' }],
  ]);
});

test('Apple sign-in never sends a nonce generated on the device', async () => {
  const source = await readFile(
    new URL('../lib/esm/auth/SocialLoginClient.js', import.meta.url),
    'utf8'
  );
  const loginWithApple = source.slice(
    source.indexOf('export async function loginWithApple'),
    source.indexOf('export async function signinWithApple')
  );
  assert.doesNotMatch(loginWithApple, /createAppleNonce\(/);
  const button = await readFile(
    new URL('../lib/esm/components/SigninWithAppleButton.js', import.meta.url),
    'utf8'
  );
  assert.match(button, /signinWithApple\(auth,/);
});

test('WhatsApp sign-in passes the refresh token expiry to updateAuth', async () => {
  const source = await readFile(
    new URL('../lib/esm/components/SignInWithWhatsapp.js', import.meta.url),
    'utf8'
  );
  assert.match(source, /refreshTokenExpiresIn:\s*response\.refreshTokenExpiresIn/);
  assert.match(source, /refreshTokenExpiresAt:\s*response\.refreshTokenExpiresAt/);
});
