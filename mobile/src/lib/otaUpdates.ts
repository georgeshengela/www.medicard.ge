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
const busyChecks = new Set<() => boolean>();

/**
 * Soft update card (owner 2026-10-11): when an update is downloaded the app offers „განახლება“ right
 * away instead of waiting for ≥10 minutes away. `auto` comes from /api/app/status (admin switch, on by
 * default); `ask` = the admin asked this version to look for the update now (once per request id).
 */
let promptAuto = true;
let askedId: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/** True while a downloaded update waits and the card may be shown. */
export function otaCardVisible(): boolean {
  return ready && promptAuto;
}

export function subscribeOta(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** From /api/app/status `client.updatePrompt` (older servers send nothing: the card stays automatic). */
export function setOtaPromptPolicy(policy: { auto?: boolean; ask?: { id: string } | null } | null | undefined): void {
  promptAuto = policy?.auto !== false;
  emit();
  const id = policy?.ask?.id ?? null;
  if (id && id !== askedId) {
    askedId = id;
    lastCheck = 0; // the admin asked: look now, not on the hourly schedule
    void checkAndFetch();
  }
}

/**
 * The card's button: restart into the downloaded update now. `busy` while a MEDIRUN session runs (a
 * reload would drop it); `none` when there is nothing to apply (or no update module, e.g. Expo Go).
 */
export async function applyOtaNow(): Promise<'reloading' | 'busy' | 'none'> {
  if (!Updates || !ready) return 'none';
  if (busy()) return 'busy';
  try {
    await Updates.reloadAsync();
    return 'reloading';
  } catch {
    return 'none';
  }
}

/** While `isBusy()` is true a downloaded update waits: a reload would drop live work (a MEDIRUN session). */
export function holdOtaReloadWhile(isBusy: () => boolean): void {
  busyChecks.add(isBusy);
}

function busy(): boolean {
  for (const check of busyChecks) {
    try {
      if (check()) return true;
    } catch {
      /* a broken check never blocks updates */
    }
  }
  return false;
}

async function checkAndFetch() {
  if (!Updates) return;
  if (Date.now() - lastCheck < CHECK_EVERY_MS) return;
  lastCheck = Date.now();
  try {
    const found = await Updates.checkForUpdateAsync();
    if (!found.isAvailable) return;
    // isNew is false when expo-updates already downloaded it at launch (ON_LOAD): it still waits to run.
    await Updates.fetchUpdateAsync();
    ready = true;
    emit();
  } catch {
    /* offline or no update server — the next foreground retries */
  }
}

export function startOtaUpdates() {
  if (started || __DEV__) return;
  Updates = loadUpdates();
  if (!Updates?.isEnabled) return;
  started = true;
  // A first look shortly after launch, so an update can be offered in this very session.
  setTimeout(() => void checkAndFetch(), 4000);
  AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'background') {
      backgroundedAt = Date.now();
      return;
    }
    if (next !== 'active') return;
    const away = backgroundedAt ? Date.now() - backgroundedAt : 0;
    backgroundedAt = 0;
    if (ready && away >= APPLY_AFTER_AWAY_MS && !busy()) {
      void Updates?.reloadAsync().catch(() => undefined);
      return;
    }
    void checkAndFetch();
  });
}
