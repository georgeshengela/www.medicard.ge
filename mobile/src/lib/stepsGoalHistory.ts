import { getPreference, setPreference } from '@/lib/storage';
import { getScopedPreference, setScopedPreference } from '@/lib/localAccount';
import type { StepsGoalRecord } from '@/types/stepsGoal';

const HISTORY_KEY = 'medicard.steps.goal.history';
const HISTORY_MAX = 30;

function parseReachedGoals(raw: string | null): StepsGoalRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row?.id && row.targetSteps && row.completedYmd);
  } catch {
    return [];
  }
}

export async function loadReachedStepsGoals(): Promise<StepsGoalRecord[]> {
  const raw = (await getScopedPreference(HISTORY_KEY)) ?? (await getPreference(HISTORY_KEY));
  return parseReachedGoals(raw);
}

export async function archiveReachedStepsGoal(record: StepsGoalRecord): Promise<void> {
  const list = await loadReachedStepsGoals();
  const next = [record, ...list.filter((row) => row.id !== record.id)].slice(0, HISTORY_MAX);
  const payload = JSON.stringify(next);
  await setScopedPreference(HISTORY_KEY, payload);
  await setPreference(HISTORY_KEY, payload);
  void import('@/lib/accountSync').then(({ scheduleAccountSyncPush }) => scheduleAccountSyncPush());
}
