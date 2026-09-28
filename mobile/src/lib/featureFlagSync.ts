import { AppState, type AppStateStatus } from 'react-native';
import { api } from '@/lib/api';
import { APP_VERSION } from '@/lib/appVersion';
import { applyFeatureStatus, hydrateFeatureFlags } from '@/lib/featureFlags';

/** A module the admin pauses disappears the next time the app comes to the foreground (≤1 poll a minute). */
const MIN_INTERVAL_MS = 60_000;
let lastFetch = 0;
let inflight: Promise<void> | null = null;
let started = false;

export function refreshFeatureFlags({ force = false } = {}): Promise<void> {
  if (inflight) return inflight;
  if (!force && Date.now() - lastFetch < MIN_INTERVAL_MS) return Promise.resolve();
  lastFetch = Date.now();
  inflight = api.app
    .status(APP_VERSION)
    .then((status) => applyFeatureStatus(status.features, status.featureMessages))
    .catch(() => undefined)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Called once from the root layout: cached flags first, then a live check on every return to the app. */
export function startFeatureFlagSync() {
  if (started) return;
  started = true;
  void hydrateFeatureFlags();
  AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'active') void refreshFeatureFlags();
  });
}

/** AuthGate already fetched /api/app/status at launch; count that as this minute's poll. */
export function noteFeatureStatusFetched() {
  lastFetch = Date.now();
}
