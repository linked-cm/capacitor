import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  effectiveMinimumVersion,
  useMandatoryNativeUpdate,
} from './useMandatoryNativeUpdate.js';
import {
  isMaintenanceApplicable,
  type ReleaseStatus,
  type RuntimePlatform,
} from '../utils/releaseStatus.js';

export type ReleaseGateState =
  | { status: 'checking' }
  | { status: 'maintenance'; message?: string }
  | {
      status: 'supported';
      currentVersion?: string;
    }
  | {
      status: 'required';
      platform: 'ios' | 'android';
      currentVersion: string;
      minimumVersion: string;
      updating: boolean;
      error?: string;
    }
  | { status: 'error'; minimumVersion: string; error: string };

export type UseReleaseGateOptions = {
  loadStatus: () => Promise<ReleaseStatus>;
  fallbackMinimumVersion: string;
  iosAppStoreId?: string;
  androidPackageName?: string;
};

export type ReleaseGateResult = {
  state: ReleaseGateState;
  store?: 'App Store' | 'Google Play';
  otaEnabled: boolean;
  requestUpdate: () => Promise<void>;
  retryCheck: () => Promise<void>;
};

/**
 * Headless release gate. Status loading never delays application rendering;
 * consumers decide how to present maintenance and mandatory-update states.
 */
export function useReleaseGate({
  loadStatus,
  fallbackMinimumVersion,
  iosAppStoreId,
  androidPackageName,
}: UseReleaseGateOptions): ReleaseGateResult {
  const capacitorPlatform = Capacitor.getPlatform();
  const platform: RuntimePlatform =
    capacitorPlatform === 'ios' || capacitorPlatform === 'android'
      ? capacitorPlatform
      : 'web';
  const isNative = platform !== 'web';
  const [releaseStatus, setReleaseStatus] = useState<ReleaseStatus>();
  const [statusSettled, setStatusSettled] = useState(false);
  // Ignore stale async status results after a newer refresh/unmount.
  const loadSequence = useRef(0);
  // Keep the latest loader without re-subscribing the effect every render.
  const loadStatusRef = useRef(loadStatus);
  loadStatusRef.current = loadStatus;
  const nativeUpdate = useMandatoryNativeUpdate({
    minimumVersion: releaseStatus?.minimumVersion,
    fallbackMinimumVersion,
    iosAppStoreId,
    androidPackageName,
  });

  const refresh = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setStatusSettled(false);
    try {
      const next = await loadStatusRef.current();
      if (sequence === loadSequence.current) setReleaseStatus(next);
    } catch (error) {
      console.warn('Unable to load release status; using safe fallback:', error);
    } finally {
      if (sequence === loadSequence.current) setStatusSettled(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!isNative) return;
    let disposed = false;
    let removeListener: (() => Promise<void>) | undefined;
    void NativeApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void refresh();
    })
      .then((handle) => {
        if (disposed) void handle.remove();
        else removeListener = handle.remove;
      })
      .catch((error) => {
        console.error('Unable to register the release status listener:', error);
      });
    return () => {
      disposed = true;
      loadSequence.current += 1;
      if (removeListener) void removeListener();
    };
  }, [isNative, refresh]);

  const state = useMemo<ReleaseGateState>(() => {
    if (releaseStatus && isMaintenanceApplicable(releaseStatus, platform)) {
      return {
        status: 'maintenance',
        ...(releaseStatus.maintenanceMessage
          ? { message: releaseStatus.maintenanceMessage }
          : {}),
      };
    }
    if (!isNative || nativeUpdate.state.status === 'not-native') {
      return { status: 'supported' };
    }
    if (nativeUpdate.state.status === 'error') {
      return {
        status: 'error',
        minimumVersion: nativeUpdate.state.minimumVersion,
        error: nativeUpdate.state.error,
      };
    }
    return nativeUpdate.state;
  }, [isNative, nativeUpdate.state, platform, releaseStatus]);

  const retryCheck = useCallback(async () => {
    await refresh();
    await nativeUpdate.retryCheck();
  }, [nativeUpdate.retryCheck, refresh]);

  const expectedMinimum = effectiveMinimumVersion(
    fallbackMinimumVersion,
    releaseStatus?.minimumVersion
  );
  // Pause OTA until status has settled and the native check used the same
  // effective minimum; otherwise a fast App.getInfo() can enable OTA before
  // the server minimum arrives or while a previous minimum is still showing.
  const otaEnabled =
    !isNative ||
    (statusSettled &&
      nativeUpdate.state.status === 'supported' &&
      nativeUpdate.state.minimumVersion === expectedMinimum);

  return useMemo(
    () => ({
      state,
      store:
        platform === 'ios'
          ? ('App Store' as const)
          : platform === 'android'
            ? ('Google Play' as const)
            : undefined,
      otaEnabled,
      requestUpdate: nativeUpdate.requestUpdate,
      retryCheck,
    }),
    [nativeUpdate.requestUpdate, otaEnabled, platform, retryCheck, state]
  );
}

