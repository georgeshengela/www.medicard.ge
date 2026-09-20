import { localAccountId } from '@/lib/localAccount';
import { getPreference, setPreferenceStrict } from '@/lib/storage';
import type { SymptomCheckResult } from '@/types/symptoms';
import type { SymptomCheckerState } from './symptomCheckerStore';

const KEY = 'medicard.symptom-check-history';
const MAX = 24;
const saves = new Map<string, Promise<void>>();

export type SavedSymptomSession = {
  recordId: string;
  createdAt: string;
  symptoms: string[];
  primarySymptom?: string | null;
  durationId?: string | null;
  painLevel?: number | null;
  bodyPartKa?: string | null;
  organKa?: string | null;
  draft?: Pick<SymptomCheckerState, 'gender' | 'method' | 'mode' | 'side' | 'selectedPartId' | 'selectedOrganId' | 'pastConditions' | 'notes' | 'shareToNightingale'>;
  result: SymptomCheckResult;
};

export async function saveSymptomSession(session: SavedSymptomSession, owner = localAccountId()) {
  if (!owner || owner !== localAccountId()) return;
  const run = (saves.get(owner) || Promise.resolve()).then(() => saveSessionForOwner(session, owner));
  const tail = run.catch(() => undefined);
  saves.set(owner, tail);
  void tail.then(() => { if (saves.get(owner) === tail) saves.delete(owner); });
  return run;
}

async function saveSessionForOwner(session: SavedSymptomSession, owner: string) {
  if (owner !== localAccountId()) return;
  const list = await loadSymptomHistory(owner);
  if (owner !== localAccountId()) return;
  const next = [session, ...list.filter((s) => s.recordId !== session.recordId)].slice(0, MAX);
  await setPreferenceStrict(`${KEY}.${owner}`, JSON.stringify(next));
  void import('@/lib/accountSync').then(({ scheduleAccountSyncPush }) => { if (owner === localAccountId()) scheduleAccountSyncPush(); }).catch(() => undefined);
}

export async function loadSymptomHistory(owner = localAccountId()): Promise<SavedSymptomSession[]> {
  if (!owner) return [];
  try {
    const raw = await getPreference(`${KEY}.${owner}`);
    if (owner !== localAccountId()) return [];
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSymptomSession[];
    return Array.isArray(parsed) ? parsed.filter(s => s && typeof s.recordId === 'string' && Array.isArray(s.symptoms) && s.symptoms.every(v => typeof v === 'string') && Array.isArray(s.result?.conditions) && s.result.conditions.every(c => c && typeof c.nameKa === 'string')) : [];
  } catch {
    return [];
  }
}

export async function getSymptomSession(recordId: string): Promise<SavedSymptomSession | null> {
  const list = await loadSymptomHistory();
  return list.find((s) => s.recordId === recordId) ?? null;
}
