import { getPreference, setPreference } from '@/lib/storage';
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
  return parseReachedGoals(await getPreference(HISTORY_KEY));
}

export async function archiveReachedStepsGoal(record: StepsGoalRecord): Promise<void> {
  const list = await loadReachedStepsGoals();
  const next = [record, ...list.filter((row) => row.id !== record.id)].slice(0, HISTORY_MAX);
  await setPreference(HISTORY_KEY, JSON.stringify(next));
}
