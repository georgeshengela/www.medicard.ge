import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import {
  getHealthPlatform,
  isHealthPlatformSupported,
  isHealthSyncEnabled,
  setHealthSyncEnabled,
  type CycleHealthPayload,
  type HealthConnectResult,
  type HealthPlatform,
} from '@/lib/healthSync.shared';

export {
  getHealthPlatform,
  isHealthPlatformSupported,
  isHealthSyncEnabled,
  setHealthSyncEnabled,
  type CycleHealthPayload,
  type HealthConnectResult,
  type HealthPlatform,
};

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

async function nativeImpl() {
  if (Platform.OS === 'ios') return import('@/lib/healthSyncPlatform.ios');
  if (Platform.OS === 'android') return import('@/lib/healthSyncPlatform.android');
  return null;
}

export async function connectHealthApp(): Promise<HealthConnectResult> {
  if (!isHealthPlatformSupported()) {
    return { ok: false, reason: 'unavailable' };
  }
  if (isExpoGo()) {
    return { ok: false, reason: 'expo_go' };
  }

  const impl = await nativeImpl();
  if (!impl) return { ok: false, reason: 'unavailable' };

  const result = await impl.connectHealthNative();
  if (result.ok) {
    await setHealthSyncEnabled(true);
  }
  return result;
}

export async function disconnectHealthApp(): Promise<void> {
  await setHealthSyncEnabled(false);
}

export async function openHealthAppSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    const { openHealthSettingsNative } = await import('@/lib/healthSyncPlatform.android');
    await openHealthSettingsNative();
    return;
  }
  if (Platform.OS === 'ios') {
    const healthUrl = 'x-apple-health://';
    const canOpen = await Linking.canOpenURL(healthUrl);
    if (canOpen) {
      await Linking.openURL(healthUrl);
      return;
    }
  }
  await Linking.openSettings();
}

export async function importLatestPeriodStart(): Promise<string | null> {
  if (!(await isHealthSyncEnabled())) return null;
  if (!isHealthPlatformSupported() || isExpoGo()) return null;

  const impl = await nativeImpl();
  if (!impl) return null;
  return impl.importLatestPeriodStartNative();
}

export async function syncCycleLogToHealth(payload: CycleHealthPayload): Promise<void> {
  if (!(await isHealthSyncEnabled())) return;
  if (!isHealthPlatformSupported() || isExpoGo()) return;

  const impl = await nativeImpl();
  if (!impl) return;

  try {
    await impl.syncCycleLogNative(payload);
  } catch {
    // Health sync must never block Medicard logging.
  }
}

export async function syncPeriodStartToHealth(ymd: string): Promise<void> {
  if (!(await isHealthSyncEnabled())) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
  if (!isHealthPlatformSupported() || isExpoGo()) return;

  const impl = await nativeImpl();
  if (!impl) return;

  try {
    await impl.syncPeriodStartNative(ymd);
  } catch {
    // Best-effort only.
  }
}
