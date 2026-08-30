import { getPreference, setPreference } from '@/lib/storage';

const KEY = 'medicard.cycle.share.pending';
const TOKEN_RE = /^[a-f0-9]{64}$/i;

export function isCycleShareCode(code: string | undefined | null): boolean {
  return TOKEN_RE.test(String(code || '').trim());
}

export async function savePendingCycleShare(code: string): Promise<void> {
  const next = String(code || '').trim().toLowerCase();
  if (!isCycleShareCode(next)) return;
  await setPreference(KEY, next);
}

export async function consumePendingCycleShare(): Promise<string | null> {
  const raw = (await getPreference(KEY))?.trim().toLowerCase() ?? '';
  await setPreference(KEY, '');
  return isCycleShareCode(raw) ? raw : null;
}
