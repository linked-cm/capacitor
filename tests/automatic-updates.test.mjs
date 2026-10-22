import assert from 'node:assert/strict';
import test from 'node:test';

import { getDownloadOptions } from '../lib/esm/hooks/useAutomaticUpdates.js';

test('forwards integrity and delivery metadata from getLatest to download', () => {
  const manifest = [
    {
      file_name: 'assets/index.js',
      file_hash: 'file-checksum',
      download_url: 'https://updates.example/assets/index.js',
    },
  ];

  assert.deepEqual(
    getDownloadOptions({
      url: 'https://updates.example/bundle.zip',
      version: '4.3.2',
      checksum: 'bundle-checksum',
      sessionKey: 'encrypted-session-key',
      manifest,
    }),
    {
      url: 'https://updates.example/bundle.zip',
      version: '4.3.2',
      checksum: 'bundle-checksum',
      sessionKey: 'encrypted-session-key',
      manifest,
    }
  );
});

test('keeps optional download metadata optional', () => {
  assert.deepEqual(
    getDownloadOptions({
      url: 'https://updates.example/bundle.zip',
      version: '4.3.2',
    }),
    {
      url: 'https://updates.example/bundle.zip',
      version: '4.3.2',
      checksum: undefined,
      sessionKey: undefined,
      manifest: undefined,
    }
  );
});
