/**
 * useAutomaticUpdates
 *
 * Handles OTA (over-the-air) updates and maintenance mode detection for Capacitor apps.
 * Only runs on native platforms (iOS/Android); skips on web.
 *
 * With autoUpdate: false in capacitor.config.ts, we have full manual control:
 * 1. notifyAppReady → confirm current bundle (prevent rollback)
 * 2. Check Capgo channel → switch to production if needed
 * 3. Check native app version → if outdated, show store update and stop
 * 4. Check maintenance (HEAD request to SITE_ROOT) → on start + every 1 min
 * 5. If server up → getLatest() → download with progress → set + reload
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import {
  AppUpdate,
  AppUpdateAvailability,
  AppUpdateInfo,
} from '@capawesome/capacitor-app-update';
import { Capacitor } from '@capacitor/core';

export type OTAStatus = 'idle' | 'downloading' | 'complete' | 'error';

export type UseAutomaticUpdatesState = {
  otaStatus: OTAStatus;
  otaProgress: number;
  maintenanceMode: boolean;
  retryOTA: () => void;
  retryMaintenanceCheck: () => void;
};

const MAINTENANCE_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute
const getIosAppStoreId = () => process.env.IOS_APP_STORE_ID?.trim() || '';

const isNoUpdateCondition = (error: unknown) => {
  let message = '';

  if (typeof error === 'string') {
    message = error.toLowerCase();
  } else if (error && typeof error === 'object') {
    const fields = [
      'message' in error ? String(error.message ?? '') : '',
      'error' in error ? String(error.error ?? '') : '',
      'errorMessage' in error ? String(error.errorMessage ?? '') : '',
      JSON.stringify(error),
    ];
    message = fields.join(' ').toLowerCase();
  }

  return (
    message.includes('no new version available') ||
    message.includes('no_new_version_available') ||
    message.includes('disable_auto_update')
  );
};

export const useAutomaticUpdates = (): UseAutomaticUpdatesState => {
  const [otaStatus, setOtaStatus] = useState<OTAStatus>('idle');
  const [otaProgress, setOtaProgress] = useState(0);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const maintenanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const otaCheckedRef = useRef(false); // Track whether OTA check has already run

  // --- Maintenance check: HEAD request to SITE_ROOT ---
  const checkMaintenance = useCallback(async (): Promise<boolean> => {
    const siteRoot = process.env.SITE_ROOT;
    if (!siteRoot) return true;

    try {
      const res = await fetch(`${siteRoot}/__health`, {
        method: 'HEAD',
        cache: 'no-store',
      });
      const up = res.ok;
      setMaintenanceMode(!up);
      if (up) {
        console.log('✅ [MaintenanceCheck] Server is up');
      } else {
        console.log('⚠️ [MaintenanceCheck] Server returned', res.status);
      }
      return up;
    } catch (err) {
      console.warn('⚠️ [MaintenanceCheck] Server unreachable:', err);
      setMaintenanceMode(true);
      return false;
    }
  }, []);

  // --- Manual OTA: getLatest → download (with progress) → set → reload ---
  const checkAndDownloadOTA = useCallback(async () => {
    try {
      // getLatest() returns LatestVersion { url, version, error, message, ... }
      const latest = await CapacitorUpdater.getLatest();
      if (latest.error) {
        if (isNoUpdateCondition(latest.error) || isNoUpdateCondition(latest)) {
          console.log('ℹ️ [UpdateCheck] Already on latest OTA bundle');
          setOtaStatus('idle');
          setOtaProgress(0);
          return;
        }
        console.warn('⚠️ [UpdateCheck] getLatest error:', latest.error);
        setOtaStatus('error');
        return;
      }
      if (!latest.url) {
        console.log('✅ [UpdateCheck] Already on latest version');
        setOtaStatus('idle');
        setOtaProgress(0);
        return;
      }

      console.log(`🔄 [UpdateCheck] OTA update available: ${latest.version}`);
      setOtaStatus('downloading');
      setOtaProgress(0);

      // 'download' event fires during download() with progress percentage
      const progressHandle = await CapacitorUpdater.addListener(
        'download',
        (event: { percent?: number }) => {
          setOtaProgress(Math.min(100, Math.max(0, event.percent ?? 0)));
        }
      );

      try {
        // download() resolves when complete and returns BundleInfo { id, version, ... }
        const bundle = await CapacitorUpdater.download({
          url: latest.url,
          version: latest.version,
        });

        progressHandle.remove();

        // Show "Update ready, restarting..." briefly before reload
        setOtaStatus('complete');
        setOtaProgress(100);
        await new Promise((r) => setTimeout(r, 1500));
        // set() takes BundleId { id } — sets bundle and reloads the app
        await CapacitorUpdater.set({ id: bundle.id });
      } catch (err) {
        progressHandle.remove();
        throw err;
      }
    } catch (err: any) {
      if (isNoUpdateCondition(err)) {
        console.log('ℹ️ [UpdateCheck] No OTA update needed');
        setOtaStatus('idle');
        setOtaProgress(0);
        return;
      }
      console.error('❌ [UpdateCheck] OTA error:', err);
      setOtaStatus('error');
    }
  }, []);

  const retryOTA = useCallback(() => {
    setOtaStatus('idle');
    setOtaProgress(0);
    checkAndDownloadOTA();
  }, [checkAndDownloadOTA]);

  const retryMaintenanceCheck = useCallback(async () => {
    const serverUp = await checkMaintenance();
    if (serverUp) {
      console.log('✅ [MaintenanceCheck] Server back, checking OTA...');
      otaCheckedRef.current = true;
      await checkAndDownloadOTA();
    }
  }, [checkMaintenance, checkAndDownloadOTA]);

  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return;

    (async () => {
      // Step 1: Confirm current bundle is OK (prevents Capgo rollback)
      try {
        await CapacitorUpdater.notifyAppReady();
      } catch (err) {
        console.warn('⚠️ [UpdateCheck] notifyAppReady failed:', err);
      }

      // Step 2: Ensure we're on production channel
      try {
        const channelInfo = await CapacitorUpdater.getChannel();
        console.log('📦 Capgo channel:', channelInfo.channel, channelInfo);

        const targetChannel = 'production';
        if (
          channelInfo.channel &&
          channelInfo.channel !== targetChannel &&
          channelInfo.allowSet
        ) {
          try {
            await CapacitorUpdater.setChannel({
              channel: targetChannel,
              triggerAutoUpdate: false,
            });
          } catch (error) {
            console.warn(`⚠️ Could not switch to ${targetChannel}:`, error);
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not get Capgo channel:', error);
      }

      // Step 3: Check native app version (store update takes priority over OTA)
      if (Capacitor.isNativePlatform()) {
        const nativeUpdateAvailable = await checkNativeVersion();
        if (nativeUpdateAvailable) {
          console.log('🛑 [UpdateCheck] Native update required, stopping OTA');
          return;
        }
      }

      // Step 4: Maintenance check
      const serverUp = await checkMaintenance();

      // Step 5: Poll maintenance every 1 minute; trigger OTA when server recovers
      maintenanceIntervalRef.current = setInterval(async () => {
        const up = await checkMaintenance();
        if (up && !otaCheckedRef.current) {
          console.log(
            '✅ [MaintenanceCheck] Server recovered, checking OTA...'
          );
          otaCheckedRef.current = true;
          await checkAndDownloadOTA();
        }
      }, MAINTENANCE_CHECK_INTERVAL_MS);

      // Step 6: Check OTA only when server is up
      if (serverUp) {
        console.log('✅ [UpdateCheck] Native is up to date, checking OTA...');
        otaCheckedRef.current = true;
        await checkAndDownloadOTA();
      } else {
        console.log(
          '⏸️ [UpdateCheck] Server down, skipping OTA check until Retry'
        );
      }
    })();

    return () => {
      if (maintenanceIntervalRef.current) {
        clearInterval(maintenanceIntervalRef.current);
      }
    };
  }, [checkMaintenance, checkAndDownloadOTA]);

  // --- Native (store) update: uses @capawesome/capacitor-app-update ---
  const checkNativeVersion = async (): Promise<boolean> => {
    try {
      const nativeUpdateInfo = await AppUpdate.getAppUpdateInfo();
      if (
        nativeUpdateInfo.updateAvailability ===
        AppUpdateAvailability.UPDATE_AVAILABLE
      ) {
        await showNativeUpdate(nativeUpdateInfo);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ [UpdateCheck] Error checking native version:', error);
      return false;
    }
  };

  const showNativeUpdate = async (nativeUpdateInfo: AppUpdateInfo) => {
    try {
      const { Dialog } = await import('@capacitor/dialog');
      let availableVersion: string;
      if (
        nativeUpdateInfo.availableVersionName &&
        nativeUpdateInfo.availableVersionCode
      ) {
        availableVersion = `${nativeUpdateInfo.availableVersionName} (${nativeUpdateInfo.availableVersionCode})`;
      } else if (nativeUpdateInfo.availableVersionName) {
        availableVersion = nativeUpdateInfo.availableVersionName;
      } else {
        availableVersion = 'latest';
      }

      await Dialog.alert({
        title: 'Update Required',
        message: `A new version (${availableVersion}) is available. Please update now to continue.`,
        buttonTitle: 'Update',
      });

      if (nativeUpdateInfo.immediateUpdateAllowed) {
        await AppUpdate.performImmediateUpdate();
      } else {
        await AppUpdate.openAppStore({
          androidPackageName: process.env.APP_ID || '',
          // On iOS the plugin expects the numeric Apple App ID, not a full App Store URL.
          appId: getIosAppStoreId(),
        });
      }
    } catch (error) {
      console.error('❌ [UpdateCheck] Error applying native update:', error);
    }
  };

  return {
    otaStatus,
    otaProgress,
    maintenanceMode,
    retryOTA,
    retryMaintenanceCheck,
  };
};
