// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMandatoryNativeUpdate } from '../src/hooks/useMandatoryNativeUpdate.js';

const runtime = vi.hoisted(() => ({
  platform: 'ios' as 'web' | 'ios' | 'android',
  version: '4.3.6',
  listeners: [] as Array<(event: { isActive: boolean }) => void>,
  getInfo: vi.fn(async () => ({ version: '4.3.6' })),
  openAppStore: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => runtime.platform,
    isNativePlatform: () => runtime.platform !== 'web',
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    getInfo: () => runtime.getInfo(),
    addListener: vi.fn(async (_event, listener) => {
      runtime.listeners.push(listener);
      return {
        remove: async () => {
          runtime.listeners = runtime.listeners.filter(
            (candidate) => candidate !== listener
          );
        },
      };
    }),
  },
}));

vi.mock('@capawesome/capacitor-app-update', () => ({
  AppUpdate: {
    getAppUpdateInfo: vi.fn(),
    performImmediateUpdate: vi.fn(),
    openAppStore: (...args: unknown[]) => runtime.openAppStore(...args),
  },
  AppUpdateResultCode: { OK: 0 },
}));

describe('useMandatoryNativeUpdate lifecycle', () => {
  beforeEach(() => {
    runtime.platform = 'ios';
    runtime.version = '4.3.6';
    runtime.listeners = [];
    runtime.getInfo.mockReset();
    runtime.getInfo.mockImplementation(async () => ({
      version: runtime.version,
    }));
    runtime.openAppStore.mockReset();
    vi.clearAllMocks();
  });

  it('reads App.getInfo on mount and stays not-native on web', async () => {
    runtime.platform = 'web';
    const { result } = renderHook(() =>
      useMandatoryNativeUpdate({ fallbackMinimumVersion: '4.3.4' })
    );
    expect(result.current.state.status).toBe('not-native');
    expect(runtime.getInfo).not.toHaveBeenCalled();
  });

  it('marks an outdated installed binary as required', async () => {
    runtime.version = '4.3.5';
    const { result } = renderHook(() =>
      useMandatoryNativeUpdate({
        fallbackMinimumVersion: '4.3.4',
        minimumVersion: '4.4.0',
        iosAppStoreId: '1234567890',
      })
    );
    await waitFor(() => expect(result.current.state.status).toBe('required'));
    expect(runtime.getInfo).toHaveBeenCalled();
    expect(result.current.state).toMatchObject({
      currentVersion: '4.3.5',
      minimumVersion: '4.4.0',
    });
  });

  it('rechecks on foreground and when the minimum changes', async () => {
    runtime.version = '4.3.6';
    const { result, rerender } = renderHook(
      ({ minimumVersion }) =>
        useMandatoryNativeUpdate({
          fallbackMinimumVersion: '4.3.4',
          minimumVersion,
          iosAppStoreId: '1234567890',
        }),
      { initialProps: { minimumVersion: '4.3.4' } }
    );
    await waitFor(() => expect(result.current.state.status).toBe('supported'));

    runtime.version = '4.3.6';
    rerender({ minimumVersion: '4.4.0' });
    await waitFor(() => expect(result.current.state.status).toBe('required'));

    runtime.version = '4.4.0';
    await act(async () => {
      runtime.listeners.forEach((listener) => listener({ isActive: true }));
    });
    await waitFor(() => expect(result.current.state.status).toBe('supported'));
    expect(runtime.getInfo.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('ignores a stale App.getInfo result after a newer check', async () => {
    let resolveOld!: (value: { version: string }) => void;
    let resolveNew!: (value: { version: string }) => void;
    runtime.getInfo
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNew = resolve;
          })
      );

    const { result } = renderHook(() =>
      useMandatoryNativeUpdate({
        fallbackMinimumVersion: '4.3.4',
        minimumVersion: '4.4.0',
        iosAppStoreId: '1234567890',
      })
    );
    await act(async () => {
      result.current.retryCheck();
    });
    await act(async () => {
      resolveNew({ version: '4.4.0' });
    });
    await waitFor(() => expect(result.current.state.status).toBe('supported'));
    await act(async () => {
      resolveOld({ version: '4.3.0' });
    });
    expect(result.current.state.status).toBe('supported');
  });

  it('surfaces getInfo failures and recovers through retry', async () => {
    runtime.getInfo
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce({ version: '4.4.0' });
    const { result } = renderHook(() =>
      useMandatoryNativeUpdate({
        fallbackMinimumVersion: '4.3.4',
        minimumVersion: '4.4.0',
      })
    );
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    await act(async () => {
      await result.current.retryCheck();
    });
    await waitFor(() => expect(result.current.state.status).toBe('supported'));
  });

  it('opens the App Store for a required iOS update', async () => {
    runtime.version = '4.3.5';
    const { result } = renderHook(() =>
      useMandatoryNativeUpdate({
        fallbackMinimumVersion: '4.3.4',
        minimumVersion: '4.4.0',
        iosAppStoreId: '1234567890',
      })
    );
    await waitFor(() => expect(result.current.state.status).toBe('required'));
    await act(async () => {
      await result.current.requestUpdate();
    });
    expect(runtime.openAppStore).toHaveBeenCalledWith({ appId: '1234567890' });
  });
});
