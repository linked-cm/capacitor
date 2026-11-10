// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  notifyAppReady: vi.fn(async () => undefined),
  getChannel: vi.fn(async () => ({ channel: 'production', allowSet: false })),
  setChannel: vi.fn(async () => undefined),
  getLatest: vi.fn(async () => ({ error: 'no new version available' })),
  getAppUpdateInfo: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'ios',
    isNativePlatform: () => true,
  },
}));

vi.mock('@capgo/capacitor-updater', () => ({
  CapacitorUpdater: {
    notifyAppReady: (...args: unknown[]) => mocks.notifyAppReady(...args),
    getChannel: (...args: unknown[]) => mocks.getChannel(...args),
    setChannel: (...args: unknown[]) => mocks.setChannel(...args),
    getLatest: (...args: unknown[]) => mocks.getLatest(...args),
    addListener: vi.fn(async () => ({ remove: vi.fn() })),
    download: vi.fn(),
    set: vi.fn(),
    reload: vi.fn(),
  },
}));

vi.mock('@capawesome/capacitor-app-update', () => ({
  AppUpdate: {
    getAppUpdateInfo: (...args: unknown[]) => mocks.getAppUpdateInfo(...args),
    performImmediateUpdate: vi.fn(),
    openAppStore: vi.fn(),
  },
  AppUpdateAvailability: { UPDATE_AVAILABLE: 2 },
  AppUpdateResultCode: { OK: 0 },
}));

vi.mock('@capacitor/dialog', () => ({
  Dialog: { confirm: vi.fn() },
}));

import { useAutomaticUpdates } from '../src/hooks/useAutomaticUpdates.js';

describe('useAutomaticUpdates gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SITE_ROOT = 'https://example.test';
  });

  it('still confirms Capgo readiness when OTA work is paused', async () => {
    renderHook(() =>
      useAutomaticUpdates({
        enabled: false,
        checkNativeStoreVersion: false,
      })
    );

    await waitFor(() => expect(mocks.notifyAppReady).toHaveBeenCalledOnce());
    expect(mocks.getChannel).not.toHaveBeenCalled();
    expect(mocks.getLatest).not.toHaveBeenCalled();
    expect(mocks.getAppUpdateInfo).not.toHaveBeenCalled();
  });
});
