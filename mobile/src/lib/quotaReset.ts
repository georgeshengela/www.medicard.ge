import type { Usage } from '@/lib/api';

export const QUOTA_RESET_PREF = 'medicard.quota.resetShown.v1';
export const QUOTA_RESET_ROUTE = '/chat/DOCTOR';

export function tbilisiYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(now);
}

export function quotaResetKey(usage: Pick<Usage, 'resetAt' | 'exceeded' | 'resetKind'> | null | undefined): string | null {
  if (!usage?.resetAt) return null;
  if (usage.exceeded || usage.resetKind === 'lock') return `lock:${usage.resetAt}`;
  return `cal:${tbilisiYmd(new Date(usage.resetAt))}`;
}

/** True when remaining credits just came back (1/3 leftover or 0/3 lock). */
export function shouldAnnounceQuotaReady(prev: Usage | null | undefined, next: Usage | null | undefined): boolean {
  if (!prev || !next) return false;
  if (next.unlimited || next.exceeded) return false;
  if (next.used !== 0) return false;
  return prev.exceeded || prev.used > 0;
}

export function parseShownKeys(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return raw ? [raw] : [];
  }
}

export function appendShownKey(raw: string | null | undefined, resetKey: string): string {
  const next = parseShownKeys(raw).filter((key) => key !== resetKey);
  next.push(resetKey);
  return JSON.stringify(next.slice(-8));
}
