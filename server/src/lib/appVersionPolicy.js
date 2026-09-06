import { getAppSettings } from './settings.js';
import { getMobileAppVersion } from './mobileAppVersion.js';

/** Single source for admin version gates. Do not hardcode these in UI files. */
export const APP_VERSION_POLICY = {
  minimumBrainSyncVersion: '23.0.3',
  minimumOutcomeSyncVersion: '24.0.0',
};

export async function getAppVersionPolicy() {
  const settings = await getAppSettings();
  const current = getMobileAppVersion() || settings.minAppVersion || null;
  return {
    currentRecommendedVersion: current,
    minimumBrainSyncVersion: APP_VERSION_POLICY.minimumBrainSyncVersion,
    minimumOutcomeSyncVersion: APP_VERSION_POLICY.minimumOutcomeSyncVersion,
    minimumSupportedVersion: settings.minAppVersion || null,
    forceUpdateVersion: settings.forceUpdate ? settings.minAppVersion || null : null,
  };
}
