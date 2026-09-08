import { mergeLabPanelLists } from '@/lib/labMerge';
import { loadCanonicalLabPanels, replaceLabPanels } from '@/lib/labStore';
import { loadDoseLogs } from '@/lib/medications.shared';
import { setScopedPreference } from '@/lib/localAccount';
import { api, type AccountAppState } from '@/lib/api';
import { loadRunHistory } from '@/lib/run/history';
import { loadStepsGoal } from '@/lib/stepsGoal';
import { loadReachedStepsGoals } from '@/lib/stepsGoalHistory';
import { loadSymptomHistory } from '@/lib/symptomResultStorage';
import { loadWeightGoal, loadWeightLogs } from '@/lib/weightGoal';
import { setPreference } from '@/lib/storage';
import type { LabPanel } from '@/types/lab';

const DOSE_LOG_KEY = 'medicard.meds.doseLogs';
const RUN_KEY = 'medicard.run.history.v1';
const STEPS_KEY = 'medicard.steps.goal.v1';
const STEPS_HISTORY_KEY = 'medicard.steps.goal.history';
const SYMPTOM_KEY = 'medicard.symptom-check-history';
const WEIGHT_GOAL_KEY = 'medicard.weight.goal.v1';
const WEIGHT_LOGS_KEY = 'medicard.weight.logs.v1';

let pulledThisSession = false;
let applyingRemote = false;
let lastPullAt = 0;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function mergeById<T>(left: T[], right: T[], idOf: (row: T) => string, newer: (a: T, b: T) => boolean): T[] {
  const map = new Map<string, T>();
  for (const row of [...left, ...right]) {
    const id = idOf(row);
    if (!id) continue;
    const prev = map.get(id);
    if (!prev || newer(row, prev)) map.set(id, row);
  }
  return [...map.values()];
}

function pickNewer<T extends { startedYmd?: string; updatedAt?: string; deadlineYmd?: string }>(
  a: T | null,
  b: T | null,
): T | null {
  if (!a) return b;
  if (!b) return a;
  const stamp = (row: T) => String(row.updatedAt ?? row.startedYmd ?? row.deadlineYmd ?? '');
  return stamp(a) >= stamp(b) ? a : b;
}

export function mergeAccountState(local: AccountAppState, remote: AccountAppState): AccountAppState {
  return {
    labPanels: mergeLabPanelLists(local.labPanels ?? [], remote.labPanels ?? []),
    weightGoal: pickNewer(local.weightGoal, remote.weightGoal),
    weightLogs: mergeById(local.weightLogs ?? [], remote.weightLogs ?? [], (row) => row.id, (a, b) => a.at > b.at),
    stepsGoal: pickNewer(local.stepsGoal, remote.stepsGoal),
    stepsGoalHistory: mergeById(
      local.stepsGoalHistory ?? [],
      remote.stepsGoalHistory ?? [],
      (row) => row.id,
      (a, b) => a.completedYmd > b.completedYmd,
    ),
    runHistory: mergeById(local.runHistory ?? [], remote.runHistory ?? [], (row) => row.id, (a, b) => a.endedAt > b.endedAt),
    doseLogs: mergeById(
      local.doseLogs ?? [],
      remote.doseLogs ?? [],
      (row) => `${row.medicationId}|${row.date}|${row.time}`,
      (a, b) => a.updatedAt > b.updatedAt,
    ),
    symptomHistory: mergeById(
      local.symptomHistory ?? [],
      remote.symptomHistory ?? [],
      (row) => row.recordId,
      (a, b) => a.createdAt > b.createdAt,
    ),
    updatedAt: [local.updatedAt, remote.updatedAt].filter(Boolean).sort().at(-1) ?? new Date().toISOString(),
  };
}

async function collectLocalState(): Promise<AccountAppState> {
  const [labPanels, weightGoal, weightLogs, stepsGoal, stepsGoalHistory, runHistory, doseLogs, symptomHistory] =
    await Promise.all([
      loadCanonicalLabPanels(),
      loadWeightGoal(),
      loadWeightLogs(),
      loadStepsGoal(),
      loadReachedStepsGoals(),
      loadRunHistory(),
      loadDoseLogs(),
      loadSymptomHistory(),
    ]);
  return {
    labPanels,
    weightGoal,
    weightLogs,
    stepsGoal,
    stepsGoalHistory,
    runHistory,
    doseLogs,
    symptomHistory,
    updatedAt: new Date().toISOString(),
  };
}

async function applyLocalState(state: AccountAppState): Promise<void> {
  applyingRemote = true;
  try {
    await replaceLabPanels(state.labPanels ?? []);
    await Promise.all([
    state.weightGoal
      ? setScopedPreference(WEIGHT_GOAL_KEY, JSON.stringify(state.weightGoal))
      : setScopedPreference(WEIGHT_GOAL_KEY, ''),
    setScopedPreference(WEIGHT_LOGS_KEY, JSON.stringify(state.weightLogs ?? [])),
    state.stepsGoal
      ? setScopedPreference(STEPS_KEY, JSON.stringify(state.stepsGoal))
      : setScopedPreference(STEPS_KEY, ''),
    setPreference(STEPS_KEY, state.stepsGoal ? JSON.stringify(state.stepsGoal) : ''),
    setScopedPreference(STEPS_HISTORY_KEY, JSON.stringify(state.stepsGoalHistory ?? [])),
    setPreference(STEPS_HISTORY_KEY, JSON.stringify(state.stepsGoalHistory ?? [])),
    setScopedPreference(RUN_KEY, JSON.stringify(state.runHistory ?? [])),
    setScopedPreference(DOSE_LOG_KEY, JSON.stringify(state.doseLogs ?? [])),
    setScopedPreference(SYMPTOM_KEY, JSON.stringify(state.symptomHistory ?? [])),
    ]);
  } finally {
    applyingRemote = false;
  }
}

export async function pullAccountState(): Promise<AccountAppState | null> {
  if (pulledThisSession && Date.now() - lastPullAt < 15_000) {
    return collectLocalState();
  }
  try {
    const local = await collectLocalState();
    const { state: remote } = await api.account.getAppState();
    const merged = mergeAccountState(local, remote);
    await applyLocalState(merged);
    pulledThisSession = true;
    lastPullAt = Date.now();
    void api.account.putAppState(merged).catch(() => undefined);
    return merged;
  } catch {
    return collectLocalState();
  }
}

export async function pullLabPanels(): Promise<LabPanel[]> {
  const state = await pullAccountState();
  return state?.labPanels ?? loadCanonicalLabPanels();
}

export async function pushAccountState(): Promise<void> {
  if (!pulledThisSession) return;
  try {
    const local = await collectLocalState();
    await api.account.putAppState(local);
  } catch {
    /* keep local; next login will retry */
  }
}

export function scheduleAccountSyncPush(): void {
  if (applyingRemote) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushAccountState();
  }, 900);
}

export function resetAccountSync(): void {
  pulledThisSession = false;
  applyingRemote = false;
  lastPullAt = 0;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
}
