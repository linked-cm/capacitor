import assert from 'node:assert/strict';
import test from 'node:test';
import CapacitorBackendProvider from '../lib/esm/backend.js';

const makeProvider = (session = {}) => {
  const provider = Object.create(CapacitorBackendProvider.prototype);
  Object.defineProperty(provider, 'request', { value: { session } });
  provider.generateOTP = () => 123456;
  return provider;
};

const setEnv = (t, key, value) => {
  const previous = process.env[key];
  process.env[key] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  });
};

const configureSend = (t) => {
  setEnv(t, 'WA_D360_API_KEY', 'test-key');
  setEnv(t, 'WA_D360_USERNAME', 'wa-user');
  setEnv(t, 'WA_D360_PASSWORD', 'wa-password');
  setEnv(t, 'WA_D360_TEMPLATE_NAMESPACE', 'test-namespace');
  setEnv(t, 'WA_D360_TEMPLATE_NAME', 'authentication_test');
};

test('WhatsApp send uses the API key and configured authentication template', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).endsWith('/token')) {
      assert.equal(JSON.parse(options.body).username, 'wa-user');
      return { ok: true, json: async () => ({ access_token: 'token-1' }) };
    }
    const payload = JSON.parse(options.body);
    assert.equal(options.headers['D360-API-KEY'], 'test-key');
    assert.equal(options.headers.Authorization, 'bearer token-1');
    assert.equal(payload.template.namespace, 'test-namespace');
    assert.equal(payload.template.name, 'authentication_test');
    assert.equal(payload.to, '15551234567');
    assert.equal(payload.template.language.code, 'en');
    assert.equal(payload.template.language.policy, 'deterministic');
    assert.equal(payload.template.components[0].parameters[0].text, 123456);
    assert.equal(payload.template.components[1].parameters[0].text, '123456');
    return { ok: true, json: async () => ({ messages: [{ id: 'test-message' }] }) };
  });
  t.mock.method(console, 'log', () => {
    throw new Error('OTP must never be logged');
  });
  configureSend(t);
  const provider = makeProvider();
  assert.deepEqual(await provider.generateOTPWhatsapp('+1 555 123 4567'), { sent: true });
  assert.equal(provider.request.session.otp, 123456);
});

test('a rejected WhatsApp resend invalidates the earlier OTP', async (t) => {
  configureSend(t);
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).endsWith('/token')) {
      return { ok: true, json: async () => ({ access_token: 'token-1' }) };
    }
    return { ok: false, status: 401, json: async () => ({}) };
  });
  t.mock.method(console, 'error', () => {});
  const provider = makeProvider({ otp: 654321 });
  await assert.rejects(
    provider.generateOTPWhatsapp('15551234567'),
    /Could not send the code/
  );
  assert.equal(provider.request.session.otp, undefined);
});

test('an accepted WhatsApp send without a message id still returns the code entry step', async (t) => {
  configureSend(t);
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).endsWith('/token')) {
      return { ok: true, json: async () => ({ access_token: 'token-1' }) };
    }
    return { ok: true, json: async () => ({}) };
  });
  t.mock.method(console, 'error', () => {});
  const provider = makeProvider({ otp: 654321 });
  assert.deepEqual(await provider.generateOTPWhatsapp('15551234567'), { sent: true });
  assert.equal(provider.request.session.otp, 123456);
});
