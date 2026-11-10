// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReleaseGate } from '../src/hooks/useReleaseGate.js';
import type { ReleaseStatus } from '../src/utils/releaseStatus.js';

const runtime = vi.hoisted(() => ({
  platform: 'web' as 'web' | 'ios' | 'android',
  version: '4.3.6',
  listeners: [] as Array<(event: { isActive: boolean }) => void>,
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => runtime.platform,
    isNativePlatform: () => runtime.platform !== 'web',
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    getInfo: vi.fn(async () => ({ version: runtime.version })),
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
    openAppStore: vi.fn(),
  },
  AppUpdateResultCode: { OK: 0 },
}));

const supported: ReleaseStatus = {
  minimumVersion: '4.3.6',
  maintenanceMode: false,
  maintenancePlatform: 'all',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  warnSpy.mockRestore();
});

beforeEach(() => {
  runtime.platform = 'web';
  runtime.version = '4.3.6';
  runtime.listeners = [];
  vi.clearAllMocks();
});

describe('useReleaseGate lifecycle', () => {
  it('renders web as supported while status loads, then applies maintenance', async () => {
    const request = deferred<ReleaseStatus>();
    const { result } = renderHook(() =>
      useReleaseGate({
        loadStatus: () => request.promise,
        fallbackMinimumVersion: '4.3.6',
      })
    );
    expect(result.current.state.status).toBe('supported');
    expect(result.current.otaEnabled).toBe(true);
    request.resolve({
      ...supported,
      maintenanceMode: true,
      maintenancePlatform: 'web',
    });
    await waitFor(() => expect(result.current.state.status).toBe('maintenance'));
  });

  it('prioritizes native maintenance over a required binary update', async () => {
    runtime.platform = 'android';
    runtime.version = '4.3.5';
    const { result } = renderHook(() =>
      useReleaseGate({
        loadStatus: async () => ({
          ...supported,
          maintenanceMode: true,
          maintenancePlatform: 'native',
        }),
        fallbackMinimumVersion: '4.3.6',
      })
    );
    await waitFor(() => expect(result.current.state.status).toBe('maintenance'));
    expect(result.current.otaEnabled).toBe(false);
  });

  it('refreshes status and installed version on native foreground', async () => {
    runtime.platform = 'ios';
    let minimumVersion = '4.3.6';
    const loadStatus = vi.fn(async () => ({ ...supported, minimumVersion }));
    const { result } = renderHook(() =>
      useReleaseGate({
        loadStatus,
        fallbackMinimumVersion: '4.3.6',
      })
    );
    await waitFor(() => expect(result.current.otaEnabled).toBe(true));
    minimumVersion = '4.4.0';
    await act(async () => {
      runtime.listeners.forEach((listener) => listener({ isActive: true }));
    });
    await waitFor(() => expect(result.current.state.status).toBe('required'));
    expect(loadStatus).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale status request completed after retry', async () => {
    const oldRequest = deferred<ReleaseStatus>();
    const newRequest = deferred<ReleaseStatus>();
    const loadStatus = vi
      .fn<() => Promise<ReleaseStatus>>()
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    const { result } = renderHook(() =>
      useReleaseGate({
        loadStatus,
        fallbackMinimumVersion: '4.3.6',
      })
    );
    let retry!: Promise<void>;
    act(() => {
      retry = result.current.retryCheck();
    });
    newRequest.resolve({
      ...supported,
      maintenanceMode: true,
      maintenancePlatform: 'web',
    });
    await act(async () => retry);
    expect(result.current.state.status).toBe('maintenance');
    oldRequest.resolve(supported);
    await act(async () => oldRequest.promise);
    expect(result.current.state.status).toBe('maintenance');
  });

  it('recovers from an initial status error through manual retry', async () => {
    const loadStatus = vi
      .fn<() => Promise<ReleaseStatus>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        ...supported,
        maintenanceMode: true,
        maintenancePlatform: 'web',
      });
    const { result } = renderHook(() =>
      useReleaseGate({
        loadStatus,
        fallbackMinimumVersion: '4.3.6',
      })
    );
    await waitFor(() => expect(loadStatus).toHaveBeenCalledTimes(1));
    await act(async () => result.current.retryCheck());
    expect(result.current.state.status).toBe('maintenance');
  });
});

