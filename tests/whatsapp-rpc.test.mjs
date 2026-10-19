import assert from 'node:assert/strict';
import test from 'node:test';

import { getOwnCallableLevel } from '@_linked/server-utils/utils/callable';
import CapacitorBackendProvider from '../lib/esm/backend.js';

test('WhatsApp OTP endpoints are callable before authentication', () => {
  assert.equal(
    getOwnCallableLevel(CapacitorBackendProvider, 'generateOTPWhatsapp'),
    'public'
  );
  assert.equal(
    getOwnCallableLevel(CapacitorBackendProvider, 'validateOTPWhatsapp'),
    'public'
  );
});

test('WhatsApp OTP generation does not log the plaintext code', () => {
  assert.doesNotMatch(
    CapacitorBackendProvider.prototype.generateOTPWhatsapp.toString(),
    /console\.log\(['"]OTP/
  );
});
