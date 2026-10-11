// MEDISLEEP core (2026-10-12): inputs, the night merge rule, public shapes, the plan a person starts from.
// Pure functions only — storage lives in sleepStore.js, analytics in sleepInsights.js.
import { z } from 'zod';

export const SLEEP_CATEGORIES = ['rain', 'nature', 'noise', 'music'];
export const SLEEP_SOUND_STATUSES = ['LIVE', 'DRAFT', 'HIDDEN'];

/** Check-in factors („რამ იმოქმედა?“). Ids are stored; labels are for Medi and the admin page. */
export const SLEEP_FACTORS = {
  caffeine: ['ყავა ან ჩაი გვიან', 'Late coffee or tea'],
  alcohol: ['ალკოჰოლი', 'Alcohol'],
  late_meal: ['გვიანი ვახშამი', 'Late dinner'],
  screens: ['ეკრანი საწოლში', 'Screens in bed'],
  stress: ['სტრესი', 'Stress'],
  exercise: ['ვარჯიში', 'Exercise'],
  nap: ['დღის ძილი', 'Daytime nap'],
  noise: ['ხმაური', 'Noise'],
  pain: ['ტკივილი', 'Pain'],
  illness: ['ავად ვიყავი', 'Feeling ill'],
  period: ['მენსტრუაცია', 'Period'],
  kids: ['ბავშვმა გამაღვიძა', 'Woken by a child'],
  heat: ['სიცხე ოთახში', 'Warm room'],
  travel: ['მოგზაურობა', 'Travel'],
};
export const SLEEP_FACTOR_IDS = Object.keys(SLEEP_FACTORS);

/** 1…5 morning rating, the words the app shows. */
export const SLEEP_QUALITY_LABELS = {
  1: ['ძალიან ცუდად', 'Very badly'],
  2: ['ცუდად', 'Badly'],
  3: ['საშუალოდ', 'So-so'],
  4: ['კარგად', 'Well'],
  5: ['ძალიან კარგად', 'Very well'],
};

/** Times win in this order: what she typed > Apple Health / Health Connect > sleep mode taps. */
const TIMES_RANK = { mode: 1, health: 2, manual: 3 };
export const SLEEP_TIMES_SOURCES = Object.keys(TIMES_RANK);

const MAX_NIGHT_MINUTES = 16 * 60;
const MIN_NIGHT_MINUTES = 20;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

const iso = z.string().datetime({ offset: true });
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const minutes = z.number().int().min(0).max(MAX_NIGHT_MINUTES);

export const sleepPlanInput = z.object({
  goalMinutes: z.number().int().min(300).max(660),
  wakeTime: z.string().regex(HHMM),
  weekendWakeTime: z.string().regex(HHMM).nullable().optional(),
  windDownMinutes: z.number().int().min(0).max(120).optional(),
  bedtimeReminder: z.boolean().optional(),
  checkinReminder: z.boolean().optional(),
  alarm: z.boolean().optional(),
  hideScore: z.boolean().optional(),
}).strict();

/** One night as the app sends it. `kind` says which part is being written (see mergeNight). */
export const sleepNightInput = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(['mode', 'manual', 'health', 'checkin']),
  bedAt: iso.nullable().optional(),
  wakeAt: iso.nullable().optional(),
  asleepMinutes: minutes.nullable().optional(),
  awakeMinutes: minutes.nullable().optional(),
  deepMinutes: minutes.nullable().optional(),
  remMinutes: minutes.nullable().optional(),
  coreMinutes: minutes.nullable().optional(),
  latencyMinutes: z.number().int().min(0).max(240).nullable().optional(),
  wakeups: z.number().int().min(0).max(10).nullable().optional(),
  quality: z.number().int().min(1).max(5).nullable().optional(),
  factors: z.array(z.enum(SLEEP_FACTOR_IDS)).max(SLEEP_FACTOR_IDS.length).optional(),
  sounds: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(6).optional(),
}).strict();

export const sleepImportInput = z.object({
  nights: z.array(sleepNightInput.extend({ night: ymd, kind: z.literal('health') })).max(120),
}).strict();

export const sleepPlaysInput = z.object({
  plays: z.array(z.object({
    id: z.string().uuid(),
    soundIds: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).min(1).max(6),
    startedAt: iso,
    minutes: z.number().int().min(0).max(720),
    timerMinutes: z.number().int().min(0).max(720).nullable().optional(),
    sleepMode: z.boolean().optional(),
  }).strict()).max(50),
}).strict();

export function sleepError(status, message, code, messageEn) {
  return Object.assign(new Error(message), { status, code, messageEn });
}

export function isNightDate(value) {
  return typeof value === 'string' && ymd.safeParse(value).success && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function toDate(value) {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Calendar parts of an instant in a time zone. */
export function localParts(instant, timeZone) {
  const d = toDate(instant);
  if (!d) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(d);
  const pick = (type) => parts.find((p) => p.type === type)?.value;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(pick('weekday'));
  return {
    date: `${pick('year')}-${pick('month')}-${pick('day')}`,
    minutes: Number(pick('hour')) * 60 + Number(pick('minute')),
    weekday,
  };
}

/**
 * The night a wake-up belongs to: days run 18:00 → 18:00 local, so a sleep that ends at 07:00 on the 12th and a
 * nap that ends at 16:00 on the 12th are both the 12th, and anything ending after 18:00 counts for the next day.
 * Same rule as mobile/src/lib/sleepNights.ts.
 */
export function nightOf(wakeAt, timeZone) {
  const d = toDate(wakeAt);
  if (!d) return null;
  return localParts(new Date(d.getTime() + 6 * 3600_000), timeZone)?.date ?? null;
}

function minutesBetween(a, b) {
  const start = toDate(a);
  const end = toDate(b);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

/** Problems with the times of a night, or null. Messages are [ka, en]. */
export function nightTimesProblem(bedAt, wakeAt, { now = new Date() } = {}) {
  if (!bedAt && !wakeAt) return null;
  if (!bedAt || !wakeAt) return ['დაწოლისა და გაღვიძების დრო ორივე საჭიროა.', 'Both the bedtime and the wake-up time are needed.'];
  const span = minutesBetween(bedAt, wakeAt);
  if (span == null) return ['დრო ვერ წავიკითხეთ.', 'We could not read the time.'];
  if (span < MIN_NIGHT_MINUTES) return ['გაღვიძება დაწოლიდან მინიმუმ 20 წუთის შემდეგ უნდა იყოს.', 'The wake-up must be at least 20 minutes after bedtime.'];
  if (span > MAX_NIGHT_MINUTES) return ['ერთი ღამე 16 საათზე მეტი ვერ იქნება.', 'One night cannot be longer than 16 hours.'];
  if (toDate(wakeAt).getTime() > now.getTime() + 5 * 60_000) return ['გაღვიძების დრო ჯერ არ დამდგარა.', 'That wake-up time has not come yet.'];
  return null;
}

/** Minutes she actually slept: Health's asleep time, otherwise time in bed minus how long it took to fall asleep and time awake. */
export function sleptMinutes(night) {
  if (!night) return null;
  if (Number.isFinite(night.asleepMinutes) && night.asleepMinutes > 0) return night.asleepMinutes;
  if (!Number.isFinite(night.inBedMinutes) || night.inBedMinutes <= 0) return null;
  const latency = Number.isFinite(night.latencyMinutes) ? night.latencyMinutes : 0;
  return Math.max(0, night.inBedMinutes - latency);
}

const TIME_FIELDS = ['bedAt', 'wakeAt', 'inBedMinutes', 'asleepMinutes', 'awakeMinutes', 'deepMinutes', 'remMinutes', 'coreMinutes'];
const CHECKIN_FIELDS = ['quality', 'wakeups', 'latencyMinutes'];

/**
 * Applies one write to a stored night (or to nothing). Rules:
 * - Times (bed, wake, durations, stages) are replaced only by a source at least as trusted as the one that set
 *   them: manual > health > mode. A hand edit clears Health's stage minutes (they described other times).
 * - A check-in (quality, wake-ups, latency, factors) is hers whatever the kind; Health never touches it.
 * - Sounds collect (sleep mode adds the ones that played).
 */
export function mergeNight(existing, input, { now = new Date() } = {}) {
  const base = existing ? { ...existing } : {
    bedAt: null, wakeAt: null, inBedMinutes: null, asleepMinutes: null, awakeMinutes: null, deepMinutes: null,
    remMinutes: null, coreMinutes: null, latencyMinutes: null, wakeups: null, quality: null, factors: [], sounds: [],
    timesSource: input.kind === 'checkin' ? 'manual' : input.kind, checkedInAt: null,
  };
  const out = { ...base, factors: [...(base.factors || [])], sounds: [...(base.sounds || [])] };
  const kind = input.kind;
  const carriesTimes = kind !== 'checkin' && (input.bedAt !== undefined || input.wakeAt !== undefined || input.asleepMinutes !== undefined);
  if (carriesTimes) {
    const current = existing && (existing.bedAt || existing.asleepMinutes) ? TIMES_RANK[existing.timesSource] || 0 : 0;
    if (TIMES_RANK[kind] >= current) {
      const bedAt = input.bedAt !== undefined ? toDate(input.bedAt) : toDate(out.bedAt);
      const wakeAt = input.wakeAt !== undefined ? toDate(input.wakeAt) : toDate(out.wakeAt);
      out.bedAt = bedAt;
      out.wakeAt = wakeAt;
      out.inBedMinutes = bedAt && wakeAt ? minutesBetween(bedAt, wakeAt) : null;
      if (kind === 'health') {
        for (const field of ['asleepMinutes', 'awakeMinutes', 'deepMinutes', 'remMinutes', 'coreMinutes']) {
          if (input[field] !== undefined) out[field] = input[field];
        }
      } else if (kind === 'manual') {
        out.asleepMinutes = input.asleepMinutes ?? null;
        out.awakeMinutes = null;
        out.deepMinutes = null;
        out.remMinutes = null;
        out.coreMinutes = null;
      }
      out.timesSource = kind;
    }
  }
  if (kind !== 'health') {
    for (const field of CHECKIN_FIELDS) {
      if (input[field] !== undefined) out[field] = input[field];
    }
    if (input.factors !== undefined) out.factors = [...new Set(input.factors)];
    if (CHECKIN_FIELDS.some((f) => input[f] !== undefined) || input.factors !== undefined) {
      out.checkedInAt = now;
    }
  }
  if (input.sounds?.length) out.sounds = [...new Set([...out.sounds, ...input.sounds])].slice(0, 12);
  return out;
}

/** Whether a merge changed anything a person would see (skip the write otherwise). */
export function nightChanged(before, after) {
  if (!before) return true;
  const same = (a, b) => {
    if (a instanceof Date || b instanceof Date) return toDate(a)?.getTime() === toDate(b)?.getTime();
    if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a || []) === JSON.stringify(b || []);
    return (a ?? null) === (b ?? null);
  };
  return [...TIME_FIELDS, ...CHECKIN_FIELDS, 'factors', 'sounds', 'timesSource', 'checkedInAt'].some((f) => !same(before[f], after[f]));
}

const isoOrNull = (value) => (toDate(value) ? toDate(value).toISOString() : null);
const dateKey = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10));

export function publicNight(row) {
  const stages = [row.deepMinutes, row.remMinutes, row.coreMinutes].some((v) => Number.isFinite(v) && v > 0)
    ? { deep: row.deepMinutes ?? 0, rem: row.remMinutes ?? 0, core: row.coreMinutes ?? 0, awake: row.awakeMinutes ?? 0 }
    : null;
  return {
    id: row.id,
    night: dateKey(row.night),
    bedAt: isoOrNull(row.bedAt),
    wakeAt: isoOrNull(row.wakeAt),
    inBedMinutes: row.inBedMinutes ?? null,
    asleepMinutes: row.asleepMinutes ?? null,
    sleptMinutes: sleptMinutes(row),
    stages,
    latencyMinutes: row.latencyMinutes ?? null,
    wakeups: row.wakeups ?? null,
    quality: row.quality ?? null,
    factors: row.factors || [],
    sounds: row.sounds || [],
    timesSource: row.timesSource,
    checkedIn: !!row.checkedInAt,
  };
}

export function publicPlan(row) {
  if (!row) return null;
  return {
    goalMinutes: row.goalMinutes,
    wakeTime: row.wakeTime,
    weekendWakeTime: row.weekendWakeTime ?? null,
    windDownMinutes: row.windDownMinutes,
    bedtimeReminder: row.bedtimeReminder,
    checkinReminder: row.checkinReminder,
    alarm: row.alarm,
    hideScore: row.hideScore,
  };
}

function ageOn(birthDate, now) {
  const b = toDate(birthDate);
  if (!b) return null;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

/**
 * The plan offered on first open, from what she told us at registration („საშუალოდ რამდენ საათს გძინავს?“ +
 * „როგორ გძინავს ჩვეულებრივ?“, extraAnswers.sleepBand / sleepFeel) and her age (NSF: 7–9 h at 18–64, 7–8 h at 65+).
 */
export function suggestedPlan({ birthDate, extraAnswers, sleepHours } = {}, { now = new Date() } = {}) {
  const age = ageOn(birthDate, now);
  const goalMinutes = age != null && age >= 65 ? 450 : 480;
  const band = typeof extraAnswers?.sleepBand === 'string' ? extraAnswers.sleepBand : null;
  const usualHours = band ? Number(band) : Number.isFinite(sleepHours) ? sleepHours : null;
  const feel = typeof extraAnswers?.sleepFeel === 'string' ? extraAnswers.sleepFeel : null;
  return {
    plan: {
      goalMinutes, wakeTime: '07:00', weekendWakeTime: null, windDownMinutes: 30,
      bedtimeReminder: true, checkinReminder: true, alarm: false, hideScore: false,
    },
    basis: {
      age,
      usualHours: Number.isFinite(usualHours) ? usualHours : null,
      usualBand: band,
      feel,
      rangeMinutes: age != null && age >= 65 ? [420, 480] : [420, 540],
    },
  };
}

/** HH:MM → minutes after midnight. */
export function clockMinutes(hhmm) {
  const m = HHMM.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Planned bedtime for a wake-up time: goal sleep plus ~15 minutes to fall asleep (minutes after midnight). */
export function plannedBedtime(plan, { weekend = false } = {}) {
  if (!plan) return null;
  const wake = clockMinutes(weekend && plan.weekendWakeTime ? plan.weekendWakeTime : plan.wakeTime);
  if (wake == null) return null;
  return (((wake - plan.goalMinutes - 15) % 1440) + 1440) % 1440;
}
