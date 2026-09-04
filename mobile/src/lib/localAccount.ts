import { deletePreference, getPreference, setPreference, setPreferenceStrict } from '@/lib/storage';

/** Device-global leftovers from before per-account keys — never replay User A into User B. */
const LEGACY_UNSCOPED = [
  'medicard.hydration.logs',
  'medicard.hydration.goalMl',
  'medicard.lab.panels.v1',
  'medicard.meds.doseLogs',
  'medicard.skincare-routines',
  'medicard.symptom-check-history',
] as const;

let accountId: string | null = null;

export function setLocalAccountId(userId: string | null) {
  accountId = userId && userId.length > 0 ? userId : null;
}

export function localAccountId(): string | null {
  return accountId;
}

export function scopedPrefKey(base: string): string | null {
  if (!accountId) return null;
  return `${base}.${accountId}`;
}

export async function getScopedPreference(base: string): Promise<string | null> {
  const key = scopedPrefKey(base);
  if (!key) return null;
  return getPreference(key);
}

export async function setScopedPreference(base: string, value: string): Promise<void> {
  const key = scopedPrefKey(base);
  if (!key) return;
  await setPreference(key, value);
}

export async function setScopedPreferenceStrict(base: string, value: string): Promise<void> {
  const key = scopedPrefKey(base);
  if (!key) return;
  await setPreferenceStrict(key, value);
}

export async function wipeLegacyUnscopedHealthCaches(): Promise<void> {
  await Promise.all(LEGACY_UNSCOPED.map((key) => deletePreference(key)));
}
