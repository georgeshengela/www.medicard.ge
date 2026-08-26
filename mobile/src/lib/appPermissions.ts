import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Linking, Platform } from 'react-native';
import {
  connectHealthApp,
  disconnectHealthApp,
  getHealthPlatform,
  isHealthPlatformSupported,
  isHealthSyncEnabled,
  openHealthAppSettings,
  type HealthConnectResult,
} from '@/lib/healthSync';
import { isCyclePrivacyLockEnabled, setCyclePrivacyLockEnabled } from '@/lib/cycleReminderPrefs';
import { isBiometricEnabled, setBiometricEnabled } from '@/lib/profileSetupFlow';
import { ka } from '@/i18n/ka';
import {
  cancelAllReminders,
  cancelCycleReminders,
  getNotificationPermissionStatus,
  getScheduledReminderCounts,
  registerPushTokenWithServer,
  requestNotificationPermission,
  unregisterPushFromServer,
} from '@/lib/notifications';

export type ExpoPermissionState = 'granted' | 'denied' | 'undetermined';

export type AppPermissionsSnapshot = {
  health: {
    supported: boolean;
    platform: ReturnType<typeof getHealthPlatform>;
    connected: boolean;
    expoGo: boolean;
  };
  push: {
    permission: ExpoPermissionState;
    device: boolean;
  };
  localReminders: {
    permission: ExpoPermissionState;
    medCount: number;
    cycleCount: number;
    visitCount: number;
    total: number;
  };
  camera: {
    permission: ExpoPermissionState;
  };
  photos: {
    permission: ExpoPermissionState;
  };
  biometric: {
    hardware: boolean;
    enrolled: boolean;
    enabledInApp: boolean;
  };
  cyclePrivacyLock: boolean;
};

function mapPermissionStatus(status: Notifications.PermissionStatus | ImagePicker.PermissionStatus): ExpoPermissionState {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

export async function loadAppPermissions(): Promise<AppPermissionsSnapshot> {
  const [
    healthConnected,
    pushPermission,
    reminderCounts,
    cameraPermission,
    photosPermission,
    hasHardware,
    isEnrolled,
    biometricEnabled,
    cycleLock,
  ] = await Promise.all([
    isHealthSyncEnabled(),
    getNotificationPermissionStatus(),
    getScheduledReminderCounts(),
    ImagePicker.getCameraPermissionsAsync(),
    ImagePicker.getMediaLibraryPermissionsAsync(),
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    isBiometricEnabled(),
    isCyclePrivacyLockEnabled(),
  ]);

  return {
    health: {
      supported: isHealthPlatformSupported(),
      platform: getHealthPlatform(),
      connected: healthConnected,
      expoGo: isExpoGo(),
    },
    push: {
      permission: pushPermission,
      device: Device.isDevice,
    },
    localReminders: {
      permission: pushPermission,
      medCount: reminderCounts.med,
      cycleCount: reminderCounts.cycle,
      visitCount: reminderCounts.visit,
      total: reminderCounts.total,
    },
    camera: {
      permission: mapPermissionStatus(cameraPermission.status),
    },
    photos: {
      permission: mapPermissionStatus(photosPermission.status),
    },
    biometric: {
      hardware: hasHardware,
      enrolled: isEnrolled,
      enabledInApp: biometricEnabled,
    },
    cyclePrivacyLock: cycleLock,
  };
}

export function countActivePermissions(snapshot: AppPermissionsSnapshot): { connections: number; permissions: number } {
  let connections = 0;
  let permissions = 0;

  if (snapshot.health.connected) connections += 1;
  if (snapshot.push.permission === 'granted') connections += 1;

  if (snapshot.camera.permission === 'granted') permissions += 1;
  if (snapshot.photos.permission === 'granted') permissions += 1;
  if (snapshot.biometric.enabledInApp) permissions += 1;
  if (snapshot.cyclePrivacyLock) permissions += 1;
  if (snapshot.localReminders.total > 0) permissions += 1;

  return { connections, permissions };
}

/** 0–100 score for the overview ring — how many privacy features are active. */
export function computePrivacyScore(snapshot: AppPermissionsSnapshot): {
  score: number;
  active: number;
  total: number;
} {
  const checks = [
    snapshot.health.supported ? snapshot.health.connected : null,
    snapshot.push.permission === 'granted',
    snapshot.localReminders.total > 0,
    snapshot.camera.permission === 'granted',
    snapshot.photos.permission === 'granted',
    snapshot.biometric.enabledInApp,
    snapshot.cyclePrivacyLock,
  ].filter((v) => v !== null) as boolean[];

  const active = checks.filter(Boolean).length;
  const total = checks.length;
  const score = total === 0 ? 0 : Math.round((active / total) * 100);

  return { score, active, total };
}

export async function connectHealthConnection(): Promise<HealthConnectResult> {
  return connectHealthApp();
}

export async function disconnectHealthConnection(): Promise<void> {
  await disconnectHealthApp();
}

export async function openAppSystemSettings(): Promise<void> {
  await Linking.openSettings();
}

export async function openHealthConnectionSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    await openHealthAppSettings();
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

export async function enablePushConnection(): Promise<boolean> {
  return registerPushTokenWithServer();
}

export async function disablePushConnection(): Promise<void> {
  await unregisterPushFromServer();
}

export async function requestCameraAccess(): Promise<ExpoPermissionState> {
  const result = await ImagePicker.requestCameraPermissionsAsync();
  return mapPermissionStatus(result.status);
}

export async function requestPhotosAccess(): Promise<ExpoPermissionState> {
  const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return mapPermissionStatus(result.status);
}

export async function enableBiometricLock(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !enrolled) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: ka.profileSetup.faceIdEnable,
    cancelLabel: ka.common.cancel,
    disableDeviceFallback: false,
  });
  if (!result.success) return false;

  await setBiometricEnabled(true);
  return true;
}

export async function disableBiometricLock(): Promise<void> {
  await setBiometricEnabled(false);
}

export async function enableCyclePrivacyLock(): Promise<void> {
  await setCyclePrivacyLockEnabled(true);
}

export async function disableCyclePrivacyLock(): Promise<void> {
  await setCyclePrivacyLockEnabled(false);
}

export async function resetLocalReminders(): Promise<void> {
  await cancelAllReminders();
}

export async function resetCycleRemindersOnly(): Promise<void> {
  await cancelCycleReminders();
}

export async function resetAllConnectionsAndPermissions(): Promise<void> {
  await Promise.all([
    disconnectHealthApp(),
    unregisterPushFromServer(),
    setBiometricEnabled(false),
    setCyclePrivacyLockEnabled(false),
    cancelAllReminders(),
  ]);
}

export async function requestNotificationAccess(): Promise<boolean> {
  return requestNotificationPermission();
}
