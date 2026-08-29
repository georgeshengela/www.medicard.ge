import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ka } from '@/i18n/ka';
import { api, type User } from '@/lib/api';
import { cancelNotificationsByPrefix, NOTIF_PREFIX, requestNotificationPermission } from '@/lib/notifications';
import { getPreference, setPreference } from '@/lib/storage';
import { archiveReachedStepsGoal } from '@/lib/stepsGoalHistory';
import type { StepsGoal, StepsGoalProgress } from '@/types/stepsGoal';

const STORAGE_KEY = 'medicard.steps.goal.v1';
const PENDING_AWARDS_KEY = 'medicard.steps.goal.pendingAwards';

export const STEPS_GOAL_PRESETS = [2000, 3000, 4000, 5000] as const;
export const STEPS_GOAL_RECOMMENDED = 5000;
export const STEPS_GOAL_MIN = 500;
export const STEPS_GOAL_MAX = 100_000;
export const STEPS_GOAL_FIELD_STEP = 100;
export const STEPS_GOAL_SHEET_STEP = 500;

export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayYmd(): string {
  return ymd(new Date());
}

export function addDaysYmd(fromYmd: string, days: number): string {
  const d = new Date(`${fromYmd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return ymd(d);
}

export function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T12:00:00`).getTime();
  const b = new Date(`${toYmd}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function clampGoalSteps(value: number): number {
  return Math.min(STEPS_GOAL_MAX, Math.max(STEPS_GOAL_MIN, Math.round(value / 100) * 100));
}

export function defaultDeadlineYmd(): string {
  return addDaysYmd(todayYmd(), 21);
}

export function formatDeadlineKa(deadlineYmd: string): string {
  return new Date(`${deadlineYmd}T12:00:00`).toLocaleDateString('ka-GE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatReminderTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString('ka-GE', { hour: 'numeric', minute: '2-digit' });
}

export function reminderDaysLabel(days: number[]): string {
  const names = ka.stepsGoal.weekdayShort;
  const selected = [...days].sort((a, b) => a - b).map((d) => names[d]);
  if (selected.length === 0) return '';
  if (selected.length === 1) return selected[0];
  if (selected.length === 2) return `${selected[0]} ${ka.common.and} ${selected[1]}`;
  return `${selected.slice(0, -1).join(', ')} ${ka.common.and} ${selected[selected.length - 1]}`;
}

export async function loadStepsGoal(): Promise<StepsGoal | null> {
  const raw = await getPreference(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StepsGoal;
    if (!parsed?.id || !parsed.targetSteps || !parsed.deadlineYmd) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveStepsGoal(goal: StepsGoal): Promise<void> {
  await setPreference(STORAGE_KEY, JSON.stringify(goal));
  await syncStepsGoalReminders(goal);
}

export async function clearStepsGoal(): Promise<void> {
  await setPreference(STORAGE_KEY, '');
  await cancelNotificationsByPrefix(NOTIF_PREFIX.steps);
}

export async function archiveAndClearStepsGoal(goal: StepsGoal, currentSteps: number): Promise<void> {
  await archiveReachedStepsGoal({
    id: goal.id,
    targetSteps: goal.targetSteps,
    startedYmd: goal.startedYmd,
    deadlineYmd: goal.deadlineYmd,
    completedYmd: todayYmd(),
    currentSteps,
  });
  await clearStepsGoal();
}

function parsePendingAwardIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((id) => String(id || '').trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

export async function queueStepsGoalAward(goalId: string): Promise<void> {
  const id = goalId.trim();
  if (!id) return;
  const list = parsePendingAwardIds(await getPreference(PENDING_AWARDS_KEY));
  if (list.includes(id)) return;
  await setPreference(PENDING_AWARDS_KEY, JSON.stringify([...list, id]));
}

/** Retry queued +3 bonuses. Successful or already-claimed ids are dropped. */
export async function flushStepsGoalAwards(applyUser?: (user: User) => void): Promise<number> {
  const list = parsePendingAwardIds(await getPreference(PENDING_AWARDS_KEY));
  if (list.length === 0) return 0;

  const remaining: string[] = [];
  let awarded = 0;
  for (const goalId of list) {
    try {
      const result = await api.checkIn.awardStepsGoal(goalId);
      if (result.user) applyUser?.(result.user);
      if (result.awarded) awarded += result.pointsAwarded ?? 0;
    } catch {
      remaining.push(goalId);
    }
  }
  await setPreference(PENDING_AWARDS_KEY, JSON.stringify(remaining));
  return awarded;
}

export function buildGoalProgress(goal: StepsGoal, current: number): StepsGoalProgress {
  const daysLeft = Math.max(0, daysBetween(todayYmd(), goal.deadlineYmd));
  const remaining = Math.max(0, goal.targetSteps - current);
  const percent = Math.round((current / Math.max(goal.targetSteps, 1)) * 100);
  return {
    goal,
    current,
    remaining,
    percent,
    daysLeft,
    completed: current >= goal.targetSteps,
  };
}

export function createStepsGoalDraft(): StepsGoal {
  return {
    id: `goal-${Date.now()}`,
    targetSteps: STEPS_GOAL_RECOMMENDED,
    deadlineYmd: defaultDeadlineYmd(),
    startedYmd: todayYmd(),
    reminderEnabled: true,
    reminderDays: [1, 3, 5],
    reminderHour: 10,
    reminderMinute: 0,
  };
}

/** Expo weekday: 1 = Sunday … 7 = Saturday. Our days: 0 = Monday. */
function expoWeekday(mondayIndex: number): number {
  return mondayIndex === 6 ? 1 : mondayIndex + 2;
}

export async function syncStepsGoalReminders(goal: StepsGoal): Promise<void> {
  await cancelNotificationsByPrefix(NOTIF_PREFIX.steps);
  if (!goal.reminderEnabled || goal.reminderDays.length === 0) return;
  if (Platform.OS === 'web') return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  for (const day of goal.reminderDays) {
    const identifier = `${NOTIF_PREFIX.steps}${goal.id}:${day}`;
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: ka.stepsGoal.reminderTitle,
        body: ka.stepsGoal.reminderBody(goal.targetSteps),
        sound: 'default',
        data: { type: 'steps-goal', goalId: goal.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday(day),
        hour: goal.reminderHour,
        minute: goal.reminderMinute,
      },
    });
  }
}
