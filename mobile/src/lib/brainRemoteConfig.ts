import { getPreference, setPreference } from '@/lib/storage';

/**
 * Admin control over Medi's own notifications (admin Push → Brain → „მართვა“; server
 * `server/src/lib/notificationBrainConfig.js`, sent in `/api/app/status` as `brain`).
 * `paused` silences every Medi companion notification, `off` lists families switched off for
 * everyone, `maxPerDay` caps a day below the person's own choice. Medication, visit, cycle and
 * pet reminders the person set are not Brain notifications and are never touched here.
 *
 * Missing or broken answers count as „nothing switched off“; the last answer is cached so a
 * cold start offline keeps the admin's choice.
 */
export type BrainRemoteConfig = { paused: boolean; off: string[]; maxPerDay: number | null };

const CACHE_KEY = 'medicard.brainConfig.v1';
const DEFAULT: BrainRemoteConfig = { paused: false, off: [], maxPerDay: null };
let state: BrainRemoteConfig = DEFAULT;
let hydrated = false;

export function sanitizeBrainConfig(raw: unknown): BrainRemoteConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  const value = raw as Record<string, unknown>;
  const off = Array.isArray(value.off) ? value.off.filter((item): item is string => typeof item === 'string' && item.length < 40) : [];
  const max = Number(value.maxPerDay);
  return {
    paused: value.paused === true,
    off: [...new Set(off)].sort(),
    maxPerDay: Number.isFinite(max) && max >= 1 && max <= 4 ? Math.floor(max) : null,
  };
}

export function brainConfig(): BrainRemoteConfig {
  return state;
}

/** Why the admin keeps this family quiet right now, or null. */
export function brainFamilyBlock(family: string, from: BrainRemoteConfig = state): 'admin_paused' | 'admin_off' | null {
  if (from.paused) return 'admin_paused';
  return from.off.includes(family) ? 'admin_off' : null;
}

/** Apply the `/api/app/status` answer; a change re-plans the scheduled notifications at once. */
export function applyBrainConfig(raw: unknown): void {
  if (raw === undefined) return; // older server: keep what we had
  const next = sanitizeBrainConfig(raw);
  const same = JSON.stringify(next) === JSON.stringify(state);
  state = next;
  hydrated = true;
  void setPreference(CACHE_KEY, JSON.stringify(next)).catch(() => undefined);
  if (!same) {
    void import('@/lib/mediNotificationBrain').then(({ requestEngageRefresh }) => requestEngageRefresh()).catch(() => undefined);
  }
}

export async function hydrateBrainConfig(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await getPreference(CACHE_KEY);
    if (raw && !hydrated) state = sanitizeBrainConfig(JSON.parse(raw));
  } catch {
    /* defaults */
  }
  hydrated = true;
}
