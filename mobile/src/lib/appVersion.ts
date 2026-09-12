import Constants from 'expo-constants';
import { DEFAULT_MEDICARD_VERSION, formatMedicardVersion } from '@/lib/medicardVersion';

type Extra = {
  medicardInternalVersion?: string;
};

const extra = Constants.expoConfig?.extra as Extra | undefined;

/**
 * Public Medicard identity — five-part `G.0.0.B.R`.
 * Prefer `extra.medicardInternalVersion` so iOS `expo.ios.version` (`1.7.71`)
 * never replaces the in-app / API string.
 */
export const APP_VERSION = formatMedicardVersion(
  extra?.medicardInternalVersion || Constants.expoConfig?.version,
  DEFAULT_MEDICARD_VERSION,
);

/** Same public identity. Kept so older imports keep working. */
export const STORE_APP_VERSION = APP_VERSION;
export const INTERNAL_APP_VERSION = APP_VERSION;
