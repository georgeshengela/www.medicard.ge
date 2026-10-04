// Health domain for the web-QA mock: steps, hydration, medications, account app-state, visits,
// records list, email preferences and the dose-event write the medications flow makes.
//
// Shapes copied from:
//   server/src/routes/health-metrics.routes.js   (GET /, /daily, /steps, POST /sync, hydration goal, step capability)
//   server/src/lib/hydrationSync.js               (event sum is authoritative per date, snapshot = max)
//   server/src/routes/medications.routes.js       (list + buildDailySchedule, CRUD)
//   server/src/routes/account.routes.js + lib/appState.js (GET/PUT /api/account/app-state, mergeAppState)
//   server/src/lib/email/preferences.js           (GET/PATCH /api/account/email-preferences)
//   server/src/routes/visits.routes.js, records.routes.js
// Client types: mobile/src/lib/api.ts (Medication, ScheduledDose, DoctorVisit, AccountAppState, EmailPreferences),
//   mobile/src/lib/healthMetricsStorage.ts (StoredHealthDaily, StoredStepLog), mobile/src/types/*.ts,
//   mobile/src/lib/run/history.ts (RunSummary).
//
// Web code path (no HealthKit / Health Connect on react-native-web):
//   useStepsMetrics → fetchStepsMetrics → pullStoredHealth → GET /api/health-metrics?from=&to= (90 days).
//   That response is also saved as the device health cache that useHomeStepsWeek (active Home week bars)
//   and useHydration (serverByDate) read. Dose logs / run history / goals live in localStorage and arrive
//   from GET /api/account/app-state ~1.2 s after sign-in (runPostLoginSideEffects → pullAccountState).
//   GET /__health/local-seed?userId= returns the localStorage keys to pre-seed so the first Home frame
//   already has them (see `localSeed`).
import { randomUUID } from 'node:crypto';
import { addDays, isoAt, mondayOf, seeded, tbilisiToday, clone } from '../lib.mjs';

// ---------------------------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------------------------
const TODAY_STEPS = 6400;
/** Quest weekly steps (Mon..today) — this week's stored rows are scaled to land on it. */
const WEEK_STEPS = 32205;
/** Today's daily row lags the step logs by one small interval so the steps page keeps its 2-hour bars. */
const TODAY_ROW_LAG = 12;
const HYDRATION_GOAL_ML = 2500;
const DROP_ML = 250;
const HISTORY_DAYS = 35;
const HYDRATION_ML_CAP = 20_000;

const MED_D3 = '3f6c2a1e-8b4d-4c7a-9e21-5d0b7a9c4e11';
const MED_MG = '8a2d4e6f-1c3b-4f5a-b7d9-2e4c6a8b0d22';
const VISIT_ID = 'c1e2d3f4-5a6b-4c7d-8e9f-0a1b2c3d4e33';

const DOCTOR_TYPES = ['GP', 'DENTIST', 'CARDIO', 'GYN', 'NEURO', 'ORTHO', 'THERAPIST', 'OPHTHALMO', 'DERM', 'PED', 'OTHER'];
const RECORD_TYPES = ['LAB', 'XRAY', 'CT_MRI', 'SKIN', 'SKINCARE', 'PRESCRIPTION', 'SYMPTOM'];
const STEP_CAPABILITY_STATUSES = ['AVAILABLE', 'UNAVAILABLE', 'PERMISSION_DENIED', 'NOT_CONFIGURED', 'UNKNOWN'];
const STEP_CAPABILITY_SOURCES = ['APPLE_HEALTH', 'HEALTH_CONNECT', 'OTHER', 'UNKNOWN'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------
const t = (rq, ka, en) => (rq.lang === 'en' ? en : ka);
const round1 = (n) => Math.round(n * 10) / 10;

/** Never a timestamp in the future: a fixture run at 08:00 must not claim a 09:06 dose. */
function pastIso(ymd, hhmm, minAgoFloor = 1) {
  const at = Date.parse(isoAt(ymd, hhmm));
  return new Date(Math.min(at, Date.now() - minAgoFloor * 60_000)).toISOString();
}

/** Deterministic UUID v4-shaped id from a seed. */
function uuidFrom(seed) {
  let hex = '';
  for (let i = 0; hex.length < 32; i += 1) {
    let h = 2166136261;
    for (const ch of `${seed}:${i}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    hex += (h >>> 0).toString(16).padStart(8, '0');
  }
  const v = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${v}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Tbilisi minutes since midnight right now. */
function tbilisiNowMinutes() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`;
const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/** Today's preferred clock times, squeezed before "now" when the fixture runs early in the day. */
function todayTimes(today, preferred) {
  const nowMin = today === tbilisiToday() ? tbilisiNowMinutes() : 24 * 60 - 1;
  const want = preferred.map(toMin);
  if (want.every((m) => m <= nowMin - 5)) return preferred;
  const end = Math.max(10, nowMin - 5);
  const start = Math.min(7 * 60, end / 3);
  return want.map((_, i) => hhmm(start + ((i + 1) * (end - start)) / (want.length + 1)));
}

function healthOf(state) {
  if (!state.health) init(state, { persona: state.persona || 'women', today: tbilisiToday() });
  return state.health;
}
function userIdOf(state) {
  return state.user?.id || 'mock-user';
}

// ---------------------------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------------------------
function seedSteps(today) {
  const days = {};
  for (let i = HISTORY_DAYS - 1; i >= 1; i -= 1) {
    const date = addDays(today, -i);
    days[date] = 3000 + Math.round(seeded(`steps:${date}`) * 8000);
  }
  // This week (Mon..yesterday) lands on the quest's weekly figure together with today's count.
  const monday = mondayOf(today);
  const weekPast = Object.keys(days).filter((d) => d >= monday);
  // Only once three or more days have passed (Thursday on): fewer cannot carry ~26 000 steps believably.
  if (weekPast.length >= 2 && (WEEK_STEPS - TODAY_STEPS) / weekPast.length <= 11000) {
    const target = WEEK_STEPS - TODAY_STEPS;
    const raw = weekPast.map((d) => days[d]);
    const sum = raw.reduce((a, b) => a + b, 0);
    let left = target;
    weekPast.forEach((d, idx) => {
      const v = idx === weekPast.length - 1 ? left : Math.max(3000, Math.min(11000, Math.round((days[d] / sum) * target)));
      days[d] = v;
      left -= v;
    });
    // Rounding / clamping drift goes back onto the largest day so the sum stays exact.
    const drift = target - weekPast.reduce((a, d) => a + days[d], 0);
    if (drift) {
      const big = weekPast.reduce((a, d) => (days[d] > days[a] ? d : a), weekPast[0]);
      days[big] += drift;
    }
  }
  return days;
}

function seedTodayStepLogs(today) {
  const nowMin = today === tbilisiToday() ? tbilisiNowMinutes() : 21 * 60;
  const end = Math.max(30, nowMin - 10);
  const start = end > 9 * 60 ? 7 * 60 + 20 : Math.round(end * 0.25);
  const n = Math.max(4, Math.min(14, Math.floor((end - start) / 55)));
  const weights = Array.from({ length: n }, (_, i) => 0.4 + seeded(`steplog:${today}:${i}`));
  const total = weights.reduce((a, b) => a + b, 0);
  let left = TODAY_STEPS;
  const logs = [];
  for (let i = 0; i < n; i += 1) {
    const count = i === n - 1 ? left : Math.round((weights[i] / total) * TODAY_STEPS);
    left -= count;
    const minute = start + Math.round((i * (end - start)) / Math.max(1, n - 1));
    const at = isoAt(today, hhmm(Math.min(minute, 23 * 60 + 59)));
    logs.push({ id: uuidFrom(`steplog:${today}:${i}`), at, count, source: 'device' });
  }
  return logs;
}

function seedFallbackWeights(today) {
  // 96.0 kg six weeks ago → 92.4 kg weighed this morning, a weigh-in every 3–4 days.
  const offsets = [42, 38, 35, 31, 28, 24, 21, 17, 14, 10, 7, 3, 0];
  return offsets.map((ago) => {
    const date = addDays(today, -ago);
    const base = 96.0 - (3.6 * (42 - ago)) / 42;
    const noise = ago === 0 || ago === 42 ? 0 : (seeded(`kg:${date}`) - 0.5) * 0.4;
    const at = ago === 0 ? pastIso(date, '08:05') : isoAt(date, '08:05');
    return { id: `w-${date}`, kg: round1(base + noise), at, date };
  });
}

function seedDaily(today, stepsByDate, hydrationToday) {
  const daily = {};
  for (let i = HISTORY_DAYS - 1; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    const isToday = i === 0;
    const hydrationMl = isToday
      ? hydrationToday
      : i <= 13
        ? 1500 + Math.round((seeded(`water:${date}`) * 1200) / 50) * 50
        : null;
    daily[date] = {
      date,
      steps: isToday ? TODAY_STEPS - TODAY_ROW_LAG : stepsByDate[date],
      weightKg: null, // derived at read time from state.weight (nutrition fixture) or the fallback trend
      bloodPressureSystolic: null,
      bloodPressureDiastolic: null,
      heartRate: round1(66 + seeded(`hr:${date}`) * 10),
      sleepHours: round1(6.2 + seeded(`sleep:${date}`) * 1.9),
      nutritionKcal: null,
      hydrationMl,
      activeMinutes: null,
      distanceKm: null,
      source: 'merged',
      syncedAt: isToday ? pastIso(date, '23:59', 12) : isoAt(date, '23:10'),
    };
  }
  return daily;
}

function seedHydrationEvents(today) {
  const times = todayTimes(today, ['08:10', '10:05', '12:30', '14:15', '16:40']);
  return times.map((time, i) => {
    const at = isoAt(today, time);
    const suffix = Math.floor(seeded(`drop:${today}:${i}`) * 36 ** 6).toString(36).padStart(6, '0').slice(0, 6);
    return { clientEventId: `${Date.parse(at)}-${suffix}`, date: today, deltaMl: DROP_ML, at };
  });
}

function seedMedications(today, uid) {
  const createdAt = isoAt(addDays(today, -30), '10:00');
  const common = {
    form: 'pills',
    amount: 1,
    timesPerDay: 1,
    frequencyKind: 'daily',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    refillReminder: true,
    refillThreshold: 12,
    startDate: addDays(today, -30),
    endDate: addDays(today, 335),
  };
  return [
    {
      id: MED_D3,
      userId: uid,
      medName: 'ვიტამინი D3',
      dosage: '1 ტაბლეტი',
      frequency: '09:00',
      notes: null,
      active: true,
      config: { ...common, genericName: 'Cholecalciferol', strength: '2000 IU', pillColor: '#F97316', pillShape: 'circle', mealTiming: 'with', remainingCount: 24 },
      createdAt,
    },
    {
      id: MED_MG,
      userId: uid,
      medName: 'მაგნიუმი B6',
      dosage: '1 ტაბლეტი',
      frequency: '21:00',
      notes: null,
      active: true,
      config: { ...common, genericName: 'Magnesium lactate + Pyridoxine', strength: '470 mg + 5 mg', pillColor: '#E5E7EB', pillShape: 'long', mealTiming: 'after', remainingCount: 41 },
      createdAt: isoAt(addDays(today, -30), '10:05'),
    },
  ];
}

const MED_EN = {
  [MED_D3]: { medName: 'Vitamin D3', dosage: '1 Tablet', ka: 'ვიტამინი D3' },
  [MED_MG]: { medName: 'Magnesium B6', dosage: '1 Tablet', ka: 'მაგნიუმი B6' },
};

function seedDoseLogs(today) {
  const logs = [];
  for (let i = 6; i >= 1; i -= 1) {
    const date = addDays(today, -i);
    logs.push({ medicationId: MED_D3, date, time: '09:00', status: 'taken', updatedAt: isoAt(date, `09:${String(3 + Math.floor(seeded(`d3:${date}`) * 20)).padStart(2, '0')}`) });
    logs.push({
      medicationId: MED_MG,
      date,
      time: '21:00',
      status: i === 3 ? 'skipped' : 'taken',
      updatedAt: isoAt(date, `21:${String(4 + Math.floor(seeded(`mg:${date}`) * 25)).padStart(2, '0')}`),
    });
  }
  // Today: D3 (09:00) taken, Magnesium (21:00) still due → computeTodayDoses = { total 2, taken 1, pending [21:00] }.
  logs.push({ medicationId: MED_D3, date: today, time: '09:00', status: 'taken', updatedAt: pastIso(today, '09:06') });
  return logs.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}

/** A closed walking loop of `meters` around a park centre, down-sampled like `downsamplePath`. */
function loopPath(center, meters, points = 40, phase = 0) {
  const r = meters / (2 * Math.PI);
  const dLat = r / 111_320;
  const dLng = r / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  const out = [];
  for (let i = 0; i <= points; i += 1) {
    const a = phase + (2 * Math.PI * i) / points;
    const wobble = 1 + 0.08 * Math.sin(3 * a);
    out.push({ lat: Number((center.lat + dLat * Math.sin(a) * wobble).toFixed(6)), lng: Number((center.lng + dLng * Math.cos(a) * wobble * 1.25).toFixed(6)) });
  }
  return out;
}

function seedRuns(today) {
  const walks = [
    { ago: 1, start: '18:40', meters: 4120, targetKm: 4, pace: 690, center: { lat: 41.7116, lng: 44.7537 } }, // Vake park
    { ago: 3, start: '07:15', meters: 3240, targetKm: 3, pace: 705, center: { lat: 41.7438, lng: 44.7322 } }, // Lisi lake
    { ago: 5, start: '19:05', meters: 5050, targetKm: 5, pace: 672, center: { lat: 41.6924, lng: 44.8115 } }, // Rike park
  ];
  return walks.map((w) => {
    const date = addDays(today, -w.ago);
    const startedAt = isoAt(date, w.start);
    const km = w.meters / 1000;
    const movingMs = Math.round(km * w.pace * 1000);
    const elapsedMs = movingMs + 180_000 + Math.round(seeded(`pause:${date}`) * 120_000);
    const path = loopPath(w.center, w.meters, 40, seeded(`phase:${date}`) * Math.PI);
    const splits = Array.from({ length: Math.floor(km) }, (_, k) => Math.round((k + 1) * w.pace * 1000 + (seeded(`split:${date}:${k}`) - 0.5) * 20_000));
    return {
      id: String(Date.parse(startedAt)),
      startedAt,
      endedAt: new Date(Date.parse(startedAt) + elapsedMs).toISOString(),
      target: { kind: 'km', value: w.targetKm },
      targetMeters: w.targetKm * 1000,
      distanceM: w.meters,
      movingMs,
      elapsedMs,
      calories: Math.round(km * 52),
      steps: Math.round(w.meters / 0.74),
      paceSecPerKm: w.pace,
      reachedPin: false,
      completedTarget: w.meters >= w.targetKm * 1000,
      pin: null,
      origin: path[0],
      path,
      segments: [path],
      splits,
    };
  }).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function seedVisit(today, persona, uid) {
  const women = persona !== 'man';
  const createdAt = isoAt(addDays(today, -3), '20:14');
  return {
    id: VISIT_ID,
    userId: uid,
    doctorType: women ? 'GYN' : 'CARDIO',
    doctorFirstName: women ? 'ეკა' : 'დავით',
    doctorLastName: women ? 'ლომიძე' : 'კაპანაძე',
    visitDate: addDays(today, 5),
    visitTime: '11:30',
    address: 'ვაჟა-ფშაველას გამზ. 16, თბილისი',
    addressLabel: 'ვაჟა-ფშაველას გამზირი 16, ვაკე-საბურთალო, თბილისი',
    lat: 41.7259,
    lng: 44.7406,
    notes: null,
    reminderConfig: { enabled: true, offsetsMinutes: [1440, 60], repeatCount: 1 },
    active: true,
    createdAt,
    updatedAt: createdAt,
  };
}

export function init(state, ctx) {
  const today = ctx.today;
  const uid = userIdOf(state);
  const stepsByDate = seedSteps(today);
  const hydrationEvents = seedHydrationEvents(today);
  const hydrationToday = hydrationEvents.reduce((a, e) => a + e.deltaMl, 0);
  state.health = {
    seededFor: today,
    daily: seedDaily(today, stepsByDate, hydrationToday),
    stepLogs: seedTodayStepLogs(today),
    hydrationEvents,
    hydrationGoal: { goalMl: HYDRATION_GOAL_ML, updatedAt: isoAt(addDays(today, -20), '09:12') },
    stepCapability: { status: 'AVAILABLE', source: 'APPLE_HEALTH', updatedAt: isoAt(addDays(today, -60), '10:40') },
    fallbackWeights: seedFallbackWeights(today),
    syncHits: [],
    pushDoseEvents: [],
  };
  state.meds = { medications: seedMedications(today, uid) };
  state.appState = {
    labPanels: [],
    stepsGoal: {
      id: `goal-${Date.parse(isoAt(addDays(today, -6), '10:02'))}`,
      targetSteps: 8000,
      deadlineYmd: addDays(today, 15),
      startedYmd: addDays(today, -6),
      reminderEnabled: true,
      reminderDays: [1, 3, 5],
      reminderHour: 10,
      reminderMinute: 0,
    },
    stepsGoalHistory: [
      {
        id: `goal-${Date.parse(isoAt(addDays(today, -35), '09:40'))}`,
        targetSteps: 6000,
        startedYmd: addDays(today, -35),
        deadlineYmd: addDays(today, -14),
        completedYmd: addDays(today, -16),
        currentSteps: 6240,
      },
    ],
    runHistory: seedRuns(today),
    doseLogs: seedDoseLogs(today),
    symptomHistory: [],
    updatedAt: isoAt(addDays(today, -1), '21:12'),
  };
  state.visits = [seedVisit(today, ctx.persona, uid)];
  state.records = [];
  state.emailPrefs = { marketingOptIn: false, optInAt: null };
}

// ---------------------------------------------------------------------------------------------
// Weight (owned by the nutrition fixture as state.weight = { goal, logs }; read lazily)
// ---------------------------------------------------------------------------------------------
function normalizeWeightLog(row, i) {
  if (!row || typeof row !== 'object') return null;
  const kg = Number(row.kg ?? row.weightKg ?? row.value);
  const date = typeof row.date === 'string' && DATE_RE.test(row.date.slice(0, 10))
    ? row.date.slice(0, 10)
    : typeof row.at === 'string'
      ? tbilisiToday(new Date(row.at))
      : null;
  if (!Number.isFinite(kg) || !date) return null;
  const at = typeof row.at === 'string' ? row.at : isoAt(date, '08:00');
  return { id: String(row.id ?? `w-${date}-${i}`), kg, at, date };
}

function nutritionWeightLogs(state) {
  const logs = state.weight?.logs;
  return Array.isArray(logs) ? logs.map(normalizeWeightLog).filter(Boolean) : [];
}

/** date → kg for the health daily rows: the nutrition fixture's logs when present, else the fallback trend. */
function weightByDate(state) {
  const own = nutritionWeightLogs(state);
  const source = state.weight ? own : healthOf(state).fallbackWeights;
  const out = new Map();
  for (const row of source) {
    const prev = out.get(row.date);
    if (!prev || String(row.at) > String(prev.at)) out.set(row.date, row);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Health metrics
// ---------------------------------------------------------------------------------------------
const HEALTH_FIELDS = ['steps', 'weightKg', 'bloodPressureSystolic', 'bloodPressureDiastolic', 'heartRate', 'sleepHours', 'nutritionKcal', 'hydrationMl', 'activeMinutes', 'distanceKm'];

function emptyRow(date, syncedAt) {
  return {
    date,
    steps: null,
    weightKg: null,
    bloodPressureSystolic: null,
    bloodPressureDiastolic: null,
    heartRate: null,
    sleepHours: null,
    nutritionKcal: null,
    hydrationMl: null,
    activeMinutes: null,
    distanceKm: null,
    source: 'merged',
    syncedAt,
  };
}

/** publicDaily() + the weight derived from the weight logs (an explicit synced weight wins). */
function publicRows(state, from, to) {
  const H = healthOf(state);
  const weights = weightByDate(state);
  const dates = new Set([...Object.keys(H.daily), ...weights.keys()]);
  const rows = [];
  for (const date of [...dates].sort()) {
    if (from && date < from) continue;
    if (to && date > to) continue;
    const stored = H.daily[date];
    const w = weights.get(date);
    const row = stored ? { ...stored } : emptyRow(date, w?.at ?? isoAt(date, '08:10'));
    if (row.weightKg == null && w) row.weightKg = w.kg;
    rows.push({
      date: row.date,
      steps: row.steps,
      weightKg: row.weightKg,
      bloodPressureSystolic: row.bloodPressureSystolic,
      bloodPressureDiastolic: row.bloodPressureDiastolic,
      heartRate: row.heartRate,
      sleepHours: row.sleepHours,
      nutritionKcal: row.nutritionKcal,
      hydrationMl: row.hydrationMl,
      activeMinutes: row.activeMinutes,
      distanceKm: row.distanceKm,
      source: row.source,
      syncedAt: row.syncedAt,
    });
  }
  return rows.slice(0, 400);
}

/** Same quirk as the real route: with both bounds the `to` filter replaces the `from` one. */
function stepLogsBetween(state, from, to) {
  let logs = healthOf(state).stepLogs;
  if (to) logs = logs.filter((l) => l.at <= `${to}T23:59:59.999Z`);
  else if (from) logs = logs.filter((l) => l.at >= `${from}T00:00:00.000Z`);
  return [...logs]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 2000)
    .map((l) => ({ id: l.id, at: l.at, count: l.count }));
}

function badDate(rq, value) {
  if (value === undefined || DATE_RE.test(value)) return null;
  return rq.reply(400, {
    error: t(rq, 'შევსებული მონაცემები არასწორია.', 'Some of the details you entered are not valid.'),
    fields: [{ field: '', message: t(rq, 'არასწორი თარიღის ფორმატი', 'Invalid date format') }],
  });
}

const pick = (next, prev) => (next != null ? next : prev ?? null);
const maxInt = (next, prev) => (next == null ? prev ?? null : prev == null ? next : Math.max(next, prev));
const clampHydration = (v) => Math.max(0, Math.min(HYDRATION_ML_CAP, Math.round(Number(v) || 0)));

function mergeDaily(existing, incoming) {
  return {
    steps: maxInt(incoming.steps, existing?.steps),
    weightKg: pick(incoming.weightKg, existing?.weightKg),
    bloodPressureSystolic: pick(incoming.bloodPressureSystolic, existing?.bloodPressureSystolic),
    bloodPressureDiastolic: pick(incoming.bloodPressureDiastolic, existing?.bloodPressureDiastolic),
    heartRate: pick(incoming.heartRate, existing?.heartRate),
    sleepHours:
      incoming.sleepHours != null
        ? existing?.sleepHours != null
          ? Math.max(incoming.sleepHours, existing.sleepHours)
          : incoming.sleepHours
        : existing?.sleepHours ?? null,
    nutritionKcal:
      incoming.nutritionKcal != null
        ? existing?.nutritionKcal != null
          ? existing.nutritionKcal + incoming.nutritionKcal
          : incoming.nutritionKcal
        : existing?.nutritionKcal ?? null,
    hydrationMl:
      incoming.hydrationMl == null
        ? existing?.hydrationMl ?? null
        : existing?.hydrationMl == null
          ? clampHydration(incoming.hydrationMl)
          : Math.max(clampHydration(existing.hydrationMl), clampHydration(incoming.hydrationMl)),
    activeMinutes: maxInt(incoming.activeMinutes, existing?.activeMinutes),
    distanceKm: pick(incoming.distanceKm, existing?.distanceKm),
    source: 'merged',
  };
}

function zodError(rq, field, en) {
  return rq.reply(400, {
    error: t(rq, 'შევსებული მონაცემები არასწორია.', 'Some of the details you entered are not valid.'),
    fields: [{ field, message: en }],
  });
}

function syncHandler(rq) {
  const H = healthOf(rq.state);
  // Real route: 30 syncs/min per user (2026-09-29 loop incident). A trip here means a client loop.
  const nowMs = Date.now();
  H.syncHits = H.syncHits.filter((at) => nowMs - at < 60_000);
  H.syncHits.push(nowMs);
  if (H.syncHits.length > 30) {
    if (H.syncHits.length === 31) console.warn(`[health] /api/health-metrics/sync rate limit tripped (${H.syncHits.length}/min) — client loop?`);
    return rq.reply(429, { error: t(rq, 'ძალიან ხშირი სინქრონიზაცია — ცოტა ხანში ისევ ვცდით.', 'Syncing too often — we will try again shortly.') }, { 'Retry-After': '60' });
  }

  const body = rq.body && typeof rq.body === 'object' ? rq.body : {};
  const daily = Array.isArray(body.daily) ? body.daily : [];
  const stepLogs = Array.isArray(body.stepLogs) ? body.stepLogs : [];
  const hydrationEvents = Array.isArray(body.hydrationEvents) ? body.hydrationEvents : [];
  if (daily.length > 400) return zodError(rq, 'daily', 'Too many rows');
  if (stepLogs.length > 2000) return zodError(rq, 'stepLogs', 'Too many rows');
  if (hydrationEvents.length > 400) return zodError(rq, 'hydrationEvents', 'Too many rows');
  for (const [i, row] of daily.entries()) {
    if (!row || !DATE_RE.test(String(row.date))) return zodError(rq, `daily.${i}.date`, 'Invalid date format');
  }
  for (const [i, log] of stepLogs.entries()) {
    if (!log || !Number.isFinite(Date.parse(log.at)) || !Number.isInteger(log.count) || log.count < 0) return zodError(rq, `stepLogs.${i}`, 'Invalid step log');
  }
  for (const [i, ev] of hydrationEvents.entries()) {
    if (!ev || !String(ev.clientEventId || '').trim() || !DATE_RE.test(String(ev.date)) || !Number.isInteger(ev.deltaMl)) {
      return zodError(rq, `hydrationEvents.${i}`, 'Invalid hydration event');
    }
  }

  const now = new Date().toISOString();
  let dailyUpserted = 0;
  for (const row of daily) {
    const { date, ...metrics } = row;
    // A weigh-in (Home weight sheet) is also the nutrition dashboard's measured weight (nutrition.mjs contract).
    if (typeof metrics.weightKg === 'number' && Number.isFinite(metrics.weightKg) && rq.state.weight) {
      const W = rq.state.weight;
      W.measured = (Array.isArray(W.measured) ? W.measured : []).filter((m) => m.date !== date);
      W.measured.push({ date, weightKg: metrics.weightKg });
    }
    const existing = H.daily[date];
    const merged = mergeDaily(existing, metrics);
    const changed = HEALTH_FIELDS.filter((f) => (merged[f] ?? null) !== (existing?.[f] ?? null));
    if (existing && !changed.length) continue;
    H.daily[date] = { ...(existing ?? emptyRow(date, now)), ...merged, date, syncedAt: now };
    dailyUpserted += 1;
  }

  let stepLogsInserted = 0;
  if (stepLogs.length) {
    const seen = new Set(H.stepLogs.map((l) => l.at));
    for (const log of stepLogs) {
      const at = new Date(log.at).toISOString();
      if (seen.has(at)) continue;
      seen.add(at);
      H.stepLogs.push({ id: randomUUID(), at, count: log.count, source: 'device' });
      stepLogsInserted += 1;
    }
    for (const date of new Set(stepLogs.map((l) => String(l.at).slice(0, 10)))) {
      const sum = H.stepLogs.filter((l) => l.at.slice(0, 10) === date).reduce((a, l) => a + l.count, 0);
      if (sum <= 0) continue;
      const existing = H.daily[date];
      const mergedSteps = Math.max(sum, existing?.steps ?? 0);
      if (existing && existing.steps === mergedSteps) continue;
      H.daily[date] = { ...(existing ?? emptyRow(date, now)), steps: mergedSteps, syncedAt: now };
    }
  }

  if (hydrationEvents.length) {
    const known = new Set(H.hydrationEvents.map((e) => e.clientEventId));
    const dates = new Set();
    for (const ev of hydrationEvents) {
      const clientEventId = String(ev.clientEventId).trim().slice(0, 80);
      dates.add(ev.date);
      if (!ev.deltaMl || known.has(clientEventId)) continue;
      known.add(clientEventId);
      H.hydrationEvents.push({ clientEventId, date: ev.date, deltaMl: ev.deltaMl, at: now });
    }
    for (const date of dates) {
      const total = clampHydration(H.hydrationEvents.filter((e) => e.date === date).reduce((a, e) => a + e.deltaMl, 0));
      const existing = H.daily[date];
      if (existing?.hydrationMl === total) continue;
      if (!existing) dailyUpserted += 1;
      H.daily[date] = { ...(existing ?? emptyRow(date, now)), hydrationMl: total, syncedAt: now };
    }
  }

  return { ok: true, dailyUpserted, stepLogsInserted, syncedAt: now };
}

// ---------------------------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------------------------
function publicMedication(rq, med) {
  const en = rq.lang === 'en' ? MED_EN[med.id] : null;
  const out = clone(med);
  if (en && med.medName === en.ka) {
    out.medName = en.medName;
    out.dosage = en.dosage;
  }
  return out;
}

function buildDailySchedule(medications) {
  return medications
    .flatMap((med) =>
      med.frequency.split(',').map((time) => ({
        medicationId: med.id,
        medName: med.medName,
        dosage: med.dosage,
        notes: med.notes,
        time: time.trim(),
      })),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
}

function parseTimeList(value) {
  const times = String(value ?? '')
    .trim()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!times.length || times.length > 8 || !times.every((s) => TIME_RE.test(s))) return null;
  return [...new Set(times)].sort().join(', ');
}

function medValidation(rq, body, partial) {
  const out = {};
  if (!partial || body.medName !== undefined) {
    const name = String(body.medName ?? '').trim();
    if (name.length < 2 || name.length > 120) return { error: zodError(rq, 'medName', 'Enter the medication name') };
    out.medName = name;
  }
  if (!partial || body.dosage !== undefined) {
    const dosage = String(body.dosage ?? '').trim();
    if (!dosage || dosage.length > 80) return { error: zodError(rq, 'dosage', 'Enter the dose') };
    out.dosage = dosage;
  }
  if (!partial || body.frequency !== undefined) {
    const frequency = parseTimeList(body.frequency);
    if (!frequency) return { error: zodError(rq, 'frequency', 'Time must be in the format 09:00') };
    out.frequency = frequency;
  }
  if (body.notes !== undefined) out.notes = String(body.notes).trim().slice(0, 300);
  if (body.active !== undefined) out.active = Boolean(body.active);
  if (body.config !== undefined && body.config && typeof body.config === 'object') out.config = body.config;
  return { data: out };
}

function sortedMeds(state) {
  return [...state.meds.medications].sort((a, b) => (a.active === b.active ? b.createdAt.localeCompare(a.createdAt) : a.active ? -1 : 1));
}

// ---------------------------------------------------------------------------------------------
// Account app-state (server/src/lib/appState.js)
// ---------------------------------------------------------------------------------------------
const asArray = (v) => (Array.isArray(v) ? v : []);
const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const trimStr = (v, max) => String(v ?? '').trim().slice(0, max);

function sanitizeParameter(row) {
  if (!row || typeof row !== 'object') return null;
  const key = trimStr(row.key, 80);
  if (!key) return null;
  const value = typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : Number(row.value);
  return {
    key,
    nameKa: trimStr(row.nameKa, 160) || key,
    nameEn: trimStr(row.nameEn, 160) || key,
    value: Number.isFinite(value) ? value : 0,
    display: trimStr(row.display, 40) || String(row.value ?? ''),
    unit: trimStr(row.unit, 40),
    refLow: typeof row.refLow === 'number' && Number.isFinite(row.refLow) ? row.refLow : null,
    refHigh: typeof row.refHigh === 'number' && Number.isFinite(row.refHigh) ? row.refHigh : null,
    flag: ['N', 'H', 'L', 'U'].includes(row.flag) ? row.flag : 'U',
  };
}

function sanitizeLabPanel(row) {
  if (!row || typeof row !== 'object') return null;
  const date = trimStr(row.date, 12);
  const id = trimStr(row.id, 80);
  if (!id || !DATE_RE.test(date)) return null;
  const parameters = asArray(row.parameters).map(sanitizeParameter).filter(Boolean).slice(0, 200);
  if (!parameters.length) return null;
  return {
    id,
    date,
    createdAt: trimStr(row.createdAt, 40) || `${date}T00:00:00.000Z`,
    recordIds: asArray(row.recordIds).map((x) => trimStr(x, 80)).filter(Boolean).slice(0, 20),
    analysis: trimStr(row.analysis, 8000),
    visionNotes: row.visionNotes ? trimStr(row.visionNotes, 8000) : undefined,
    parameters,
  };
}

function mergeLabPanelLists(current, incoming) {
  const byDate = new Map();
  for (const raw of [...asArray(current), ...asArray(incoming)]) {
    const panel = sanitizeLabPanel(raw);
    if (!panel) continue;
    const existing = byDate.get(panel.date);
    if (!existing) {
      byDate.set(panel.date, panel);
      continue;
    }
    const params = new Map(existing.parameters.map((p) => [p.key, p]));
    for (const p of panel.parameters) params.set(p.key, p);
    byDate.set(panel.date, {
      ...existing,
      createdAt: existing.createdAt || panel.createdAt,
      recordIds: [...new Set([...existing.recordIds, ...panel.recordIds])],
      analysis: existing.analysis || panel.analysis,
      visionNotes: existing.visionNotes || panel.visionNotes,
      parameters: [...params.values()],
    });
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200);
}

function mergeById(current, incoming, idOf, newer) {
  const map = new Map();
  for (const row of [...asArray(current), ...asArray(incoming)]) {
    if (!row || typeof row !== 'object') continue;
    const id = idOf(row);
    if (!id) continue;
    const prev = map.get(id);
    if (!prev || newer(row, prev)) map.set(id, row);
  }
  return [...map.values()];
}

function pickNewer(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  const at = (row) => String(row.updatedAt ?? row.startedYmd ?? row.deadlineYmd ?? '');
  return at(a) >= at(b) ? a : b;
}

const doseKey = (row) => `${row.date ?? ''} ${row.time ?? ''}`;

function emptyAppState() {
  return { labPanels: [], weightGoal: null, weightLogs: [], stepsGoal: null, stepsGoalHistory: [], runHistory: [], doseLogs: [], symptomHistory: [], updatedAt: null };
}

function mergeAppState(local, remote) {
  const left = { ...emptyAppState(), ...asObject(local) };
  const right = { ...emptyAppState(), ...asObject(remote) };
  return {
    labPanels: mergeLabPanelLists(left.labPanels, right.labPanels),
    weightGoal: pickNewer(left.weightGoal, right.weightGoal),
    weightLogs: mergeById(left.weightLogs, right.weightLogs, (r) => r.id, (a, b) => String(a.at ?? '') > String(b.at ?? ''))
      .sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')))
      .slice(0, 400),
    stepsGoal: pickNewer(left.stepsGoal, right.stepsGoal),
    stepsGoalHistory: mergeById(left.stepsGoalHistory, right.stepsGoalHistory, (r) => r.id, (a, b) => String(a.completedYmd ?? '') > String(b.completedYmd ?? '')).slice(0, 30),
    runHistory: mergeById(left.runHistory, right.runHistory, (r) => r.id, (a, b) => String(a.endedAt ?? '') > String(b.endedAt ?? '')).slice(0, 60),
    doseLogs: mergeById(left.doseLogs, right.doseLogs, (r) => `${r.medicationId}|${r.date}|${r.time}`, (a, b) => String(a.updatedAt ?? '') > String(b.updatedAt ?? ''))
      .sort((a, b) => doseKey(b).localeCompare(doseKey(a)))
      .slice(0, 400),
    symptomHistory: mergeById(left.symptomHistory, right.symptomHistory, (r) => r.recordId, (a, b) => String(a.createdAt ?? '') > String(b.createdAt ?? '')).slice(0, 24),
    updatedAt: [left.updatedAt, right.updatedAt].filter(Boolean).sort().at(-1) ?? new Date().toISOString(),
  };
}

/** loadAppState(): own slice + the nutrition fixture's weight goal/logs, read at request time. */
function currentAppState(state) {
  const s = state.appState;
  return {
    labPanels: s.labPanels,
    weightGoal: state.weight?.goal ?? null,
    weightLogs: nutritionWeightLogs(state),
    stepsGoal: s.stepsGoal,
    stepsGoalHistory: s.stepsGoalHistory,
    runHistory: s.runHistory,
    doseLogs: s.doseLogs,
    symptomHistory: s.symptomHistory,
    updatedAt: s.updatedAt,
  };
}

const APP_STATE_LIMITS = { labPanels: 200, weightLogs: 400, stepsGoalHistory: 30, runHistory: 60, doseLogs: 400, symptomHistory: 24 };
const APP_STATE_KEYS = ['labPanels', 'weightGoal', 'weightLogs', 'stepsGoal', 'stepsGoalHistory', 'runHistory', 'doseLogs', 'symptomHistory'];

function putAppState(rq) {
  const body = asObject(rq.body);
  const patch = {};
  for (const key of APP_STATE_KEYS) if (body[key] !== undefined) patch[key] = body[key];
  if (!Object.keys(patch).length) {
    return rq.reply(400, {
      error: t(rq, 'შევსებული მონაცემები არასწორია.', 'Some of the details you entered are not valid.'),
      fields: [{ field: '', message: t(rq, 'განსაახლებელი ველი არ არის მითითებული', 'No field to update') }],
    });
  }
  for (const [key, max] of Object.entries(APP_STATE_LIMITS)) {
    if (patch[key] === undefined) continue;
    if (!Array.isArray(patch[key]) || patch[key].length > max) return zodError(rq, key, `Expected an array of at most ${max}`);
  }
  const current = currentAppState(rq.state);
  const next = mergeAppState(current, patch);
  next.updatedAt = new Date().toISOString();
  next.labPanels = next.labPanels.map((p) => {
    const copy = { ...p };
    delete copy.visionNotes;
    return copy;
  });

  const s = rq.state.appState;
  s.labPanels = next.labPanels;
  s.stepsGoal = next.stepsGoal;
  s.stepsGoalHistory = next.stepsGoalHistory;
  s.runHistory = next.runHistory;
  s.doseLogs = next.doseLogs;
  s.symptomHistory = next.symptomHistory;
  s.updatedAt = next.updatedAt;

  // Weight belongs to the nutrition fixture: write back only a newer goal and brand-new log rows,
  // keeping its own row objects untouched.
  if (patch.weightGoal !== undefined || patch.weightLogs !== undefined) {
    const known = new Set(current.weightLogs.map((r) => r.id));
    const added = next.weightLogs.filter((r) => !known.has(r.id));
    const goalChanged = next.weightGoal !== current.weightGoal;
    if (goalChanged || added.length) {
      rq.state.weight = rq.state.weight ?? { goal: null, logs: [] };
      if (goalChanged) rq.state.weight.goal = clone(next.weightGoal);
      if (added.length) rq.state.weight.logs = [...asArray(rq.state.weight.logs), ...clone(added)];
    }
  }
  return { state: { ...next } };
}

// ---------------------------------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------------------------------
const NULLABLE_VISIT = ['doctorFirstName', 'doctorLastName', 'address', 'addressLabel', 'lat', 'lng', 'notes'];

function visitValidation(rq, body, partial) {
  const out = {};
  if (!partial || body.doctorType !== undefined) {
    if (!DOCTOR_TYPES.includes(body.doctorType)) return { error: zodError(rq, 'doctorType', 'Invalid doctor type') };
    out.doctorType = body.doctorType;
  }
  if (!partial || body.visitDate !== undefined) {
    if (!DATE_RE.test(String(body.visitDate))) return { error: zodError(rq, 'visitDate', 'Invalid date') };
    out.visitDate = body.visitDate;
  }
  if (!partial || body.visitTime !== undefined) {
    if (!TIME_RE.test(String(body.visitTime))) return { error: zodError(rq, 'visitTime', 'Time must be HH:mm') };
    out.visitTime = body.visitTime;
  }
  for (const key of NULLABLE_VISIT) if (body[key] !== undefined) out[key] = body[key] ?? null;
  if (body.reminderConfig !== undefined) {
    const rc = asObject(body.reminderConfig);
    out.reminderConfig = {
      enabled: rc.enabled ?? true,
      offsetsMinutes: Array.isArray(rc.offsetsMinutes) ? rc.offsetsMinutes : [1440, 60],
      repeatCount: rc.repeatCount ?? 1,
    };
  }
  if (body.active !== undefined) out.active = Boolean(body.active);
  return { data: out };
}

const sortedVisits = (state) => [...state.visits].sort((a, b) => `${a.visitDate} ${a.visitTime}`.localeCompare(`${b.visitDate} ${b.visitTime}`));

// ---------------------------------------------------------------------------------------------
// localStorage seed (optional): pre-fill what accountSync / hydration would otherwise write ~1.2 s
// after sign-in, so the first Home frame already shows dose progress, MEDIRUN walks and water logs.
// Keys are the raw web keys (mobile/src/lib/storage.ts webStorage + localAccount scopedPrefKey).
// ---------------------------------------------------------------------------------------------
export function localSeed(state, userId = userIdOf(state)) {
  const H = healthOf(state);
  const app = currentAppState(state);
  const today = H.seededFor;
  const scoped = (base) => `${base}.${userId}`;
  const deleted = new Set(H.hydrationEvents.filter((e) => e.clientEventId.startsWith('del-')).map((e) => e.clientEventId.slice(4)));
  const hydrationLogs = H.hydrationEvents
    .filter((e) => e.deltaMl > 0 && !e.clientEventId.startsWith('del-') && !deleted.has(e.clientEventId))
    .map((e) => ({ id: e.clientEventId, date: e.date, at: e.at, ml: e.deltaMl, container: 'small', drink: 'water', color: '#14B8A6' }))
    .sort((a, b) => b.at.localeCompare(a.at));
  const from = addDays(today, -90);
  const keys = {
    [scoped('medicard.hydration.logs')]: JSON.stringify(hydrationLogs),
    [scoped('medicard.hydration.goalMl')]: String(H.hydrationGoal.goalMl),
    [scoped('medicard.meds.doseLogs')]: JSON.stringify(app.doseLogs),
    [scoped('medicard.run.history.v1')]: JSON.stringify(app.runHistory),
    [scoped('medicard.steps.goal.v1')]: app.stepsGoal ? JSON.stringify(app.stepsGoal) : '',
    'medicard.steps.goal.v1': app.stepsGoal ? JSON.stringify(app.stepsGoal) : '',
    [scoped('medicard.steps.goal.history')]: JSON.stringify(app.stepsGoalHistory),
    'medicard.steps.goal.history': JSON.stringify(app.stepsGoalHistory),
    [scoped('medicard.symptom-check-history')]: JSON.stringify(app.symptomHistory),
    [scoped('medicard.health.metrics.cache')]: JSON.stringify({ daily: publicRows(state, from, today), stepLogs: stepLogsBetween(state, from, today) }),
  };
  if (app.weightGoal) keys[scoped('medicard.weight.goal.v1')] = JSON.stringify(app.weightGoal);
  if (app.weightLogs.length) keys[scoped('medicard.weight.logs.v1')] = JSON.stringify(app.weightLogs);
  return keys;
}

// ---------------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------------
/** requireAuth: every real route here sits behind it. */
function unauthorized(rq) {
  if (/^Bearer\s+\S{8,}/.test(rq.auth || '')) return null;
  return rq.reply(401, { error: t(rq, 'ავტორიზაცია საჭიროა. შედი ანგარიშში.', 'Please sign in to continue.') });
}

const RAW_ROUTES = [
  // ---- health metrics ----
  {
    method: 'GET',
    path: '/api/health-metrics',
    handler: (rq) => {
      const { from, to } = rq.query;
      return badDate(rq, from) ?? badDate(rq, to) ?? { daily: publicRows(rq.state, from, to), stepLogs: stepLogsBetween(rq.state, from, to) };
    },
  },
  {
    method: 'GET',
    path: '/api/health-metrics/daily',
    handler: (rq) => {
      const { from, to } = rq.query;
      return badDate(rq, from) ?? badDate(rq, to) ?? { daily: publicRows(rq.state, from, to) };
    },
  },
  {
    method: 'GET',
    path: '/api/health-metrics/steps',
    handler: (rq) => {
      const { from, to } = rq.query;
      const bad = badDate(rq, from) ?? badDate(rq, to);
      if (bad) return bad;
      let logs = healthOf(rq.state).stepLogs;
      if (from) logs = logs.filter((l) => l.at >= `${from}T00:00:00.000Z`);
      if (to) logs = logs.filter((l) => l.at <= `${to}T23:59:59.999Z`);
      return { logs: [...logs].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 2000).map((l) => ({ id: l.id, at: l.at, count: l.count })) };
    },
  },
  { method: 'POST', path: '/api/health-metrics/sync', handler: syncHandler },
  {
    method: 'GET',
    path: '/api/health-metrics/hydration/goal',
    handler: (rq) => ({ ...healthOf(rq.state).hydrationGoal }),
  },
  {
    method: 'PUT',
    path: '/api/health-metrics/hydration/goal',
    handler: (rq) => {
      const raw = rq.body?.goalMl;
      if (!Number.isInteger(raw)) return zodError(rq, 'goalMl', 'Expected an integer');
      if (raw < 250 || raw > 8000) {
        return rq.reply(400, { error: t(rq, 'არასწორი ჰიდრატაციის მიზანი.', 'Invalid hydration goal.'), code: 'HYDRATION_GOAL_RANGE' });
      }
      const H = healthOf(rq.state);
      H.hydrationGoal = { goalMl: raw, updatedAt: new Date().toISOString() };
      return { ...H.hydrationGoal };
    },
  },
  {
    method: 'GET',
    path: '/api/health-metrics/steps/capability',
    handler: (rq) => ({ ...healthOf(rq.state).stepCapability }),
  },
  {
    method: 'PUT',
    path: '/api/health-metrics/steps/capability',
    handler: (rq) => {
      const { status, source } = asObject(rq.body);
      if (!STEP_CAPABILITY_STATUSES.includes(status)) {
        return rq.reply(400, { error: t(rq, 'არასწორი ნაბიჯების სტატუსი.', 'Invalid step tracking status.'), code: 'STEP_CAPABILITY_INVALID' });
      }
      const H = healthOf(rq.state);
      H.stepCapability = { status, source: STEP_CAPABILITY_SOURCES.includes(source) ? source : 'UNKNOWN', updatedAt: new Date().toISOString() };
      return { ...H.stepCapability };
    },
  },

  // ---- medications ----
  {
    method: 'GET',
    path: '/api/medications',
    handler: (rq) => {
      healthOf(rq.state);
      const medications = sortedMeds(rq.state).map((m) => publicMedication(rq, m));
      return { medications, schedule: buildDailySchedule(medications.filter((m) => m.active)) };
    },
  },
  {
    method: 'POST',
    path: '/api/medications',
    handler: (rq) => {
      const { data, error } = medValidation(rq, asObject(rq.body), false);
      if (error) return error;
      const medication = {
        id: randomUUID(),
        userId: userIdOf(rq.state),
        medName: data.medName,
        dosage: data.dosage,
        frequency: data.frequency,
        notes: data.notes ?? null,
        active: data.active ?? true,
        config: data.config ?? {},
        createdAt: new Date().toISOString(),
      };
      rq.state.meds.medications.push(medication);
      return rq.reply(201, { medication: clone(medication) });
    },
  },
  {
    method: 'PATCH',
    path: '/api/medications/:id',
    handler: (rq) => {
      if (!UUID_RE.test(rq.params.id)) return zodError(rq, 'id', 'Invalid identifier');
      const med = rq.state.meds.medications.find((m) => m.id === rq.params.id);
      if (!med) return rq.reply(404, { error: t(rq, 'მედიკამენტი ვერ მოიძებნა.', 'Medication not found.') });
      const { data, error } = medValidation(rq, asObject(rq.body), true);
      if (error) return error;
      Object.assign(med, data);
      return { medication: publicMedication(rq, med) };
    },
  },
  {
    method: 'DELETE',
    path: '/api/medications/:id',
    handler: (rq) => {
      if (!UUID_RE.test(rq.params.id)) return zodError(rq, 'id', 'Invalid identifier');
      const before = rq.state.meds.medications.length;
      rq.state.meds.medications = rq.state.meds.medications.filter((m) => m.id !== rq.params.id);
      if (rq.state.meds.medications.length === before) return rq.reply(404, { error: t(rq, 'მედიკამენტი ვერ მოიძებნა.', 'Medication not found.') });
      return { deleted: true };
    },
  },

  // ---- account ----
  {
    method: 'GET',
    path: '/api/account/app-state',
    handler: (rq) => {
      healthOf(rq.state);
      return { state: clone(currentAppState(rq.state)) };
    },
  },
  {
    method: 'PUT',
    path: '/api/account/app-state',
    handler: (rq) => {
      healthOf(rq.state);
      return putAppState(rq);
    },
  },
  {
    method: 'GET',
    path: '/api/account/email-preferences',
    handler: (rq) => {
      healthOf(rq.state);
      const email = String(rq.state.user?.email ?? '');
      const canReceive = /@/.test(email) && !/@(phone|apple)\.medicard\.ge$/i.test(email);
      return { marketingOptIn: rq.state.emailPrefs.marketingOptIn, optInAt: rq.state.emailPrefs.optInAt, canReceive };
    },
  },
  {
    method: 'PATCH',
    path: '/api/account/email-preferences',
    handler: (rq) => {
      healthOf(rq.state);
      const optIn = rq.body?.marketingOptIn;
      if (typeof optIn !== 'boolean') return zodError(rq, 'marketingOptIn', 'Expected boolean');
      const email = String(rq.state.user?.email ?? '');
      const canReceive = /@/.test(email) && !/@(phone|apple)\.medicard\.ge$/i.test(email);
      if (optIn && !canReceive) {
        return rq.reply(400, { error: t(rq, 'ანგარიშზე ელფოსტა არ არის მითითებული.', 'There is no email address on your account.'), code: 'NO_EMAIL' });
      }
      const prefs = rq.state.emailPrefs;
      if (optIn && !prefs.marketingOptIn) rq.state.emailPrefs = { marketingOptIn: true, optInAt: new Date().toISOString() };
      if (!optIn) rq.state.emailPrefs = { marketingOptIn: false, optInAt: null };
      return { ...rq.state.emailPrefs, canReceive };
    },
  },

  // ---- visits (reconcileAllLocalReminders reads the list on every sign-in) ----
  { method: 'GET', path: '/api/visits/geocode', handler: () => ({ results: [] }) },
  {
    method: 'GET',
    path: '/api/visits',
    handler: (rq) => {
      healthOf(rq.state);
      return { visits: clone(sortedVisits(rq.state)) };
    },
  },
  {
    method: 'POST',
    path: '/api/visits',
    handler: (rq) => {
      healthOf(rq.state);
      const { data, error } = visitValidation(rq, asObject(rq.body), false);
      if (error) return error;
      const now = new Date().toISOString();
      const visit = {
        id: randomUUID(),
        userId: userIdOf(rq.state),
        doctorType: data.doctorType,
        doctorFirstName: data.doctorFirstName ?? null,
        doctorLastName: data.doctorLastName ?? null,
        visitDate: data.visitDate,
        visitTime: data.visitTime,
        address: data.address ?? null,
        addressLabel: data.addressLabel ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        notes: data.notes ?? null,
        reminderConfig: data.reminderConfig ?? { enabled: true, offsetsMinutes: [1440, 60], repeatCount: 1 },
        active: data.active ?? true,
        createdAt: now,
        updatedAt: now,
      };
      rq.state.visits.push(visit);
      return rq.reply(201, { visit: clone(visit) });
    },
  },
  {
    method: 'PATCH',
    path: '/api/visits/:id',
    handler: (rq) => {
      if (!UUID_RE.test(rq.params.id)) return zodError(rq, 'id', 'Invalid identifier');
      const visit = (rq.state.visits ?? []).find((v) => v.id === rq.params.id);
      if (!visit) return rq.reply(404, { error: t(rq, 'ვიზიტი ვერ მოიძებნა.', 'Visit not found.') });
      const { data, error } = visitValidation(rq, asObject(rq.body), true);
      if (error) return error;
      Object.assign(visit, data, { updatedAt: new Date().toISOString() });
      return { visit: clone(visit) };
    },
  },
  {
    method: 'DELETE',
    path: '/api/visits/:id',
    handler: (rq) => {
      if (!UUID_RE.test(rq.params.id)) return zodError(rq, 'id', 'Invalid identifier');
      const before = (rq.state.visits ?? []).length;
      rq.state.visits = (rq.state.visits ?? []).filter((v) => v.id !== rq.params.id);
      if (rq.state.visits.length === before) return rq.reply(404, { error: t(rq, 'ვიზიტი ვერ მოიძებნა.', 'Visit not found.') });
      return { deleted: true };
    },
  },

  // ---- records (empty archive; lab panels stay [] in app-state) ----
  {
    method: 'GET',
    path: '/api/records',
    handler: (rq) => {
      healthOf(rq.state);
      const type = rq.query.type;
      if (type !== undefined && !RECORD_TYPES.includes(type)) return zodError(rq, 'type', 'Invalid record type');
      const take = Math.max(1, Math.min(100, Number.parseInt(rq.query.take ?? '50', 10) || 50));
      const skip = Math.max(0, Number.parseInt(rq.query.skip ?? '0', 10) || 0);
      const rows = rq.state.records.filter((r) => !type || r.type === type).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { records: clone(rows.slice(skip, skip + take)), total: rows.length, take, skip };
    },
  },
  {
    method: 'GET',
    path: '/api/records/:id',
    handler: (rq) => {
      const record = (rq.state.records ?? []).find((r) => r.id === rq.params.id);
      if (!record) return rq.reply(404, { error: t(rq, 'ჩანაწერი ვერ მოიძებნა.', 'Record not found.') });
      return { record: clone(record) };
    },
  },
  {
    method: 'DELETE',
    path: '/api/records/:id',
    handler: (rq) => {
      const before = (rq.state.records ?? []).length;
      rq.state.records = (rq.state.records ?? []).filter((r) => r.id !== rq.params.id);
      if (rq.state.records.length === before) return rq.reply(404, { error: t(rq, 'ჩანაწერი ვერ მოიძებნა.', 'Record not found.') });
      return { deleted: true };
    },
  },

  // ---- push writes from the medications flow (GET /api/push/templates lives in engage.mjs) ----
  // saveDoseLog → syncDoseEvent when a dose is marked taken/skipped.
  {
    method: 'POST',
    path: '/api/push/dose-events',
    handler: (rq) => {
      const events = Array.isArray(rq.body?.events) ? rq.body.events.slice(0, 100) : [];
      healthOf(rq.state).pushDoseEvents.push(...events);
      return { ok: true, upserted: events.length };
    },
  },

  // ---- QA helper (not an app route) ----
  {
    method: 'GET',
    path: '/__health/local-seed',
    handler: (rq) => {
      const userId = String(rq.query.userId || userIdOf(rq.state));
      return { userId, keys: localSeed(rq.state, userId) };
    },
  },
];

export const routes = RAW_ROUTES.map((route) =>
  String(route.path).startsWith('/api/') ? { ...route, handler: (rq) => unauthorized(rq) ?? route.handler(rq) } : route,
);
