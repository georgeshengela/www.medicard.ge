import { AppState, type AppStateStatus } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type UpdatesModule = typeof import('expo-updates');

/** Builds made before 1.0.0.17.0 (and Expo Go variants) may lack the native module: then OTA simply stays off. */
function loadUpdates(): UpdatesModule | null {
  if (!requireOptionalNativeModule('ExpoUpdates')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-updates') as UpdatesModule;
  } catch {
    return null;
  }
}

let Updates: UpdatesModule | null = null;

/**
 * Over-the-air updates (EAS Update, `npm run ota`). expo-updates already checks on every cold
 * start (app.config.js `checkAutomatically: ON_LOAD`, never blocking the splash). Many people
 * only background the app, so we also check when it comes back to the foreground, download
 * quietly, and switch to the new bundle the next time the app returns after ≥10 minutes away —
 * never in the middle of something the person is doing.
 */
const CHECK_EVERY_MS = 60 * 60 * 1000;
const APPLY_AFTER_AWAY_MS = 10 * 60 * 1000;

let started = false;
let lastCheck = 0;
let ready = false;
let backgroundedAt = 0;

async function checkAndFetch() {
  if (!Updates) return;
  if (Date.now() - lastCheck < CHECK_EVERY_MS) return;
  lastCheck = Date.now();
  try {
    const found = await Updates.checkForUpdateAsync();
    if (!found.isAvailable) return;
    const fetched = await Updates.fetchUpdateAsync();
    if (fetched.isNew) ready = true;
  } catch {
    /* offline or no update server — the next foreground retries */
  }
}

export function startOtaUpdates() {
  if (started || __DEV__) return;
  Updates = loadUpdates();
  if (!Updates?.isEnabled) return;
  started = true;
  AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'background') {
      backgroundedAt = Date.now();
      return;
    }
    if (next !== 'active') return;
    const away = backgroundedAt ? Date.now() - backgroundedAt : 0;
    backgroundedAt = 0;
    if (ready && away >= APPLY_AFTER_AWAY_MS) {
      void Updates?.reloadAsync().catch(() => undefined);
      return;
    }
    void checkAndFetch();
  });
}
