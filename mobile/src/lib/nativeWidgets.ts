import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * expo-widgets (cycle widget, MEDIRUN / expected-day Live Activities) ships only in iOS store builds
 * from train 1.0.0.20. Expo Go and older binaries have no `ExpoWidgets` module: ask first, so nothing
 * throws or logs „Cannot find native module 'ExpoWidgets'“ (same check as appIcon.ts / otaUpdates.ts).
 */
export function expoWidgetsAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return Boolean(requireOptionalNativeModule('ExpoWidgets'));
  } catch {
    return false;
  }
}
