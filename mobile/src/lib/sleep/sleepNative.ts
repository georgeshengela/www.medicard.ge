import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * MEDISLEEP needs store train 1.0.0.23: background audio with lock-screen controls (expo-audio
 * `enableBackgroundPlayback`), the sleep widget and the AlarmKit module. An OTA of this JS into an older
 * binary must not offer the module there (App Review 2.5.2, and sounds would stop when the screen locks), so
 * the feature store treats `sleep` as off on those binaries. Development builds and the web preview have no
 * store train and keep it on.
 */
export const SLEEP_MIN_TRAIN = 23;

function binaryTrain(): number | null {
  if (Platform.OS === 'web') return null;
  if (!requireOptionalNativeModule('ExpoUpdates')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const runtime = (require('expo-updates') as typeof import('expo-updates')).runtimeVersion;
    const train = Number(String(runtime ?? '').split('.')[3]);
    return Number.isFinite(train) && train > 0 ? train : null;
  } catch {
    return null;
  }
}

let cached: boolean | null = null;

export function sleepNativeReady(): boolean {
  if (cached === null) {
    const train = binaryTrain();
    cached = train === null || train >= SLEEP_MIN_TRAIN;
  }
  return cached;
}
