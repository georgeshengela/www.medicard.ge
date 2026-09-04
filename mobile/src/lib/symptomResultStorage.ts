import { getScopedPreference, setScopedPreference } from '@/lib/localAccount';
import type { SymptomCheckResult } from '@/types/symptoms';

const KEY = 'medicard.symptom-check-history';
const MAX = 24;

export type SavedSymptomSession = {
  recordId: string;
  createdAt: string;
  symptoms: string[];
  primarySymptom?: string | null;
  durationId?: string | null;
  painLevel?: number | null;
  bodyPartKa?: string | null;
  organKa?: string | null;
  result: SymptomCheckResult;
};

export async function saveSymptomSession(session: SavedSymptomSession) {
  const list = await loadSymptomHistory();
  const next = [session, ...list.filter((s) => s.recordId !== session.recordId)].slice(0, MAX);
  await setScopedPreference(KEY, JSON.stringify(next));
}

export async function loadSymptomHistory(): Promise<SavedSymptomSession[]> {
  try {
    const raw = await getScopedPreference(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSymptomSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getSymptomSession(recordId: string): Promise<SavedSymptomSession | null> {
  const list = await loadSymptomHistory();
  return list.find((s) => s.recordId === recordId) ?? null;
}
