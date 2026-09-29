/**
 * MEDI COACH — pure rules for trainers, consented client links, sessions, meal-plan adherence and
 * trainer alerts (2026-09-28). No database access here; see trainerStore.js. docs/TRAINER.md.
 */
import { z } from 'zod';
import { isEnglish } from './i18n.js';

export const CONSENT_VERSION = 'coach-2026-09-28b';

/** What a client can share. Sessions are the link itself and always visible to both sides. */
export const SCOPES = Object.freeze(['workouts', 'nutrition', 'weight', 'photos']);
// Nothing is shared until the person switches it on (App Review 5.1.1 / Law 3144: voluntary, specific).
export const DEFAULT_SCOPES = Object.freeze({ workouts: false, nutrition: false, weight: false, photos: false });

export const SPECIALTIES = Object.freeze({
  weight_loss: 'წონის კლება',
  muscle: 'კუნთის მატება',
  strength: 'ძალა',
  functional: 'ფუნქციური ვარჯიში',
  crossfit: 'კროსფიტი',
  cardio: 'კარდიო / გამძლეობა',
  mobility: 'მოქნილობა და მობილობა',
  rehab: 'რეაბილიტაცია და ტრავმის შემდეგ',
  boxing: 'ბოქსი / საბრძოლო',
  yoga: 'იოგა / პილატესი',
  women: 'ქალის ფიტნესი',
  seniors: 'ხანდაზმულები',
  nutrition: 'კვების დაგეგმვა',
  sport: 'სპორტული მომზადება',
});

export const SESSION_KINDS = Object.freeze({
  STRENGTH: 'ძალოვანი',
  CARDIO: 'კარდიო',
  HIIT: 'HIIT',
  FUNCTIONAL: 'ფუნქციური',
  MOBILITY: 'მობილობა',
  ASSESSMENT: 'შეფასება / გაზომვა',
  ONLINE: 'ონლაინ',
});

export const TRAINER_STATUS_KA = Object.freeze({
  PENDING: 'განიხილება',
  VERIFIED: 'დადასტურებული',
  REJECTED: 'უარყოფილი',
  SUSPENDED: 'შეჩერებული',
});

// English labels for English requests (X-Medicard-Lang: en). The Georgian maps above stay the default.
export const SPECIALTIES_EN = Object.freeze({
  weight_loss: 'Weight loss',
  muscle: 'Muscle gain',
  strength: 'Strength',
  functional: 'Functional training',
  crossfit: 'CrossFit',
  cardio: 'Cardio / endurance',
  mobility: 'Flexibility and mobility',
  rehab: 'Rehab and post-injury',
  boxing: 'Boxing / combat sports',
  yoga: 'Yoga / Pilates',
  women: "Women's fitness",
  seniors: 'Older adults',
  nutrition: 'Nutrition planning',
  sport: 'Sports preparation',
});

export const SESSION_KINDS_EN = Object.freeze({
  STRENGTH: 'Strength',
  CARDIO: 'Cardio',
  HIIT: 'HIIT',
  FUNCTIONAL: 'Functional',
  MOBILITY: 'Mobility',
  ASSESSMENT: 'Assessment / measurements',
  ONLINE: 'Online',
});

export const TRAINER_STATUS_EN = Object.freeze({
  PENDING: 'Under review',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
});

export const LATE_CANCEL_HOURS = 12;
export const MAX_REPEAT_WEEKS = 12;
export const TBILISI_OFFSET_MS = 4 * 3600000; // UTC+4, no DST
const DAY = 86400000;

/** `messageEn` is what English requests read (middleware/error.js); the Georgian message stays the default. */
export const coachError = (status, message, code, messageEn) =>
  Object.assign(new Error(message), { status, ...(code ? { code } : {}), ...(messageEn ? { messageEn } : {}) });

// ——— scopes ———

export function normalizeScopes(raw, fallback = DEFAULT_SCOPES) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return Object.fromEntries(SCOPES.map((k) => [k, typeof src[k] === 'boolean' ? src[k] : Boolean(fallback[k])]));
}

export function linkAllows(link, scope) {
  return Boolean(link && link.status === 'ACTIVE' && normalizeScopes(link.scopes, {})[scope]);
}

// ——— time (Tbilisi) ———

export function tbilisiYmd(date = new Date()) {
  return new Date(new Date(date).getTime() + TBILISI_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDaysYmd(ymd, days) {
  return new Date(Date.parse(`${ymd}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/** Start of a Tbilisi calendar day as a UTC Date. */
export function tbilisiDayStart(ymd) {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) - TBILISI_OFFSET_MS);
}

const WEEKDAYS = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "ხუთ, 2 ოქტ · 19:00" (English: "Thu, 2 Oct · 19:00") in Tbilisi time. */
export function formatSessionTime(date, lang = 'ka') {
  const t = new Date(new Date(date).getTime() + TBILISI_OFFSET_MS);
  const hh = String(t.getUTCHours()).padStart(2, '0');
  const mm = String(t.getUTCMinutes()).padStart(2, '0');
  const en = isEnglish(lang);
  return `${(en ? WEEKDAYS_EN : WEEKDAYS)[t.getUTCDay()]}, ${t.getUTCDate()} ${(en ? MONTHS_EN : MONTHS)[t.getUTCMonth()]} · ${hh}:${mm}`;
}

export function formatClock(date) {
  const t = new Date(new Date(date).getTime() + TBILISI_OFFSET_MS);
  return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
}

// ——— sessions ———

/** Weekly repeats of one session (the first included). */
export function expandSeries(startsAt, repeatWeeks = 1) {
  const n = Math.max(1, Math.min(MAX_REPEAT_WEEKS, Math.floor(Number(repeatWeeks) || 1)));
  const first = new Date(startsAt).getTime();
  return Array.from({ length: n }, (_, i) => new Date(first + i * 7 * DAY));
}

export function overlaps(aStart, aMin, bStart, bMin) {
  const a0 = new Date(aStart).getTime();
  const b0 = new Date(bStart).getTime();
  return a0 < b0 + bMin * 60000 && b0 < a0 + aMin * 60000;
}

/** First live session of the trainer that overlaps the proposed time, or null. */
export function findConflict(existing, startsAt, durationMin, ignoreId = null) {
  return existing.find((s) => s.id !== ignoreId && ['SCHEDULED', 'OPEN'].includes(s.status) && overlaps(s.startsAt, s.durationMin, startsAt, durationMin)) || null;
}

export function isLateCancel(startsAt, now = new Date()) {
  const diff = new Date(startsAt).getTime() - now.getTime();
  return diff < LATE_CANCEL_HOURS * 3600000;
}

/**
 * Which reminder is due now for a scheduled session: '24h' in the window (1h, 24h], '1h' in (0, 70min].
 * The job runs every few minutes, so windows are generous and flags prevent repeats.
 */
export function reminderDue(session, now = new Date()) {
  if (session.status !== 'SCHEDULED' || !session.clientId) return null;
  const left = new Date(session.startsAt).getTime() - now.getTime();
  if (left <= 0) return null;
  if (left <= 70 * 60000) return session.reminded1 ? null : '1h';
  if (left <= 24 * 3600000) return session.reminded24 ? null : '24h';
  return null;
}

// ——— nutrition adherence ———

const round = (n) => Math.round(Number(n) || 0);

/**
 * One day of the client's diary against the trainer's plan.
 * ON: kcal within ±10 % of the target (and protein ≥ 85 % when a protein target exists);
 * OVER: kcal above 110 %; UNDER: below 90 % (for a finished day only); PENDING: today, still below;
 * NONE: nothing logged.
 */
export function dayAdherence({ targets, eaten, meals = 0, isToday = false }) {
  const kcalTarget = Number(targets?.calories) || 0;
  const kcal = Number(eaten?.calories) || 0;
  if (!meals || kcal <= 0) return { status: isToday ? 'PENDING' : 'NONE', ratio: 0 };
  if (!kcalTarget) return { status: 'ON', ratio: null };
  const ratio = kcal / kcalTarget;
  if (ratio > 1.1) return { status: 'OVER', ratio: Math.round(ratio * 100) / 100 };
  if (ratio < 0.9) return { status: isToday ? 'PENDING' : 'UNDER', ratio: Math.round(ratio * 100) / 100 };
  const proteinTarget = Number(targets?.protein) || 0;
  if (!isToday && proteinTarget && (Number(eaten?.protein) || 0) < proteinTarget * 0.85) {
    return { status: 'LOW_PROTEIN', ratio: Math.round(ratio * 100) / 100 };
  }
  return { status: 'ON', ratio: Math.round(ratio * 100) / 100 };
}

/** Score over finished, logged days: share of days ON. */
export function adherenceScore(days) {
  const judged = days.filter((d) => !['PENDING', 'NONE'].includes(d.status));
  if (!judged.length) return null;
  return Math.round((judged.filter((d) => d.status === 'ON').length / judged.length) * 100);
}

/** Trailing run of days (newest first) that satisfy `pred`, skipping today when it is still PENDING. */
export function trailingRun(days, pred) {
  let n = 0;
  for (const d of [...days].sort((a, b) => b.date.localeCompare(a.date))) {
    if (d.status === 'PENDING') continue;
    if (!pred(d)) break;
    n += 1;
  }
  return n;
}

// ——— weight & goal ———

export function goalProgress(goal, currentKg) {
  if (!goal || !Number.isFinite(goal.startKg) || !Number.isFinite(goal.targetKg) || !Number.isFinite(currentKg)) return null;
  const total = goal.targetKg - goal.startKg;
  if (Math.abs(total) < 0.05) return { percent: 100, remainingKg: 0, direction: 'keep' };
  const done = currentKg - goal.startKg;
  const percent = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  return {
    percent,
    remainingKg: Math.round((goal.targetKg - currentKg) * 10) / 10,
    direction: total < 0 ? 'lose' : 'gain',
  };
}

/** Expected weight on `ymd` if the client moved linearly from start to target by the deadline. */
export function expectedWeight(goal, ymd) {
  if (!goal?.startedYmd || !goal?.deadlineYmd) return null;
  const span = Date.parse(goal.deadlineYmd) - Date.parse(goal.startedYmd);
  if (!(span > 0)) return null;
  const t = Math.max(0, Math.min(1, (Date.parse(ymd) - Date.parse(goal.startedYmd)) / span));
  return Math.round((goal.startKg + (goal.targetKg - goal.startKg) * t) * 10) / 10;
}

// ——— trainer alerts ———

/**
 * Short, actionable alerts for the trainer's "today" screen. Input is one client's already-scoped
 * summary; categories the client did not share are simply absent.
 */
export function clientAlerts({ name, nutritionDays, lastWeighYmd, lastMealYmd, lastSession, goal, currentKg, today, lang = 'ka' }) {
  const out = [];
  const en = isEnglish(lang);
  if (en && name === CLIENT_FALLBACK_KA) name = 'Client';
  const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;
  if (nutritionDays?.length) {
    const over = trailingRun(nutritionDays, (d) => d.status === 'OVER');
    if (over >= 2) out.push({ kind: 'OVER_STREAK', tone: 'warn', text: en ? `${name}: over the calorie target ${days(over)} in a row` : `${name}: ${over} დღე ზედიზედ გადააჭარბა კალორიებს` });
    const under = trailingRun(nutritionDays, (d) => d.status === 'UNDER');
    if (under >= 3) out.push({ kind: 'UNDER_STREAK', tone: 'warn', text: en ? `${name}: eating far too little for ${days(under)}` : `${name}: ${under} დღეა ძალიან ცოტას ჭამს` });
    const onRun = trailingRun(nutritionDays, (d) => d.status === 'ON');
    if (onRun >= 5) out.push({ kind: 'ON_STREAK', tone: 'good', text: en ? `${name}: on plan ${days(onRun)} in a row 🔥` : `${name}: ${onRun} დღე ზედიზედ გეგმაშია 🔥` });
  }
  if (lastMealYmd !== undefined) {
    const gap = lastMealYmd ? Math.round((Date.parse(today) - Date.parse(lastMealYmd)) / DAY) : null;
    if (gap == null || gap >= 3) {
      const text = en
        ? (gap == null ? `${name}: has not logged any food yet` : `${name}: no food logged for ${days(gap)}`)
        : (gap == null ? `${name}: კვებას ჯერ არ იწერს` : `${name}: ${gap} დღეა კვება არ ჩაუწერია`);
      out.push({ kind: 'NO_FOOD_LOG', tone: 'info', text });
    }
  }
  if (lastWeighYmd !== undefined) {
    const gap = lastWeighYmd ? Math.round((Date.parse(today) - Date.parse(lastWeighYmd)) / DAY) : null;
    if (gap == null || gap >= 7) {
      const text = en
        ? (gap == null ? `${name}: has not logged weight yet` : `${name}: no weigh-in for ${days(gap)}`)
        : (gap == null ? `${name}: წონა ჯერ არ ჩაუწერია` : `${name}: ${gap} დღეა არ აწონილა`);
      out.push({ kind: 'NO_WEIGH_IN', tone: 'info', text });
    }
  }
  if (lastSession?.status === 'NO_SHOW') out.push({ kind: 'NO_SHOW', tone: 'warn', text: en ? `${name}: missed the last session` : `${name}: ბოლო ვარჯიშზე არ მოვიდა` });
  if (goal && Number.isFinite(currentKg)) {
    const expected = expectedWeight(goal, today);
    if (expected != null) {
      const behind = goal.targetKg < goal.startKg ? currentKg - expected : expected - currentKg;
      if (behind >= 1.5) out.push({ kind: 'BEHIND_GOAL', tone: 'warn', text: en ? `${name}: ${Math.round(behind * 10) / 10} kg behind the goal` : `${name}: მიზანს ${Math.round(behind * 10) / 10} კგ-ით ჩამორჩება` });
      else if (behind <= -1) out.push({ kind: 'AHEAD_GOAL', tone: 'good', text: en ? `${name}: ahead of the goal` : `${name}: მიზანს უსწრებს` });
    }
  }
  return out;
}

// ——— validation ———

const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = (max) => z.string().trim().max(max);

export const applySchema = z.object({
  displayName: text(60).min(2),
  bio: text(800).optional().default(''),
  specialties: z.array(z.enum(Object.keys(SPECIALTIES))).max(6).default([]),
  experienceYears: z.coerce.number().int().min(0).max(60).optional().nullable(),
  instagram: text(60).regex(/^@?[A-Za-z0-9._]{0,30}$/, 'Instagram-ის სახელი არასწორია.').optional().default(''),
  gymIds: z.array(z.string().trim().min(1).max(80)).min(1, 'აირჩიე მინიმუმ ერთი დარბაზი.').max(5),
});

export const certificateMetaSchema = z.object({
  title: text(120).min(2),
  issuer: text(120).optional().default(''),
  year: z.coerce.number().int().min(1970).max(2100).optional().nullable(),
});

export const proposeGymSchema = z.object({
  brand: text(80).min(2),
  name: text(80).optional().default(''),
  city: text(40).min(2),
  address: text(160).optional().default(''),
});

export const linkSchema = z.object({
  code: text(20).optional(),
  trainerId: text(80).optional(),
  scopes: z.record(z.string(), z.boolean()).optional(),
  consentVersion: z.literal(CONSENT_VERSION),
  note: text(300).optional().default(''),
}).refine((v) => v.code || v.trainerId, { message: 'ტრენერი არ არის მითითებული.' });

export const scopesSchema = z.object({ scopes: z.record(z.string(), z.boolean()) });

export const sessionSchema = z.object({
  clientId: text(80).nullable().optional(),
  startsAt: z.coerce.date(),
  durationMin: z.coerce.number().int().min(15).max(240).default(60),
  gymId: text(80).nullable().optional(),
  kind: z.enum(Object.keys(SESSION_KINDS)).default('STRENGTH'),
  note: text(300).optional().default(''),
  repeatWeeks: z.coerce.number().int().min(1).max(MAX_REPEAT_WEEKS).default(1),
});

export const sessionPatchSchema = z.object({
  startsAt: z.coerce.date().optional(),
  durationMin: z.coerce.number().int().min(15).max(240).optional(),
  gymId: text(80).nullable().optional(),
  kind: z.enum(Object.keys(SESSION_KINDS)).optional(),
  note: text(300).optional(),
});

const exerciseSchema = z.object({
  name: text(80).min(1),
  sets: z.coerce.number().int().min(0).max(50).optional().nullable(),
  reps: z.coerce.number().int().min(0).max(500).optional().nullable(),
  kg: z.coerce.number().min(0).max(1000).optional().nullable(),
  minutes: z.coerce.number().min(0).max(600).optional().nullable(),
});

export const completeSchema = z.object({
  status: z.enum(['DONE', 'NO_SHOW']),
  exercises: z.array(exerciseSchema).max(40).default([]),
  trainerNote: text(1000).optional().default(''),
});

export const cancelSchema = z.object({ reason: text(300).optional().default('') });

const mealItemSchema = z.object({
  name: text(80).min(1),
  grams: z.coerce.number().min(0).max(3000).optional().nullable(),
  calories: z.coerce.number().min(0).max(5000).optional().nullable(),
  protein: z.coerce.number().min(0).max(500).optional().nullable(),
});

export const MEAL_SLOTS = Object.freeze({ breakfast: 'საუზმე', snack1: 'წახემსება', lunch: 'სადილი', snack2: 'მეორე წახემსება', dinner: 'ვახშამი', preworkout: 'ვარჯიშამდე', postworkout: 'ვარჯიშის შემდეგ' });
export const MEAL_SLOTS_EN = Object.freeze({ breakfast: 'Breakfast', snack1: 'Snack', lunch: 'Lunch', snack2: 'Second snack', dinner: 'Dinner', preworkout: 'Pre-workout', postworkout: 'Post-workout' });

export const mealPlanSchema = z.object({
  title: text(80).min(2),
  targets: z.object({
    calories: z.coerce.number().int().min(800).max(6000),
    protein: z.coerce.number().int().min(0).max(400).optional().nullable(),
    carbs: z.coerce.number().int().min(0).max(900).optional().nullable(),
    fat: z.coerce.number().int().min(0).max(400).optional().nullable(),
  }),
  meals: z.array(z.object({
    slot: z.enum(Object.keys(MEAL_SLOTS)),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    items: z.array(mealItemSchema).max(20).default([]),
  })).max(8).default([]),
  note: text(1000).optional().default(''),
});

export const goalProposalSchema = z.object({
  type: z.enum(['lose', 'gain', 'recomp', 'performance']),
  targetKg: z.coerce.number().min(30).max(300),
  deadlineYmd: ymdSchema,
  note: text(300).optional().default(''),
});

export const photoMetaSchema = z.object({
  pose: z.enum(['FRONT', 'SIDE', 'BACK', 'OTHER']).default('FRONT'),
  takenOn: ymdSchema.optional(),
  weightKg: z.coerce.number().min(20).max(300).optional().nullable(),
  note: text(200).optional().default(''),
});

const workoutSchema = z.object({
  externalId: text(120).min(1),
  source: z.enum(['apple_health', 'health_connect']),
  kind: text(60).min(1),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  kcal: z.coerce.number().min(0).max(10000).optional().nullable(),
  avgHeartRate: z.coerce.number().min(20).max(250).optional().nullable(),
  distanceKm: z.coerce.number().min(0).max(500).optional().nullable(),
});

export const workoutSyncSchema = z.object({ workouts: z.array(workoutSchema).max(200) });

/** Instagram handle without "@", or null. */
export function cleanInstagram(v) {
  const s = String(v ?? '').trim().replace(/^@/, '');
  return s ? s : null;
}

/** Age in full years (18+ is enforced at account creation). */
export function ageFrom(birthDate, now = new Date()) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age -= 1;
  return age >= 0 ? age : null;
}

export function sessionPublic(s, { gyms = new Map(), people = new Map(), lang = 'ka' } = {}) {
  const gym = s.gymId ? gyms.get(s.gymId) : null;
  const person = s.clientId ? people.get(s.clientId) : null;
  return {
    id: s.id,
    trainerId: s.trainerId,
    clientId: s.clientId ?? null,
    clientName: person?.name ?? null,
    clientAvatarId: person?.avatarId ?? null,
    clientAvatarUrl: person?.avatarUrl ?? null,
    startsAt: new Date(s.startsAt).toISOString(),
    durationMin: s.durationMin,
    kind: s.kind,
    kindLabel: (isEnglish(lang) ? SESSION_KINDS_EN : SESSION_KINDS)[s.kind] || s.kind,
    note: s.note || '',
    status: s.status,
    gym: gym ? { id: gym.id, brand: gym.brand, name: gym.name, city: gym.city } : null,
    seriesId: s.seriesId ?? null,
    clientConfirmedAt: s.clientConfirmedAt ? new Date(s.clientConfirmedAt).toISOString() : null,
    cancelledBy: s.cancelledBy ?? null,
    cancelReason: s.cancelReason ?? null,
    lateCancel: Boolean(s.lateCancel),
    exercises: Array.isArray(s.exercises) ? s.exercises : [],
    trainerNote: s.trainerNote || '',
    clientRating: s.clientRating ?? null,
    label: formatSessionTime(s.startsAt, lang),
  };
}

const CLIENT_FALLBACK_KA = 'კლიენტი';
const ENDED_REASON_KA = 'კავშირი დასრულდა'; // written by trainerStore.endLink
const LABEL_MAPS = [[SPECIALTIES, SPECIALTIES_EN], [SESSION_KINDS, SESSION_KINDS_EN], [MEAL_SLOTS, MEAL_SLOTS_EN]];

/**
 * English copy of a MEDI COACH response: session labels and kinds, `{ key, label }` catalogue entries
 * and the nameless-client fallback. Gym names and cities are data (the city filter matches them) and stay. Georgian requests get the value back unchanged; never mutates.
 */
export function localizeCoachPayload(value, lang = 'ka') {
  if (!isEnglish(lang)) return value;
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== 'object') return v;
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return v; // Date, Buffer, Decimal …: as is
    const out = {};
    for (const [k, inner] of Object.entries(v)) out[k] = walk(inner);
    if (typeof out.startsAt === 'string' && typeof out.label === 'string' && 'durationMin' in out && 'kind' in out) {
      out.label = formatSessionTime(out.startsAt, 'en');
      if (typeof out.kindLabel === 'string') out.kindLabel = SESSION_KINDS_EN[out.kind] || out.kindLabel;
    } else if (typeof out.key === 'string' && typeof out.label === 'string') {
      for (const [ka, en] of LABEL_MAPS) if (ka[out.key] === out.label && en[out.key]) out.label = en[out.key];
    }
    for (const field of ['name', 'clientName']) if (out[field] === CLIENT_FALLBACK_KA) out[field] = 'Client';
    if (out.cancelReason === ENDED_REASON_KA) out.cancelReason = 'The connection ended';
    return out;
  };
  return walk(value);
}
