import { Platform } from 'react-native';
import { questApi } from './api';
import { readQuestSyncStamp, writeQuestSyncStamp } from './cache';
import { loadHydrationGoalMl } from '@/lib/hydration';
import Constants from 'expo-constants';
import { isHealthPlatformSupported, isHealthSyncEnabled, getHealthPlatform } from '@/lib/healthSync.shared';
import { capabilityFromHealth } from './logic.js';

const HOUR = 60 * 60 * 1000;

export function deviceIanaTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length < 64 ? tz : null;
  } catch {
    return null;
  }
}

export async function syncQuestTimezone(force = false): Promise<void> {
  const tz = deviceIanaTimezone();
  if (!tz) return;
  const stamp = await readQuestSyncStamp();
  if (!force && stamp.timezone === tz && stamp.timezoneAt && Date.now() - stamp.timezoneAt < 12 * HOUR) return;
  await questApi.timezone(tz);
  await writeQuestSyncStamp({ timezone: tz, timezoneAt: Date.now() });
}

export async function syncHydrationGoal(force = false): Promise<void> {
  const local = await loadHydrationGoalMl();
  const stamp = await readQuestSyncStamp();
  if (!force && stamp.goalMl === local && stamp.goalAt && Date.now() - stamp.goalAt < 12 * HOUR) return;
  const remote = await questApi.hydrationGoalGet();
  // Pre-launch policy: local hydration settings are authoritative.
  // Upload once when the server has no goal, or when the two differ.
  // Stamps prevent a PUT loop.
  if (remote.goalMl == null && local) {
    await questApi.hydrationGoalPut(local);
  } else if (remote.goalMl != null && remote.goalMl !== local) {
    await questApi.hydrationGoalPut(local);
  } else if (remote.goalMl == null) {
    return;
  }
  await writeQuestSyncStamp({ goalMl: local, goalAt: Date.now() });
}

export { capabilityFromHealth };

export async function syncStepCapability(force = false): Promise<{ status: string; source: string }> {
  const next = capabilityFromHealth({
    supported: isHealthPlatformSupported(),
    connected: await isHealthSyncEnabled(),
    expoGo: Constants.appOwnership === 'expo',
    platform: getHealthPlatform(),
  });
  const stamp = await readQuestSyncStamp();
  const key = `${next.status}:${next.source}`;
  if (!force && stamp.capability === key && stamp.capabilityAt && Date.now() - stamp.capabilityAt < HOUR) {
    return next;
  }
  await questApi.stepCapabilityPut(next);
  await writeQuestSyncStamp({ capability: key, capabilityAt: Date.now() });
  return next;
}

export async function syncQuestBridges(reason: 'start' | 'foreground' | 'manual' = 'start') {
  const force = reason === 'manual';
  if (Platform.OS === 'web' && reason !== 'manual') {
    await syncQuestTimezone(force).catch(() => undefined);
    await syncHydrationGoal(force).catch(() => undefined);
    return;
  }
  await syncQuestTimezone(force).catch(() => undefined);
  await syncHydrationGoal(force).catch(() => undefined);
  await syncStepCapability(force).catch(() => undefined);
}
