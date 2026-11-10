import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  AppUpdate,
  AppUpdateResultCode,
} from '@capawesome/capacitor-app-update';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type NativePlatform = 'ios' | 'android';

export type MandatoryNativeUpdateState =
  | { status: 'not-native' }
  | { status: 'checking' }
  | {
      status: 'supported';
      currentVersion: string;
      minimumVersion: string;
    }
  | {
      status: 'required';
      platform: NativePlatform;
      currentVersion: string;
      minimumVersion: string;
      updating: boolean;
      error?: string;
    }
  | { status: 'error'; minimumVersion: string; error: string };

export type UseMandatoryNativeUpdateOptions = {
  minimumVersion?: string;
  fallbackMinimumVersion: string;
  iosAppStoreId?: string;
  androidPackageName?: string;
};

export type UseMandatoryNativeUpdateResult = {
  state: MandatoryNativeUpdateState;
  requestUpdate: () => Promise<void>;
  retryCheck: () => Promise<void>;
};

const STABLE_VERSION = /^\d+\.\d+\.\d+$/;

export function compareNativeVersions(a: string, b: string): number {
  const left = a.trim();
  const right = b.trim();
  if (!STABLE_VERSION.test(left) || !STABLE_VERSION.test(right)) {
    throw new Error('Native versions must use stable X.Y.Z format');
  }
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}

export function effectiveMinimumVersion(
  fallbackMinimumVersion: string,
  minimumVersion?: string
): string {
  const fallback = fallbackMinimumVersion.trim();
  if (!STABLE_VERSION.test(fallback)) {
    throw new Error('fallbackMinimumVersion must use stable X.Y.Z format');
  }
  if (!minimumVersion) return fallback;
  const candidate = minimumVersion.trim();
  if (!STABLE_VERSION.test(candidate)) return fallback;
  return compareNativeVersions(candidate, fallback) > 0 ? candidate : fallback;
}

export function nativeUpdateRequirement(
  currentVersion: string,
  fallbackMinimumVersion: string,
  minimumVersion?: string
) {
  const effectiveMinimum = effectiveMinimumVersion(
    fallbackMinimumVersion,
    minimumVersion
  );
  return {
    supported: compareNativeVersions(currentVersion, effectiveMinimum) >= 0,
    minimumVersion: effectiveMinimum,
  };
}

type NativeUpdateApi = Pick<
  typeof AppUpdate,
  | 'getAppUpdateInfo'
  | 'performImmediateUpdate'
  | 'openAppStore'
>;

export async function openRequiredNativeUpdate(
  {
    platform,
    iosAppStoreId,
    androidPackageName,
  }: {
    platform: NativePlatform;
    iosAppStoreId?: string;
    androidPackageName?: string;
  },
  api: NativeUpdateApi = AppUpdate
): Promise<void> {
  if (platform === 'ios') {
    const appId = iosAppStoreId?.trim();
    if (!appId) throw new Error('iosAppStoreId is not configured');
    await api.openAppStore({ appId });
    return;
  }

  try {
    const info = await api.getAppUpdateInfo();
    if (info.immediateUpdateAllowed) {
      const result = await api.performImmediateUpdate();
      if (result.code === AppUpdateResultCode.OK) return;
    }
  } catch (error) {
    console.warn('Immediate update unavailable; opening Google Play:', error);
  }
  await api.openAppStore({ androidPackageName });
}

export function useMandatoryNativeUpdate({
  minimumVersion,
  fallbackMinimumVersion,
  iosAppStoreId,
  androidPackageName,
}: UseMandatoryNativeUpdateOptions): UseMandatoryNativeUpdateResult {
  const capacitorPlatform = Capacitor.getPlatform();
  const platform =
    capacitorPlatform === 'ios' || capacitorPlatform === 'android'
      ? capacitorPlatform
      : null;
  const effectiveMinimum = useMemo(
    () => effectiveMinimumVersion(fallbackMinimumVersion, minimumVersion),
    [fallbackMinimumVersion, minimumVersion]
  );
  const [state, setState] = useState<MandatoryNativeUpdateState>(
    platform ? { status: 'checking' } : { status: 'not-native' }
  );
  const checkSequence = useRef(0);

  const check = useCallback(async () => {
    const sequence = ++checkSequence.current;
    if (!platform) {
      setState({ status: 'not-native' });
      return;
    }
    try {
      const { version } = await NativeApp.getInfo();
      if (sequence !== checkSequence.current) return;
      if (compareNativeVersions(version, effectiveMinimum) >= 0) {
        setState({
          status: 'supported',
          currentVersion: version,
          minimumVersion: effectiveMinimum,
        });
      } else {
        setState({
          status: 'required',
          platform,
          currentVersion: version,
          minimumVersion: effectiveMinimum,
          updating: false,
        });
      }
    } catch (error) {
      if (sequence !== checkSequence.current) return;
      console.error('Unable to read the native app version:', error);
      setState({
        status: 'error',
        minimumVersion: effectiveMinimum,
        error: 'We could not verify this app version. Please try again.',
      });
    }
  }, [effectiveMinimum, platform]);

  useEffect(() => {
    void check();
    if (!platform) return;

    let disposed = false;
    let removeListener: (() => Promise<void>) | undefined;
    void NativeApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void check();
    })
      .then((handle) => {
        if (disposed) void handle.remove();
        else removeListener = handle.remove;
      })
      .catch((error) => {
        console.error('Unable to register the app state listener:', error);
      });
    return () => {
      disposed = true;
      checkSequence.current += 1;
      if (removeListener) void removeListener();
    };
  }, [check, platform]);

  const requestUpdate = useCallback(async () => {
    if (state.status !== 'required') return;
    const required = state;
    setState({ ...required, updating: true, error: undefined });
    try {
      await openRequiredNativeUpdate({
        platform: required.platform,
        iosAppStoreId,
        androidPackageName,
      });
      setState({ ...required, updating: false });
    } catch (error) {
      console.error('Unable to start the required native app update:', error);
      setState({
        ...required,
        updating: false,
        error:
          required.platform === 'ios'
            ? "We couldn't open the App Store. Please try again."
            : "We couldn't open Google Play. Please try again.",
      });
    }
  }, [androidPackageName, iosAppStoreId, state]);

  return useMemo(
    () => ({ state, requestUpdate, retryCheck: check }),
    [check, requestUpdate, state]
  );
}
