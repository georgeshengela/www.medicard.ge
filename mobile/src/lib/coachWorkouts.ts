import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '@/lib/api';
import { getPreference, setPreference } from '@/lib/storage';
import { localAccountId } from '@/lib/localAccount';
import type { HealthConnectResult } from '@/lib/healthSync.shared';

/**
 * MEDICOACH: workout summaries from Apple Health / Health Connect, uploaded only while the person
 * shares "workouts" with an active trainer (the server drops them otherwise). Per account + device.
 * Permission is requested only from a button press (iOS 26 rule, AGENTS.md).
 */
const key = (owner: string) => `medicard.coach.workouts.v1.${owner}`;
const lastKey = (owner: string) => `medicard.coach.workouts.last.v1.${owner}`;
const MIN_INTERVAL_MS = 20 * 60 * 1000;

async function impl() {
  if (Constants.appOwnership === 'expo') return null;
  if (Platform.OS === 'ios') return import('@/lib/healthSyncPlatform.ios');
  if (Platform.OS === 'android') return import('@/lib/healthSyncPlatform.android');
  return null;
}

export function workoutsHealthName(): string | null {
  return Platform.OS === 'ios' ? 'Apple Health' : Platform.OS === 'android' ? 'Health Connect' : null;
}

export async function isCoachWorkoutsEnabled(owner = localAccountId()): Promise<boolean> {
  if (!owner || !workoutsHealthName()) return false;
  return (await getPreference(key(owner))) === '1';
}

/** Button press only: shows the system sheet, then syncs once. */
export async function enableCoachWorkouts(owner = localAccountId()): Promise<HealthConnectResult> {
  if (!owner) return { ok: false, reason: 'error' };
  if (Constants.appOwnership === 'expo') return { ok: false, reason: 'expo_go' };
  const native = await impl();
  if (!native) return { ok: false, reason: 'unavailable' };
  const result = await native.connectWorkoutsNative();
  if (result.ok && localAccountId() === owner) {
    await setPreference(key(owner), '1');
    void syncCoachWorkouts({ force: true });
  }
  return result;
}

export async function disableCoachWorkouts(owner = localAccountId()) {
  if (owner) await setPreference(key(owner), '0');
}

/** Upload the last 30 days of workouts. Quietly does nothing when not enabled or not shared. */
export async function syncCoachWorkouts({ force = false } = {}): Promise<number> {
  const owner = localAccountId();
  if (!owner || !(await isCoachWorkoutsEnabled(owner))) return 0;
  const last = Number((await getPreference(lastKey(owner))) || 0);
  if (!force && Date.now() - last < MIN_INTERVAL_MS) return 0;
  const native = await impl();
  if (!native) return 0;
  try {
    const workouts = await native.fetchWorkoutsNative(new Date(Date.now() - 30 * 86400000));
    if (localAccountId() !== owner) return 0;
    await setPreference(lastKey(owner), String(Date.now()));
    if (!workouts.length) return 0;
    const res = await api.coach.syncWorkouts(workouts);
    return res.saved;
  } catch (error) {
    console.warn('[coach] workout sync failed', (error as Error)?.message);
    return 0;
  }
}
