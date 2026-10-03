/**
 * Runs the temperature import (`cycleTemperatureImport.ts`) on /cycle focus. Per account and device:
 * the switch (`cycleTemperature.enabled.<userId>`, off by default) and the last run
 * (`cycleTemperature.lastImportAt.<userId>`). At most once per 6 h, one run at a time, the last-run time
 * written BEFORE Health is read — a crash, a refetch or a socket event can never turn it into a loop
 * (AGENTS „Health-sync loop incident“). It only reads Health; access is requested by the settings
 * switch alone (`CycleTemperatureRow`), never here.
 */
import type { CycleBundle } from '@/lib/api';
import { api } from '@/lib/api';
import { cacheCycleBundle } from '@/lib/cycleOffline';
import { putCycleBundle } from '@/lib/cycleViewCache';
import { isHealthPlatformSupported, readHealthTemperature } from '@/lib/healthSync';
import { getPreference, setPreference } from '@/lib/storage';
import {
  TEMPERATURE_IMPORT_DAYS,
  planTemperatureReadings,
  shouldImportTemperature,
} from '@/lib/cycleTemperatureImport';

const enabledKey = (userId: string) => `cycleTemperature.enabled.${userId}`;
const lastKey = (userId: string) => `cycleTemperature.lastImportAt.${userId}`;

export async function isCycleTemperatureEnabled(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  return (await getPreference(enabledKey(userId)).catch(() => null)) === '1';
}

/** Turning it on clears the last run, so the next /cycle visit imports at once. */
export async function setCycleTemperatureEnabled(userId: string, on: boolean): Promise<void> {
  await setPreference(enabledKey(userId), on ? '1' : '0');
  if (on) await setPreference(lastKey(userId), '0').catch(() => undefined);
}

let inFlight = false;

/** Imports when due. Returns how many days changed (0 when not due, nothing new or anything failed). */
export async function maybeImportCycleTemperature({
  userId,
  bundle,
  today,
  now = Date.now(),
}: {
  userId: string | null | undefined;
  bundle: CycleBundle | null | undefined;
  today: string;
  now?: number;
}): Promise<number> {
  if (inFlight || !userId || !bundle) return 0;
  inFlight = true;
  try {
    const enabled = await isCycleTemperatureEnabled(userId);
    const lastAt = Number((await getPreference(lastKey(userId)).catch(() => null)) ?? 0);
    if (!shouldImportTemperature({ enabled, mode: bundle.profile?.mode, supported: isHealthPlatformSupported(), lastAt, now })) {
      return 0;
    }
    await setPreference(lastKey(userId), String(now));
    const since = new Date(now);
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (TEMPERATURE_IMPORT_DAYS - 1));
    const read = await readHealthTemperature(since);
    const readings = planTemperatureReadings({ logs: bundle.logs ?? [], read, today });
    if (!readings.length) return 0;
    const result = await api.cycle.importTemperature(readings);
    if (result.bundle) {
      putCycleBundle(userId, result.bundle);
      void cacheCycleBundle(userId, result.bundle).catch(() => undefined);
    }
    return result.imported ?? 0;
  } catch {
    // An older server (404), no network, Health unavailable: quietly try again after the 6 h window.
    return 0;
  } finally {
    inFlight = false;
  }
}
