import { Platform } from 'react-native';
import { Notifications } from '@/lib/expoNotifications';
import { ka } from '@/i18n/ka';
import { applyPushCopy } from '@/lib/pushCopy';
import {
  cancelNotificationsByPrefix,
  NOTIF_PREFIX,
  WEIGHT_CHANNEL_ID,
  requestNotificationPermission,
} from '@/lib/notifications';
import { expoWeekdayFromMonday } from '@/lib/notificationPlan';
import { getScopedPreference, localAccountId, setLocalAccountId, setScopedPreference } from '@/lib/localAccount';
import { loadSessionSnapshot } from '@/lib/sessionSnapshot';
import type { HealthProfile } from '@/lib/api';
import { bmiFromWeight } from '@/lib/bmi';
import type { WeightGoal, WeightGoalDraft, WeightLog } from '@/types/weightGoal';
import { PACE_KG, clampKg, deadlineFromPace, todayYmd, ymd } from '@/lib/weightGoal.shared';

export {
  KG_TO_LB,
  PACE_KG,
  WEEKDAY_LETTERS,
  addDaysYmd,
  averageKg,
  buildWeightProgress,
  clampKg,
  daysBetween,
  deadlineFromPace,
  estimatedKcalFromPace,
  kgToLb,
  lbToKg,
  monthChangePct,
  paceFromSlider,
  recommendWeightPace,
  resolveCurrentWeightKg,
  sliderFromPace,
  todayYmd,
  weeksFromPace,
  ymd,
} from '@/lib/weightGoal.shared';
export type { WeightPaceAdvice, WeightPaceFacts, WeightPaceReason } from '@/lib/weightGoal.shared';

const GOAL_KEY = 'medicard.weight.goal.v1';
const DRAFT_KEY = 'medicard.weight.goal.draft.v1';
const LOGS_KEY = 'medicard.weight.logs.v1';

export function formatDeadlineKa(deadlineYmd: string): string {
  return new Date(`${deadlineYmd}T12:00:00`).toLocaleDateString('ka-GE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDeadlineKaLong(deadlineYmd: string): string {
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
  const names = ka.weightGoal.weekdayShort;
  const selected = [...days].sort((a, b) => a - b).map((d) => names[d]);
  if (!selected.length) return ka.weightGoal.reminderOff;
  if (selected.length === 7) return ka.weightGoal.reminderDaily;
  return selected.join(', ');
}

function parseGoal(raw: string | null): WeightGoal | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WeightGoal;
    if (!parsed?.id || !parsed.targetKg) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function loadWeightGoal(): Promise<WeightGoal | null> {
  return parseGoal(await getScopedPreference(GOAL_KEY));
}

export async function saveWeightGoal(goal: WeightGoal): Promise<void> {
  await setScopedPreference(GOAL_KEY, JSON.stringify(goal));
  await syncWeightGoalReminders(goal);
  void import('@/lib/accountSync').then(({ scheduleAccountSyncPush }) => scheduleAccountSyncPush());
}

export async function clearWeightGoal(): Promise<void> {
  await setScopedPreference(GOAL_KEY, '');
  await cancelNotificationsByPrefix(NOTIF_PREFIX.weight);
  void import('@/lib/accountSync').then(({ scheduleAccountSyncPush }) => scheduleAccountSyncPush());
}

export async function loadWeightDraft(): Promise<WeightGoalDraft | null> {
  const raw = await getScopedPreference(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WeightGoalDraft;
  } catch {
    return null;
  }
}

export async function saveWeightDraft(draft: WeightGoalDraft): Promise<void> {
  await setScopedPreference(DRAFT_KEY, JSON.stringify(draft));
}

export async function clearWeightDraft(): Promise<void> {
  await setScopedPreference(DRAFT_KEY, '');
}

export function createWeightDraft(startKg: number): WeightGoalDraft {
  const targetKg = clampKg(startKg - 3);
  return {
    id: `wgoal-${Date.now()}`,
    startKg,
    targetKg,
    startedYmd: todayYmd(),
    pace: 'moderate',
    paceKgPerWeek: PACE_KG.moderate,
    deadlineYmd: deadlineFromPace(startKg, targetKg, 'moderate'),
    reminderEnabled: true,
    reminderDays: [1, 3, 4],
    reminderHour: 12,
    reminderMinute: 0,
  };
}

export async function loadWeightLogs(): Promise<WeightLog[]> {
  const raw = await getScopedPreference(LOGS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WeightLog[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row?.id && typeof row.kg === 'number')
      .sort((a, b) => b.at.localeCompare(a.at));
  } catch {
    return [];
  }
}

export async function saveWeightLogs(logs: WeightLog[]): Promise<void> {
  await setScopedPreference(LOGS_KEY, JSON.stringify(logs));
  void import('@/lib/accountSync').then(({ scheduleAccountSyncPush }) => scheduleAccountSyncPush());
}

async function ensureWeightAccountScope() {
  if (localAccountId()) return;
  const snapshot = await loadSessionSnapshot();
  if (snapshot?.user?.id) setLocalAccountId(snapshot.user.id);
  if (!localAccountId()) {
    throw new Error('ანგარიში ვერ მოიძებნა. გთხოვთ, ხელახლა შეხვიდეთ.');
  }
}

export async function upsertTodayWeight(kg: number, at = new Date().toISOString()): Promise<WeightLog[]> {
  await ensureWeightAccountScope();
  const day = ymd(new Date(at));
  const next: WeightLog = {
    id: `wlog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kg: clampKg(kg),
    at,
    date: day,
  };
  const merged = [next, ...(await loadWeightLogs()).filter((row) => row.date !== day)];
  await saveWeightLogs(merged);
  return merged;
}

export async function addWeightLog(kg: number, at = new Date().toISOString()): Promise<WeightLog[]> {
  return upsertTodayWeight(kg, at);
}

export function withUpdatedWeight(profile: HealthProfile | null | undefined, kg: number): HealthProfile | null {
  if (!profile) return null;
  const weightKg = clampKg(kg);
  return {
    ...profile,
    weightKg,
    bmi: bmiFromWeight(weightKg, profile.heightCm) ?? profile.bmi,
  };
}

export async function removeWeightLog(id: string): Promise<WeightLog[]> {
  const next = (await loadWeightLogs()).filter((row) => row.id !== id);
  await saveWeightLogs(next);
  return next;
}

export async function seedWeightLogs(points: Array<{ kg: number; date: string }>): Promise<WeightLog[]> {
  const existing = await loadWeightLogs();
  if (existing.length) return existing;
  const seeded = points
    .filter((row) => Number.isFinite(row.kg))
    .map((row, i) => ({
      id: `wseed-${row.date}-${i}`,
      kg: clampKg(row.kg),
      at: `${row.date}T12:00:00.000Z`,
      date: row.date,
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
  if (seeded.length) await saveWeightLogs(seeded);
  return seeded;
}

export async function syncWeightGoalReminders(goal: WeightGoal): Promise<void> {
  await cancelNotificationsByPrefix(NOTIF_PREFIX.weight);
  if (!goal.reminderEnabled || !goal.reminderDays.length) return;
  if (Platform.OS === 'web') return;
  const granted = await requestNotificationPermission();
  if (!granted) return;
  const latestKg = (await loadWeightLogs())[0]?.kg;
  const copy = applyPushCopy('weight', { kg: latestKg != null ? String(latestKg) : '' });
  for (const day of goal.reminderDays) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIF_PREFIX.weight}${goal.id}:${day}`,
      content: {
        title: copy.title,
        body: copy.body,
        sound: 'default',
        data: { type: 'weight-goal', templateKey: 'weight', goalId: goal.id, route: '/health-metrics/weight' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekdayFromMonday(day),
        hour: goal.reminderHour,
        minute: goal.reminderMinute,
        ...(Platform.OS === 'android' ? { channelId: WEIGHT_CHANNEL_ID } : {}),
      },
    });
  }
}

export function localWeightTips(bmi: number | null): string[] {
  if (bmi == null) return [...ka.weight.tipsGeneric];
  if (bmi < 18.5) return [...ka.weight.tipsLow];
  if (bmi < 25) return [...ka.weight.tipsOk];
  return [...ka.weight.tipsHigh];
}

export function localWeightBlurb(bmi: number | null): string {
  if (bmi == null) return ka.weight.blurbEmpty;
  if (bmi < 18.5) return ka.weight.blurbLow;
  if (bmi < 25) return ka.weight.blurbOk;
  if (bmi < 30) return ka.weight.blurbHigh;
  return ka.weight.blurbObese;
}

const ADVICE_KEY = 'medicard.weight.advice.v1';

export type CachedWeightAdvice = {
  blurb: string;
  tips: string[];
  kg: number;
  ymd: string;
  fromAi: boolean;
};

export async function loadCachedWeightAdvice(): Promise<CachedWeightAdvice | null> {
  const raw = await getScopedPreference(ADVICE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedWeightAdvice;
  } catch {
    return null;
  }
}

export async function saveCachedWeightAdvice(row: CachedWeightAdvice): Promise<void> {
  await setScopedPreference(ADVICE_KEY, JSON.stringify(row));
}

export function draftToGoal(draft: WeightGoalDraft): WeightGoal | null {
  if (!draft.id || !draft.targetKg || !draft.startKg || !draft.deadlineYmd || !draft.startedYmd) return null;
  const pace = draft.pace ?? 'moderate';
  return {
    id: draft.id,
    targetKg: clampKg(draft.targetKg),
    startKg: clampKg(draft.startKg),
    startedYmd: draft.startedYmd,
    deadlineYmd: draft.deadlineYmd,
    pace,
    paceKgPerWeek: draft.paceKgPerWeek ?? PACE_KG[pace],
    reminderEnabled: draft.reminderEnabled ?? true,
    reminderDays: draft.reminderDays ?? [1, 3, 4],
    reminderHour: draft.reminderHour ?? 12,
    reminderMinute: draft.reminderMinute ?? 0,
  };
}

