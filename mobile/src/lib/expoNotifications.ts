import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

/**
 * Expo Go Android (SDK 53+) throws on import of expo-notifications:
 * DevicePushTokenAutoRegistration calls addPushTokenListener at module load.
 * Do not import that package on Android Expo Go — even as `import type`.
 * Production / iOS / dev builds still load the real module.
 */
const skipNative = Platform.OS === 'android' && isRunningInExpoGo();

const emptySub = { remove() {} };

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
  };
}

function loadNotifications() {
  if (skipNative) return expoGoStub();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch {
    return expoGoStub();
  }
}

export const Notifications = loadNotifications();
