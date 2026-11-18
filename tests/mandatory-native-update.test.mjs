import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareNativeVersions,
  effectiveMinimumVersion,
  nativeUpdateRequirement,
  openRequiredNativeUpdate,
} from '../lib/esm/hooks/useMandatoryNativeUpdate.js';
import { resolveAutomaticUpdateOptions } from '../lib/esm/hooks/useAutomaticUpdates.js';

test('compares stable native versions numerically', () => {
  assert.equal(compareNativeVersions('4.10.0', '4.9.9'), 1);
  assert.equal(compareNativeVersions('4.3.6', '4.3.6'), 0);
  assert.equal(compareNativeVersions('4.3.5', '4.3.6'), -1);
  assert.throws(
    () => compareNativeVersions('4.3.6-beta.1', '4.3.6'),
    /stable X\.Y\.Z/
  );
});

test('server minimum cannot lower the compiled fallback', () => {
  assert.equal(effectiveMinimumVersion('4.3.4', '4.3.0'), '4.3.4');
  assert.equal(effectiveMinimumVersion('4.3.4', '4.4.0'), '4.4.0');
  assert.equal(effectiveMinimumVersion('4.3.4'), '4.3.4');
  assert.equal(effectiveMinimumVersion('4.3.4', 'invalid'), '4.3.4');
});

test('installed binary is checked against the effective minimum', () => {
  assert.deepEqual(nativeUpdateRequirement('4.3.6', '4.3.4', '4.4.0'), {
    supported: false,
    minimumVersion: '4.4.0',
  });
  assert.deepEqual(nativeUpdateRequirement('4.3.6', '4.3.4', '4.3.0'), {
    supported: true,
    minimumVersion: '4.3.4',
  });
});

test('automatic updates preserve defaults and accept explicit gating', () => {
  assert.deepEqual(resolveAutomaticUpdateOptions(), {
    enabled: true,
    checkNativeStoreVersion: true,
  });
  assert.deepEqual(
    resolveAutomaticUpdateOptions({
      enabled: false,
      checkNativeStoreVersion: false,
    }),
    { enabled: false, checkNativeStoreVersion: false }
  );
});

test('Android immediate update avoids opening Google Play when successful', async () => {
  const calls = [];
  await openRequiredNativeUpdate(
    { platform: 'android', androidPackageName: 'example.app' },
    {
      getAppUpdateInfo: async () => ({ immediateUpdateAllowed: true }),
      performImmediateUpdate: async () => {
        calls.push('immediate');
        return { code: 0 };
      },
      openAppStore: async () => calls.push('store'),
    }
  );
  assert.deepEqual(calls, ['immediate']);
});

test('Android cancellation falls back to Google Play', async () => {
  const stores = [];
  await openRequiredNativeUpdate(
    { platform: 'android', androidPackageName: 'example.app' },
    {
      getAppUpdateInfo: async () => ({ immediateUpdateAllowed: true }),
      performImmediateUpdate: async () => ({ code: 1 }),
      openAppStore: async (options) => stores.push(options),
    }
  );
  assert.deepEqual(stores, [{ androidPackageName: 'example.app' }]);
});

test('iOS opens the configured numeric App Store id', async () => {
  const stores = [];
  await openRequiredNativeUpdate(
    { platform: 'ios', iosAppStoreId: '1234567890' },
    {
      getAppUpdateInfo: async () => ({}),
      performImmediateUpdate: async () => ({ code: 0 }),
      openAppStore: async (options) => stores.push(options),
    }
  );
  assert.deepEqual(stores, [{ appId: '1234567890' }]);
});
