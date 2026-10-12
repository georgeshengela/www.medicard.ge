/**
 * MEDIFAMILY is a new module, so it reaches people with a store build, never an OTA (App Review 2.5.2):
 * its entries show in development (the owner's Expo) and on binaries from store train 23, and only while
 * the admin switch `family` is on. An OTA into train 22 carries the code but shows nothing.
 */
import { requireOptionalNativeModule } from 'expo';
import { isFeatureOn } from '@/lib/featureFlags';

export const FAMILY_FIRST_TRAIN = 23;

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

/** The binary may show MEDIFAMILY (development builds and Expo Go report no train). */
export function familyShipped(): boolean {
  if (__DEV__) return true;
  const train = binaryTrain();
  return train !== null && train >= FAMILY_FIRST_TRAIN;
}

/** Entries (Home, Profile, modules sheet) appear only when shipped and switched on. */
export function familyVisible(): boolean {
  return familyShipped() && isFeatureOn('family');
}
