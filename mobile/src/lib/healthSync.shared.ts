import { Platform } from 'react-native';
import { getPreference, setPreference } from '@/lib/storage';

export const HEALTH_SYNC_PREF = 'medicard.health.sync.enabled';

export type HealthPlatform = 'apple' | 'google';

export type HealthConnectResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'unavailable' | 'denied' | 'not_installed' | 'expo_go' | 'error';
      message?: string;
    };

export type CycleHealthPayload = {
  date: string;
  flow: string | null;
  bbt: number | null;
  cervicalMucus: string | null;
  /** Marks the first day of a new cycle when writing menstrual flow. */
  isPeriodStart?: boolean;
};

export function getHealthPlatform(): HealthPlatform | null {
  if (Platform.OS === 'ios') return 'apple';
  if (Platform.OS === 'android') return 'google';
  return null;
}

export function isHealthPlatformSupported(): boolean {
  return getHealthPlatform() !== null;
}

export async function isHealthSyncEnabled(): Promise<boolean> {
  const raw = await getPreference(HEALTH_SYNC_PREF);
  return raw === '1';
}

export async function setHealthSyncEnabled(enabled: boolean): Promise<void> {
  await setPreference(HEALTH_SYNC_PREF, enabled ? '1' : '0');
}

export function ymdToLocalNoon(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function dateToYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function eighteenMonthsAgo(from = new Date()): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() - 18);
  return d;
}
