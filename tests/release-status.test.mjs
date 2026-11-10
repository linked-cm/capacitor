import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isMaintenanceApplicable,
  normalizeReleaseStatus,
  pickReleaseStatus,
  toStatusResponse,
  tryNormalizeReleaseStatus,
} from '../lib/esm/utils/releaseStatus.js';
import {
  createReleaseStatusHandler,
  ReleaseStatusCache,
} from '../lib/esm/utils/releaseStatusCache.js';
import { ReleaseStatusClient } from '../lib/esm/utils/releaseStatusClient.js';

const supported = {
  minimumVersion: '4.3.6',
  maintenanceMode: false,
  maintenancePlatform: 'all',
};

test('release status normalizes optional fields and rejects invalid versions', () => {
  assert.deepEqual(normalizeReleaseStatus({ minimumVersion: ' 4.3.6 ' }), supported);
  assert.throws(
    () => normalizeReleaseStatus({ minimumVersion: '4.3.6-beta.1' }),
    /stable X\.Y\.Z/
  );
  assert.throws(
    () =>
      normalizeReleaseStatus(
        { minimumVersion: null },
        { defaultMinimumVersion: '4.3.4' }
      ),
    /stable X\.Y\.Z/
  );
  assert.deepEqual(
    normalizeReleaseStatus({}, { defaultMinimumVersion: '4.3.4' }),
    {
      minimumVersion: '4.3.4',
      maintenanceMode: false,
      maintenancePlatform: 'all',
    }
  );
});

test('maintenance targeting distinguishes web, native, and exact platforms', () => {
  assert.equal(
    isMaintenanceApplicable(
      { maintenanceMode: true, maintenancePlatform: 'native' },
      'web'
    ),
    false
  );
  assert.equal(
    isMaintenanceApplicable(
      { maintenanceMode: true, maintenancePlatform: 'native' },
      'android'
    ),
    true
  );
  assert.equal(
    isMaintenanceApplicable(
      { maintenanceMode: true, maintenancePlatform: 'ios' },
      'android'
    ),
    false
  );
});

test('server cache retains the last valid snapshot and handler disables caching', () => {
  let value = { ...supported, minimumVersion: '4.4.0' };
  const warnings = [];
  const cache = new ReleaseStatusCache({
    initialStatus: supported,
    readStatus: () => value,
    log: (...args) => warnings.push(args),
  });
  assert.equal(cache.load().minimumVersion, '4.4.0');
  value = { ...supported, minimumVersion: 'invalid' };
  assert.equal(cache.load().minimumVersion, '4.4.0');
  assert.equal(warnings.length, 1);

  const headers = {};
  let statusCode;
  let body;
  createReleaseStatusHandler(cache)(null, {
    setHeader: (name, headerValue) => {
      headers[name] = headerValue;
    },
    status: (code) => {
      statusCode = code;
      return { json: (next) => (body = next) };
    },
  });
  assert.equal(statusCode, 200);
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.deepEqual(body, cache.getStatus());
});

test('status client deduplicates concurrent requests and retains valid data', async () => {
  let calls = 0;
  let fail = false;
  const client = new ReleaseStatusClient({
    url: '/status',
    fetch: async () => {
      calls += 1;
      if (fail) throw new Error('offline');
      return {
        ok: true,
        json: async () => supported,
      };
    },
  });
  const [first, second] = await Promise.all([client.load(), client.load()]);
  assert.deepEqual(first, supported);
  assert.deepEqual(second, supported);
  assert.equal(calls, 1);
  fail = true;
  assert.deepEqual(await client.load(), supported);
});


test('tryNormalizeReleaseStatus reports validation failures without throwing', () => {
  assert.deepEqual(tryNormalizeReleaseStatus(supported), {
    ok: true,
    value: supported,
  });
  const failed = tryNormalizeReleaseStatus({ minimumVersion: '4' });
  assert.equal(failed.ok, false);
  assert.match(failed.error, /stable X\.Y\.Z/);
});

test('pickReleaseStatus and toStatusResponse normalize owned fields only', () => {
  assert.deepEqual(
    pickReleaseStatus(
      {
        minimumVersion: '4.3.6',
        maintenanceMode: true,
        maintenancePlatform: 'native',
        maintenanceMessage: '  later  ',
        unrelated: true,
      },
      { defaultMinimumVersion: '4.3.4' }
    ),
    {
      minimumVersion: '4.3.6',
      maintenanceMode: true,
      maintenancePlatform: 'native',
      maintenanceMessage: 'later',
    }
  );
  assert.deepEqual(toStatusResponse(supported), supported);
});
