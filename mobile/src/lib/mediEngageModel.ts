export type EngageFrequency = 'rare' | 'balanced' | 'often';

export type EngageTopic =
  | 'hydration'
  | 'stepsSmart'
  | 'weight'
  | 'cycle'
  | 'dailyLog'
  | 'checkin'
  | 'insight'
  | 'weekly'
  | 'achievement'
  | 'chatFollowup'
  | 'reengage'
  | 'feature'
  | 'question'
  | 'birthday'
  | 'sleep'
  | 'morning'
  | 'unfinished'
  | 'visitFollowup'
  | 'weather';

export type MediEngagePrefs = {
  topics: Record<EngageTopic, boolean>;
  discreet: boolean;
  quietStart: string;
  quietEnd: string;
  frequency: EngageFrequency;
};

export const DEFAULT_ENGAGE_PREFS: MediEngagePrefs = {
  topics: {
    hydration: true,
    stepsSmart: true,
    weight: true,
    cycle: true,
    dailyLog: true,
    checkin: true,
    insight: true,
    weekly: true,
    achievement: true,
    chatFollowup: true,
    reengage: true,
    feature: false,
    question: true,
    birthday: true,
    sleep: true,
    morning: true,
    unfinished: true,
    visitFollowup: true,
    weather: true,
  },
  discreet: false,
  quietStart: '22:00',
  quietEnd: '08:00',
  frequency: 'balanced',
};

export function dailyEngageCap(frequency: EngageFrequency): number {
  if (frequency === 'rare') return 1;
  if (frequency === 'often') return 4;
  return 2;
}

export function parseHm(value: string): { hour: number; minute: number } {
  const [hour, minute] = String(value || '').split(':').map(Number);
  return {
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 0,
    minute: Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0,
  };
}

export function isQuietAt(date: Date, quietStart: string, quietEnd: string): boolean {
  const start = parseHm(quietStart);
  const end = parseHm(quietEnd);
  const mins = date.getHours() * 60 + date.getMinutes();
  const s = start.hour * 60 + start.minute;
  const e = end.hour * 60 + end.minute;
  if (s === e) return false;
  if (s < e) return mins >= s && mins < e;
  return mins >= s || mins < e;
}

export function bumpOutOfQuiet(date: Date, quietStart: string, quietEnd: string): Date {
  if (!isQuietAt(date, quietStart, quietEnd)) return date;
  const end = parseHm(quietEnd);
  const next = new Date(date);
  next.setHours(end.hour, end.minute, 0, 0);
  if (next.getTime() <= date.getTime()) next.setDate(next.getDate() + 1);
  next.setMinutes(next.getMinutes() + 15);
  return next;
}

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export type EngageFatigueLevel = 'low' | 'medium' | 'high';

export type EngageOutcome = {
  key: string;
  family: string;
  sentAt: number;
  openedAt?: number;
  action?: string;
};

/** Hours before the same companion family can fire again. */
export const FAMILY_COOLDOWN_HOURS: Record<string, number> = {
  checkin: 20,
  morning: 20,
  sleep: 20,
  streak: 24,
  hydration: 3.5,
  stepsQuiet: 15,
  insight: 48,
  weekly: 7 * 24,
  question: 5 * 24,
  chat: 24,
  feature: 14 * 24,
  birthday: 300 * 24,
  unfinished: 24,
  visitFollowup: 5 * 24,
  weatherWellness: 22,
  achievement: 0,
  reengage: 0,
};

export const PREFERRED_WINDOW_FAMILIES = new Set([
  'checkin',
  'morning',
  'question',
  'unfinished',
  'chat',
  'visitFollowup',
  'streak',
]);

export function cooldownMsForFamily(family: string): number {
  const hours = FAMILY_COOLDOWN_HOURS[family];
  return hours ? hours * HOUR_MS : 0;
}

export const FATIGUE_EWMA_ALPHA = 0.18;
export const FATIGUE_EWMA_START = 0.55;

export type EngageFatigue = {
  selectedFrequency: EngageFrequency;
  baseDailyCap: number;
  adaptiveDailyCap: number;
  ewma: number;
  level: EngageFatigueLevel;
  opened: number;
  ignored: number;
};

function foldFatigueEwma(ewma: number, opened: boolean): number {
  return FATIGUE_EWMA_ALPHA * (opened ? 1 : 0) + (1 - FATIGUE_EWMA_ALPHA) * ewma;
}

export function fatigueFromOutcomes(
  outcomes: EngageOutcome[],
  now = Date.now(),
): { level: EngageFatigueLevel; opened: number; ignored: number; ewma: number } {
  const ripe = outcomes
    .filter((row) => row.sentAt <= now - 2 * HOUR_MS || row.openedAt)
    .sort((a, b) => a.sentAt - b.sentAt)
    .slice(-20);
  const opened = ripe.filter((row) => row.openedAt).length;
  const ignored = ripe.length - opened;
  let ewma = FATIGUE_EWMA_START;
  for (const row of ripe) ewma = foldFatigueEwma(ewma, Boolean(row.openedAt));
  const level: EngageFatigueLevel = ewma >= 0.52 ? 'high' : ewma >= 0.38 ? 'medium' : 'low';
  return { level, opened, ignored, ewma };
}

/** Never writes back into selectedFrequency. Only the adaptive cap moves. */
export function computeEngageFatigue(frequency: EngageFrequency, outcomes: EngageOutcome[], now = Date.now()): EngageFatigue {
  const { level, opened, ignored, ewma } = fatigueFromOutcomes(outcomes, now);
  const baseDailyCap = dailyEngageCap(frequency);
  let adaptiveDailyCap = baseDailyCap;
  if (ewma < 0.38) adaptiveDailyCap = 1;
  else if (ewma < 0.52) adaptiveDailyCap = Math.max(1, baseDailyCap - 1);
  return {
    selectedFrequency: frequency,
    baseDailyCap,
    adaptiveDailyCap,
    ewma,
    level,
    opened,
    ignored,
  };
}

export function fatigueAdjustedCap(frequency: EngageFrequency, level: EngageFatigueLevel): number {
  const base = dailyEngageCap(frequency);
  if (level === 'low') return 1;
  if (level === 'medium') return Math.max(1, base - 1);
  return base;
}

export function preferredHourFromOpens(openAt: number[], now = Date.now()): number | null {
  const recent = openAt.filter((at) => at >= now - 30 * DAY_MS);
  if (recent.length < 8) return null;
  const hours = Array.from({ length: 24 }, () => 0);
  for (const at of recent) hours[new Date(at).getHours()] += 1;
  let windowStart = 0;
  let windowCount = -1;
  for (let hour = 0; hour < 24; hour += 1) {
    const count = hours[hour] + hours[(hour + 1) % 24];
    if (count > windowCount) {
      windowCount = count;
      windowStart = hour;
    }
  }
  if (windowCount <= 0) return null;
  const first = hours[windowStart];
  const second = hours[(windowStart + 1) % 24];
  return second > first ? (windowStart + 1) % 24 : windowStart;
}

export function shiftToPreferredHour(date: Date, preferredHour: number): Date {
  const next = new Date(date);
  next.setHours(preferredHour, 20, 0, 0);
  return next;
}
