import Constants from 'expo-constants';
import { Platform } from 'react-native';

let gateFinished = false;
let gateBlocking = false;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeDeviceAccessGate(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function isDeviceAccessGateFinished() {
  return gateFinished;
}

export function isDeviceAccessGateBlocking() {
  return gateBlocking;
}

export function setDeviceAccessGateBlocking(on) {
  gateBlocking = Boolean(on);
  emit();
}

export function markDeviceAccessGateFinished() {
  gateFinished = true;
  gateBlocking = false;
  emit();
}

export function resetDeviceAccessGate() {
  gateFinished = false;
  gateBlocking = false;
  emit();
}

export function isNativePermissionRuntime() {
  return Platform.OS !== 'web';
}

/**
 * iOS 26 will not show an OS sheet from a silent useEffect. Inspect only —
 * requestAuthorization / requestPermissionsAsync must run from a button press.
 */
export async function inspectDeviceAccessNeeds() {
  if (Platform.OS === 'web') {
    return { notifications: false, health: false, location: false };
  }

  const expoGo = Constants.appOwnership === 'expo';
  const [{ getPushOptedInStored, getRememberedOsNotificationGrant, isNotificationsNativeAvailable }, health, { getLocationPermissionState }] =
    await Promise.all([
      import('@/lib/notifications'),
      import('@/lib/healthSync'),
      import('@/lib/userLocation'),
    ]);

  const stored = await getPushOptedInStored();
  const remembered = await getRememberedOsNotificationGrant();
  const healthOn = await health.isHealthSyncEnabled();
  const loc = await getLocationPermissionState();
  const nativeNotifications =
    typeof isNotificationsNativeAvailable === 'function'
      ? isNotificationsNativeAvailable()
      : true;

  return {
    notifications: nativeNotifications && stored !== '1' && !remembered,
    health: !expoGo && health.isHealthPlatformSupported() && !healthOn,
    location: !expoGo && loc === 'undetermined',
  };
}

/** Call only from a user tap. Always hits the OS prompt unless already granted. */
export async function askNotificationsFromUserGesture() {
  const { requestNotificationPermission, setPushOptedIn, registerPushTokenWithServer } = await import(
    '@/lib/notifications'
  );
  const granted = await requestNotificationPermission();
  if (granted) {
    await setPushOptedIn(true);
    await registerPushTokenWithServer({ skipPermissionProbe: true }).catch(() => undefined);
  }
  return granted;
}

/** Call only from a user tap. */
export async function askHealthFromUserGesture() {
  const { connectHealthApp } = await import('@/lib/healthSync');
  return connectHealthApp();
}

/** Call only from a user tap. */
export async function askLocationFromUserGesture() {
  const { requestLocationPermission } = await import('@/lib/userLocation');
  return requestLocationPermission();
}
