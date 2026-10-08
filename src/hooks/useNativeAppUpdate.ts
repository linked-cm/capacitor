import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  AppUpdate,
  AppUpdateAvailability,
  AppUpdateInfo,
} from '@capawesome/capacitor-app-update';
import { Dialog } from '@capacitor/dialog';

const getIosAppStoreId = () => process.env.IOS_APP_STORE_ID?.trim() || '';

export const useNativeAppUpdate = () => {
  useEffect(() => {
    // only check on mobile platforms (Android and iOS)
    if (
      Capacitor.getPlatform() === 'android' ||
      Capacitor.getPlatform() === 'ios'
    ) {
      // Delay native update check to allow OTA updates to check first
      // OTA updates handle web bundle changes (most common)
      // Native updates are for breaking changes requiring native code updates
      setTimeout(checkForUpdate, 5000); // Increased delay to prioritize OTA
    }
  }, []);

  const checkForUpdate = async () => {
    try {
      const result = await AppUpdate.getAppUpdateInfo();

      // check if update is available
      if (
        result.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE
      ) {
        // format: versionName (versionCode) - e.g., "4.0.5 (77)"
        // handle cases where either versionName or versionCode might be undefined
        let availableVersion: string;
        if (result.availableVersionName && result.availableVersionCode) {
          availableVersion = `${result.availableVersionName} (${result.availableVersionCode})`;
        } else if (result.availableVersionName) {
          availableVersion = result.availableVersionName;
        } else if (result.availableVersionCode) {
          availableVersion = `${result.availableVersionCode}`;
        } else {
          availableVersion = 'latest';
        }

        // show update dialog with only "Update" option.
        await Dialog.alert({
          title: 'Update Required',
          message: `A new version (${availableVersion}) is available. Please update now to continue.`,
          buttonTitle: 'Update',
        });

        // open app store immediately after user acknowledges
        doUpdate(result);
      }
    } catch (error) {
      console.error('Error checking for app update:', error);
    }
  };

  const doUpdate = async (result: AppUpdateInfo) => {
    // perform immediate update if allowed, otherwise open app store
    // immediate update is only available on Android
    // https://github.com/capawesome-team/capacitor-plugins/tree/main/packages/app-update#interfaces
    if (result.immediateUpdateAllowed) {
      await AppUpdate.performImmediateUpdate();
    } else {
      await AppUpdate.openAppStore({
        androidPackageName: process.env.APP_ID || '', // for Android, this is the package name. find on `android/app/build.gradle`
        // On iOS the plugin expects the numeric Apple App ID, not a full App Store URL.
        appId: getIosAppStoreId(),
      });
    }
  };

  return { checkForUpdate };
};
