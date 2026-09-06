import type { WeightGoal, WeightGoalProgress, WeightLog, WeightPace } from '@/types/weightGoal';

export const KG_TO_LB = 2.20462;
export const PACE_KG: Record<WeightPace, number> = { slow: 0.25, moderate: 0.5, fast: 0.75 };
export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export function ymd(d: Date): string {
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

export function kgToLb(kg: number): number {
  return Math.round(kg * KG_TO_LB * 10) / 10;
}

export function lbToKg(lb: number): number {
  return Math.round((lb / KG_TO_LB) * 10) / 10;
}

export function clampKg(value: number): number {
  return Math.min(250, Math.max(30, Math.round(value * 10) / 10));
}

/** One current kg for home, hub, and goal progress. Live metric/profile wins over a stale seed. */
export function resolveCurrentWeightKg(
  logs: Array<{ id: string; kg: number; date: string }>,
  metricKg?: number | null,
  profileKg?: number | null,
  day = todayYmd(),
): number | null {
  const live =
    profileKg != null && Number.isFinite(profileKg)
      ? clampKg(profileKg)
      : metricKg != null && Number.isFinite(metricKg)
        ? clampKg(metricKg)
        : null;
  const todayLogs = logs.filter((row) => row.date === day);
  const todayUser = todayLogs.find((row) => row.id.startsWith('wlog-'));
  const todaySeed = todayLogs.find((row) => row.id.startsWith('wseed-'));

  if (todayUser) {
    const metricLive = metricKg != null && Number.isFinite(metricKg) ? clampKg(metricKg) : null;
    const profileLive = profileKg != null && Number.isFinite(profileKg) ? clampKg(profileKg) : null;
    if (
      metricLive != null &&
      profileLive != null &&
      Math.abs(metricLive - profileLive) <= 0.15 &&
      Math.abs(todayUser.kg - profileLive) > 0.15
    ) {
      return profileLive;
    }
    return clampKg(todayUser.kg);
  }
  if (live != null) return live;
  if (todaySeed) return clampKg(todaySeed.kg);
  if (logs[0]) return clampKg(logs[0].kg);
  return null;
}

export function paceFromSlider(t: number): WeightPace {
  if (t < 1 / 3) return 'slow';
  if (t < 2 / 3) return 'moderate';
  return 'fast';
}

/** Fill ratio so the last stop paints the whole track. */
export function sliderFromPace(pace: WeightPace): number {
  if (pace === 'slow') return 1 / 3;
  if (pace === 'moderate') return 2 / 3;
  return 1;
}

export function weeksFromPace(startKg: number, targetKg: number, pace: WeightPace): number {
  const delta = Math.abs(startKg - targetKg);
  return Math.max(1, Math.ceil(delta / PACE_KG[pace]));
}

export function deadlineFromPace(startKg: number, targetKg: number, pace: WeightPace, fromYmd = todayYmd()): string {
  return addDaysYmd(fromYmd, weeksFromPace(startKg, targetKg, pace) * 7);
}

export type WeightPaceDirection = 'lose' | 'gain' | 'hold';

export type WeightPaceReason =
  | 'age'
  | 'underweight'
  | 'lowBmiLoss'
  | 'conditions'
  | 'sedentary'
  | 'active'
  | 'highBmi'
  | 'smallDelta'
  | 'largeDelta'
  | 'gain'
  | 'hold'
  | 'balanced'
  | 'smoking';

export type WeightPaceFacts = {
  startKg: number;
  targetKg: number;
  heightCm?: number | null;
  bmi?: number | null;
  age?: number | null;
  activityLevel?: string | null;
  fitnessLevel?: number | null;
  hasConditions?: boolean;
  smokingStatus?: string | null;
};

export type WeightPaceAdvice = {
  pace: WeightPace;
  paceKgPerWeek: number;
  deadlineYmd: string;
  weeks: number;
  direction: WeightPaceDirection;
  deltaKg: number;
  reasonKeys: WeightPaceReason[];
};

function bmiFromFacts(facts: WeightPaceFacts): number | null {
  if (facts.bmi != null && Number.isFinite(facts.bmi)) return facts.bmi;
  if (facts.heightCm && facts.startKg) {
    const m = facts.heightCm / 100;
    return Math.round((facts.startKg / (m * m)) * 10) / 10;
  }
  return null;
}

function directionOf(startKg: number, targetKg: number): WeightPaceDirection {
  if (targetKg < startKg - 0.15) return 'lose';
  if (targetKg > startKg + 0.15) return 'gain';
  return 'hold';
}

/**
 * Conservative pace for this person — WHO-style weekly rates, no diagnoses.
 * Safety beats speed: age, low BMI, conditions, and low activity lock slow.
 */
export function recommendWeightPace(facts: WeightPaceFacts, fromYmd = todayYmd()): WeightPaceAdvice {
  const deltaKg = Math.round(Math.abs(facts.startKg - facts.targetKg) * 10) / 10;
  const direction = directionOf(facts.startKg, facts.targetKg);
  const bmi = bmiFromFacts(facts);
  const age = facts.age != null && Number.isFinite(facts.age) ? facts.age : null;
  const sedentary =
    facts.activityLevel === 'SEDENTARY' ||
    facts.activityLevel === 'LIGHT' ||
    (facts.fitnessLevel != null && facts.fitnessLevel <= 2);
  const active =
    facts.activityLevel === 'ACTIVE' ||
    facts.activityLevel === 'VERY_ACTIVE' ||
    (facts.fitnessLevel != null && facts.fitnessLevel >= 4);
  const smokes = Boolean(facts.smokingStatus && facts.smokingStatus !== 'NEVER' && facts.smokingStatus !== 'NONE');

  const reasons: WeightPaceReason[] = [];
  let pace: WeightPace = 'moderate';

  if (direction === 'hold') {
    pace = 'slow';
    reasons.push('hold');
  } else if (direction === 'gain') {
    pace = 'slow';
    reasons.push('gain');
    if (age != null && age >= 55) reasons.push('age');
    if (facts.hasConditions) reasons.push('conditions');
  } else if (bmi != null && bmi < 18.5) {
    pace = 'slow';
    reasons.push('underweight');
  } else if (age != null && age >= 60) {
    pace = 'slow';
    reasons.push('age');
    if (facts.hasConditions) reasons.push('conditions');
  } else if (facts.hasConditions) {
    pace = 'slow';
    reasons.push('conditions');
  } else if (bmi != null && bmi < 20) {
    pace = 'slow';
    reasons.push('lowBmiLoss');
  } else if (deltaKg < 2.5) {
    pace = 'slow';
    reasons.push('smallDelta');
  } else if (sedentary) {
    pace = deltaKg >= 10 ? 'moderate' : 'slow';
    reasons.push('sedentary');
    if (pace === 'moderate') reasons.push('largeDelta');
  } else if (bmi != null && bmi >= 30 && (age == null || age < 45) && active && deltaKg >= 6 && deltaKg <= 20 && !smokes) {
    pace = 'fast';
    reasons.push('highBmi', 'active');
  } else if (deltaKg >= 15) {
    pace = 'moderate';
    reasons.push('largeDelta');
  } else {
    pace = 'moderate';
    reasons.push('balanced');
    if (active) reasons.push('active');
  }

  if (smokes && pace === 'fast') {
    pace = 'moderate';
    reasons.push('smoking');
  }
  if (age != null && age >= 50 && pace === 'fast') {
    pace = 'moderate';
    if (!reasons.includes('age')) reasons.push('age');
  }

  const weeks = weeksFromPace(facts.startKg, facts.targetKg, pace);
  return {
    pace,
    paceKgPerWeek: PACE_KG[pace],
    deadlineYmd: addDaysYmd(fromYmd, weeks * 7),
    weeks,
    direction,
    deltaKg,
    reasonKeys: reasons,
  };
}

export function buildWeightProgress(goal: WeightGoal, current: number, nowYmd = todayYmd()): WeightGoalProgress {
  const total = Math.abs(goal.startKg - goal.targetKg) || 0.1;
  const moved = Math.abs(goal.startKg - current);
  const toward =
    (goal.targetKg < goal.startKg && current <= goal.startKg) ||
    (goal.targetKg > goal.startKg && current >= goal.startKg);
  const percent = Math.round(Math.min(100, Math.max(0, (toward ? moved : 0) / total) * 100));
  const remaining = Math.round(Math.abs(current - goal.targetKg) * 10) / 10;
  const daysLeft = Math.max(0, daysBetween(nowYmd, goal.deadlineYmd));
  const expected = (daysBetween(goal.startedYmd, nowYmd) / 7) * goal.paceKgPerWeek;
  return {
    goal,
    current,
    remaining,
    percent,
    daysLeft,
    completed: remaining <= 0.15,
    onTrack: toward && moved + 0.2 >= expected,
  };
}

export function estimatedKcalFromPace(paceKgPerWeek: number): number {
  return Math.round((Math.abs(paceKgPerWeek) * 7700) / 7);
}

export function monthChangePct(logs: WeightLog[], current: number, nowYmd = todayYmd()): number | null {
  const cutoff = addDaysYmd(nowYmd, -30);
  const older = logs.find((row) => row.date <= cutoff);
  if (!older || !older.kg) return null;
  return Math.round(((current - older.kg) / older.kg) * 1000) / 10;
}

export function averageKg(logs: WeightLog[]): number | null {
  if (!logs.length) return null;
  const sum = logs.reduce((acc, row) => acc + row.kg, 0);
  return Math.round((sum / logs.length) * 10) / 10;
}
