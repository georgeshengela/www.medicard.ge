/**
 * MEDIHOROSCOPE is a new module, so it reaches people with a store build, never an OTA (App Review 2.5.2):
 * its entries show in development (the owner's Expo) and on binaries from store train 24, and only while the
 * admin switch `horoscope` is on. An OTA into train 23 carries the code but shows nothing.
 */
import { requireOptionalNativeModule } from 'expo';
import { isFeatureOn } from '@/lib/featureFlags';

export const HOROSCOPE_FIRST_TRAIN = 24;

function binaryTrain(): number | null {
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

/** The binary may show MEDIHOROSCOPE (development builds and Expo Go report no train). */
export function horoscopeShipped(): boolean {
  if (__DEV__) return true;
  const train = binaryTrain();
  return train !== null && train >= HOROSCOPE_FIRST_TRAIN;
}

/** Entries (Home card, modules sheet, explore) appear only when shipped and switched on. */
export function horoscopeVisible(): boolean {
  return horoscopeShipped() && isFeatureOn('horoscope');
}
