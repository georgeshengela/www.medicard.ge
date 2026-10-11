import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { isHealthSyncEnabled } from '@/lib/healthSync.shared';
import { sleepNightDetails } from '@/lib/sleepNights';
import { ymd } from './sleepTime';

/**
 * Nights from Apple Health / Health Connect into MEDISLEEP (bed and wake times, asleep minutes and stages from
 * a Watch, Oura, Fitbit…). Read-only, only when she already connected Health (never asks for access), at most
 * every 30 minutes, the last 21 days. The server keeps her check-in untouched and never lets Health override
 * times she typed herself.
 */
const MIN_GAP_MS = 30 * 60_000;
const DAYS = 21;
let lastRun = 0;
let running: Promise<number> | null = null;

async function platform() {
  if (Constants.appOwnership === 'expo') return null;
  if (Platform.OS === 'ios') return import('@/lib/healthSyncPlatform.ios');
  if (Platform.OS === 'android') return import('@/lib/healthSyncPlatform.android');
  return null;
}

export function importSleepFromHealth({ force = false } = {}): Promise<number> {
  if (running) return running;
  if (!force && Date.now() - lastRun < MIN_GAP_MS) return Promise.resolve(0);
  const owner = localAccountId();
  if (!owner) return Promise.resolve(0);
  lastRun = Date.now();
  running = (async () => {
    if (!(await isHealthSyncEnabled().catch(() => false))) return 0;
    const native = await platform();
    if (!native || typeof native.fetchSleepPiecesNative !== 'function') return 0;
    const first = new Date();
    first.setDate(first.getDate() - DAYS);
    const since = new Date(first.getFullYear(), first.getMonth(), first.getDate(), 6, 0, 0);
    const pieces = await native.fetchSleepPiecesNative(since);
    const nights = sleepNightDetails(pieces, ymd(new Date(since.getTime() + 86_400_000)))
      // Tonight is not over: a night counts once it ended at least 10 minutes ago.
      .filter((n) => Date.parse(n.wakeAt) < Date.now() - 10 * 60_000);
    if (!nights.length || localAccountId() !== owner) return 0;
    const { changed } = await api.sleep.importNights(nights.map((n) => ({ ...n, kind: 'health' as const })));
    return changed;
  })()
    .catch(() => 0)
    .finally(() => {
      running = null;
    });
  return running;
}
