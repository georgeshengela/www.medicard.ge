/**
 * Load expo-notifications when the native module exists.
 * Expo Go Android cannot register *remote* push tokens (SDK 53+);
 * iOS Expo Go still can — do not stub getExpoPushTokenAsync when require() works.
 * Local reminders use the real module on both.
 */
const emptySub = { remove() {} };

let nativeAvailable = false;

function expoGoStub() {
  const denied = {
    status: 'denied',
    granted: false,
    canAskAgain: false,
    expires: 'never' as const,
  };
  return {
    setNotificationHandler: () => undefined,
    getLastNotificationResponseAsync: async () => null,
    addNotificationReceivedListener: () => emptySub,
    addNotificationResponseReceivedListener: () => emptySub,
    getPermissionsAsync: async () => denied,
    requestPermissionsAsync: async () => denied,
    getExpoPushTokenAsync: async () => {
      throw new Error('Expo Go cannot register remote push tokens on SDK 53+');
    },
    scheduleNotificationAsync: async () => 'expo-go-stub',
    cancelScheduledNotificationAsync: async () => undefined,
    cancelAllScheduledNotificationsAsync: async () => undefined,
    getAllScheduledNotificationsAsync: async () => [],
    setNotificationChannelAsync: async () => null,
    setNotificationCategoryAsync: async () => null,
    AndroidImportance: {
      UNKNOWN: 0,
      UNSPECIFIED: 1,
      NONE: 2,
      MIN: 3,
      LOW: 4,
      DEFAULT: 5,
      HIGH: 6,
      MAX: 7,
    },
    SchedulableTriggerInputTypes: {
      CALENDAR: 'calendar',
      DAILY: 'daily',
      WEEKLY: 'weekly',
      MONTHLY: 'monthly',
      YEARLY: 'yearly',
      DATE: 'date',
      TIME_INTERVAL: 'timeInterval',
    },
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
    PermissionStatus: {
      GRANTED: 'granted',
      DENIED: 'denied',
      UNDETERMINED: 'undetermined',
    },
    IosAuthorizationStatus: {
      NOT_DETERMINED: 0,
      DENIED: 1,
      AUTHORIZED: 2,
      PROVISIONAL: 3,
      EPHEMERAL: 4,
    },
  };
}

function rewriteScheduleRequest(request) {
  if (request?.content?.sound !== 'default') return request;
  return {
    ...request,
    content: {
      ...request.content,
      // SDK 57 treats the string "default" as a missing custom asset.
      sound: true,
    },
  };
}

function rewriteChannel(channel) {
  if (!channel || channel.sound !== 'default') return channel;
  const next = { ...channel };
  delete next.sound;
  return next;
}

function loadNotifications() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require('expo-notifications');
    const schedule = loaded.scheduleNotificationAsync?.bind(loaded);
    if (typeof schedule === 'function') {
      loaded.scheduleNotificationAsync = (request) => schedule(rewriteScheduleRequest(request));
    }
    const setChannel = loaded.setNotificationChannelAsync?.bind(loaded);
    if (typeof setChannel === 'function') {
      loaded.setNotificationChannelAsync = (id, channel) => setChannel(id, rewriteChannel(channel));
    }
    // iOS Expo Go can still mint an Expo push token. Android SDK 53+ cannot —
    // let the native call fail there instead of blocking iOS registration.
    nativeAvailable = true;
    return loaded;
  } catch {
    nativeAvailable = false;
    return expoGoStub();
  }
}

export const Notifications = loadNotifications();

export function isNotificationsNativeAvailable() {
  return nativeAvailable;
}
