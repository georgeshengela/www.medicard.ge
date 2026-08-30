/**
 * Cycle prediction helpers — period, fertile window, ovulation.
 * Identity is a civil calendar day YYYY-MM-DD, never a timestamp.
 * Engine "today" is Asia/Tbilisi — never Date#toISOString, never host TZ.
 */

import {
  CYCLE_AI_HONESTY_RULES,
  CYCLE_CONTRACEPTION_AI_RULES,
  cycleHonestyFlags,
  irregularLengthAlertKa,
  latePeriodAlertKa,
  nextPeriodEstimateBody,
  pcosCautionKa,
  ttcWindowBody,
  emptyCycleAiCache,
} from './cycleHonesty.js';
import {
  buildTtcObservationCards,
  collectFertilityTests,
  CYCLE_FERTILITY_AI_RULES,
  fertilityObservationBits,
} from './cycleFertility.js';
import {
  contraceptionInsightsFilter,
  interpretContraception,
} from './cycleContraception.js';

export { emptyCycleAiCache };

export const CYCLE_TIMEZONE = 'Asia/Tbilisi';
export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_LENGTH = 5;

/** Product "today" in an IANA zone. Host / browser TZ must not leak in. */
export function todayInTimeZone(timeZone = CYCLE_TIMEZONE, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const pick = (type) => parts.find((p) => p.type === type)?.value;
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/**
 * Serialize a stored date-only value (@db.Date or YYYY-MM-DD).
 * Uses UTC civil parts so midnight UTC does not shift the calendar day.
 * Do not use this for "now" — use todayInTimeZone.
 */
export function toDateKey(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(key, days) {
  const d = parseDateKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
}

export function daysBetween(a, b) {
  const ms = parseDateKey(b) - parseDateKey(a);
  return Math.round(ms / 86_400_000);
}

/** Confirmed bleed — spotting is not a period start. */
export const PERIOD_FLOWS = ['light', 'medium', 'heavy'];

export function isPeriodFlow(flow) {
  return PERIOD_FLOWS.includes(flow);
}

/** Infer averages and logged period ranges from bleed days (not spotting). */
export function inferCycleStats(
  logs,
  fallbackCycle = DEFAULT_CYCLE_LENGTH,
  fallbackPeriod = DEFAULT_PERIOD_LENGTH,
) {
  const periodStarts = [];
  const periodRanges = [];
  const sorted = [...logs].sort((x, y) => x.date.localeCompare(y.date));
  let lastBleedDate = null;
  let runStart = null;
  let runEnd = null;

  const flushRun = () => {
    if (!runStart || !runEnd) return;
    periodRanges.push({
      start: runStart,
      end: runEnd,
      lengthDays: daysBetween(runStart, runEnd) + 1,
      source: 'logged',
    });
    runStart = null;
    runEnd = null;
  };

  for (const log of sorted) {
    if (!isPeriodFlow(log.flow)) continue;
    if (!lastBleedDate || daysBetween(lastBleedDate, log.date) > 1) {
      flushRun();
      periodStarts.push(log.date);
      runStart = log.date;
      runEnd = log.date;
    } else {
      runEnd = log.date;
    }
    lastBleedDate = log.date;
  }
  flushRun();

  const gaps = [];
  for (let i = 1; i < periodStarts.length; i += 1) {
    const gap = daysBetween(periodStarts[i - 1], periodStarts[i]);
    if (gap >= 18 && gap <= 45) gaps.push(gap);
  }

  const hasInferredCycle = gaps.length >= 2;
  const avgCycle = hasInferredCycle
    ? Math.round(gaps.reduce((s, n) => s + n, 0) / gaps.length)
    : fallbackCycle;

  const periodLengths = periodRanges
    .map((r) => r.lengthDays)
    .filter((n) => n >= 2 && n <= 10);
  const hasInferredPeriod = periodLengths.length >= 1;
  const avgPeriod = hasInferredPeriod
    ? Math.round(periodLengths.reduce((s, n) => s + n, 0) / periodLengths.length)
    : fallbackPeriod;

  const inferredCycleLength = hasInferredCycle
    ? Math.min(45, Math.max(21, avgCycle))
    : null;
  const inferredPeriodLength = hasInferredPeriod
    ? Math.min(10, Math.max(2, avgPeriod))
    : null;

  return {
    avgCycleLength: inferredCycleLength ?? Math.min(45, Math.max(21, fallbackCycle)),
    avgPeriodLength: inferredPeriodLength ?? Math.min(10, Math.max(2, fallbackPeriod)),
    inferredCycleLength,
    inferredPeriodLength,
    periodStarts,
    periodRanges,
    cycleCount: gaps.length,
    lastPeriodStart: periodStarts[periodStarts.length - 1] ?? null,
  };
}

/**
 * Recommendation C: never overwrite stored profile averages.
 * Forecast uses inferred lengths when cycleCount >= 2, else stored, else defaults.
 */
export function resolveForecastAverages(profile, inferred) {
  const storedCycle = Number.isFinite(profile?.avgCycleLength)
    ? profile.avgCycleLength
    : DEFAULT_CYCLE_LENGTH;
  const storedPeriod = Number.isFinite(profile?.avgPeriodLength)
    ? profile.avgPeriodLength
    : DEFAULT_PERIOD_LENGTH;
  const cycleCount = inferred?.cycleCount ?? 0;
  const inferredCycle = inferred?.inferredCycleLength ?? null;
  const inferredPeriod = inferred?.inferredPeriodLength ?? null;

  if (cycleCount >= 2 && inferredCycle != null) {
    return {
      storedCycleLength: storedCycle,
      storedPeriodLength: storedPeriod,
      inferredCycleLength: inferredCycle,
      inferredPeriodLength: inferredPeriod,
      usedCycleLength: inferredCycle,
      usedPeriodLength: inferredPeriod ?? storedPeriod,
      source: 'inferred',
      cycleCount,
    };
  }

  const usingDefaults =
    storedCycle === DEFAULT_CYCLE_LENGTH && storedPeriod === DEFAULT_PERIOD_LENGTH;

  return {
    storedCycleLength: storedCycle,
    storedPeriodLength: storedPeriod,
    inferredCycleLength: inferredCycle,
    inferredPeriodLength: inferredPeriod,
    usedCycleLength: storedCycle,
    usedPeriodLength: storedPeriod,
    source: usingDefaults ? 'default' : 'user',
    cycleCount,
  };
}

export function cycleLengthStats(cycleLengths = []) {
  const lengths = cycleLengths.map((c) => c.length).filter((n) => Number.isFinite(n));
  if (!lengths.length) {
    return { shortest: null, longest: null, variability: null, count: 0 };
  }
  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);
  return {
    shortest,
    longest,
    variability: longest - shortest,
    count: lengths.length,
  };
}

export function predictionConfidence({ cycleCount = 0, isIrregular = false }) {
  if (isIrregular || cycleCount < 2) return 'low';
  if (cycleCount < 6) return 'medium';
  return 'high';
}

/**
 * Build predictions from last period start + averages.
 * Fertile window ≈ ovulation −5 … ovulation +1; ovulation ≈ cycleLength − 14.
 * Forecast object is always estimated. Logs must overlay predicted:false separately.
 */
export function buildPredictions({
  lastPeriodStart,
  avgCycleLength = DEFAULT_CYCLE_LENGTH,
  avgPeriodLength = DEFAULT_PERIOD_LENGTH,
  horizonDays = 90,
  cycleCount = 0,
  isIrregular = false,
  logs = [],
}) {
  const confidence = predictionConfidence({ cycleCount, isIrregular });
  if (!lastPeriodStart) {
    return {
      nextPeriodStart: null,
      nextPeriodEnd: null,
      ovulationDate: null,
      fertileWindow: null,
      phases: [],
      calendar: {},
      confidence,
      estimated: true,
    };
  }

  const calendar = {};
  const phases = [];
  let start = lastPeriodStart;

  for (let cycle = 0; cycle < 4; cycle += 1) {
    const periodEnd = addDays(start, avgPeriodLength - 1);
    const ovulation = addDays(start, avgCycleLength - 14);
    const fertileStart = addDays(ovulation, -5);
    const fertileEnd = addDays(ovulation, 1);
    const nextStart = addDays(start, avgCycleLength);

    phases.push({
      periodStart: start,
      periodEnd,
      ovulation,
      fertileStart,
      fertileEnd,
      nextPeriodStart: nextStart,
    });

    for (let i = 0; i < avgPeriodLength; i += 1) {
      const key = addDays(start, i);
      calendar[key] = {
        ...(calendar[key] || {}),
        period: true,
        predicted: true,
        estimated: true,
      };
    }
    for (let i = 0; i <= daysBetween(fertileStart, fertileEnd); i += 1) {
      const key = addDays(fertileStart, i);
      calendar[key] = { ...(calendar[key] || {}), fertile: true, estimated: true };
    }
    calendar[ovulation] = {
      ...(calendar[ovulation] || {}),
      ovulation: true,
      fertile: true,
      estimated: true,
    };

    start = nextStart;
    if (daysBetween(lastPeriodStart, start) > horizonDays) break;
  }

  const upcoming = phases.find((p) => p.periodStart >= lastPeriodStart) || phases[0];
  const next = phases.find((p) => p.periodStart > lastPeriodStart) || phases[1] || upcoming;

  let marked = calendar;
  if (logs.length) marked = overlayLogsOnCalendar(marked, logs);
  marked = stampCalendarPhases(marked, {
    lastPeriodStart,
    avgCycleLength,
    avgPeriodLength,
    fromKey: lastPeriodStart,
    toKey: addDays(lastPeriodStart, horizonDays),
  });

  return {
    nextPeriodStart: next?.periodStart ?? null,
    nextPeriodEnd: next?.periodEnd ?? null,
    ovulationDate: upcoming?.ovulation ?? null,
    fertileWindow: upcoming
      ? { start: upcoming.fertileStart, end: upcoming.fertileEnd }
      : null,
    phases,
    calendar: marked,
    confidence,
    estimated: true,
  };
}

/** Fill every civil day in [fromKey, toKey] with server cycleDay + phase. */
export function stampCalendarPhases(calendar, {
  lastPeriodStart,
  avgCycleLength = DEFAULT_CYCLE_LENGTH,
  avgPeriodLength = DEFAULT_PERIOD_LENGTH,
  fromKey,
  toKey,
}) {
  if (!lastPeriodStart || !fromKey || !toKey) return calendar;
  const next = { ...calendar };
  let key = fromKey;
  for (let i = 0; i < 500 && key <= toKey; i += 1) {
    const info = detectCyclePhase({
      lastPeriodStart,
      avgCycleLength,
      avgPeriodLength,
      today: key,
    });
    const prev = next[key] || {};
    const loggedActual = prev.predicted === false;
    next[key] = {
      ...prev,
      cycleDay: info.day,
      phase: info.phase,
      phaseKa: info.phaseKa,
      estimated: loggedActual ? false : Boolean(prev.predicted || prev.fertile || prev.ovulation),
    };
    key = addDays(key, 1);
  }
  return next;
}

/** Keep onboarding/profile start when logs have no confirmed bleed run. */
export function pickLastPeriodStart(
  current,
  logs,
  fallbackCycle = DEFAULT_CYCLE_LENGTH,
  fallbackPeriod = DEFAULT_PERIOD_LENGTH,
) {
  const inferred = inferCycleStats(logs, fallbackCycle, fallbackPeriod);
  return inferred.lastPeriodStart || current || null;
}

/**
 * Overlay daily logs on a forecast calendar.
 * Logged light/medium/heavy → period + predicted:false.
 * Spotting / none never count as a period day.
 */
export function overlayLogsOnCalendar(calendar, logs) {
  const next = { ...calendar };
  for (const log of logs) {
    const hasNotes =
      (Array.isArray(log.symptoms) && log.symptoms.length > 0) ||
      (Array.isArray(log.moods) && log.moods.length > 0) ||
      log.notes ||
      log.bbt != null ||
      log.sexualActivity != null ||
      log.ovulationTest != null ||
      log.pregnancyTest != null ||
      Boolean(log.cervicalMucus);
    if (isPeriodFlow(log.flow)) {
      next[log.date] = {
        ...(next[log.date] || {}),
        period: true,
        predicted: false,
        estimated: false,
        logged: true,
        flow: log.flow,
      };
    } else if (log.flow === 'spotting') {
      next[log.date] = {
        ...(next[log.date] || {}),
        logged: true,
        flow: 'spotting',
        period: false,
      };
    } else if (log.flow === 'none' || hasNotes) {
      next[log.date] = {
        ...(next[log.date] || {}),
        logged: true,
        ...(log.flow ? { flow: log.flow } : {}),
        ...(log.flow === 'none' ? { period: false } : {}),
      };
    }
  }
  return next;
}

export function gestationalAge(dueDateKey, todayKey = todayInTimeZone()) {
  if (!dueDateKey || !todayKey) return null;
  // Pregnancy: due date = LMP + 280 days → current day of pregnancy = 280 - daysUntilDue
  const daysUntilDue = daysBetween(todayKey, dueDateKey);
  const dayOfPregnancy = 280 - daysUntilDue;
  if (dayOfPregnancy < 0 || dayOfPregnancy > 300) return null;
  const week = Math.floor(dayOfPregnancy / 7);
  const day = dayOfPregnancy % 7;
  return { week, day, dayOfPregnancy, trimester: week < 13 ? 1 : week < 27 ? 2 : 3 };
}

/** Size metaphors by pregnancy week (Georgian). */
export const FETAL_SIZE_KA = {
  4: { size: 'ყაყაჩოს მარცვალი', note: 'იმპლანტაცია და ადრეული განვითარება' },
  5: { size: 'სეზამის მარცვალი', note: 'გულის პირველი დარტყმები' },
  6: { size: 'ოცეული', note: 'ნერვული მილის ფორმირება' },
  8: { size: 'მოცვი', note: 'კიდურების ჩანასახები' },
  10: { size: 'მარწყვი', note: 'ორგანოების ძირითადი სტრუქტურა' },
  12: { size: 'ცაცხვი', note: 'პირველი ტრიმესტრის დასასრული' },
  14: { size: 'ქლიავი', note: 'მიმიკის კუნთები იწყებს მუშაობას' },
  16: { size: 'ავოკადო', note: 'შეგიძლიათ იგრძნოთ მოძრაობა' },
  18: { size: 'ბულგარული წიწაკა', note: 'სმენის განვითარება' },
  20: { size: 'ბანანი', note: 'შუა ორსულობა — ანატომიური სკანირება' },
  24: { size: 'სიმინდის თავი', note: 'ფილტვების მომწიფება იწყება' },
  28: { size: 'ბადრიჯანი', note: 'თვალები იხსნება' },
  32: { size: 'კოქოსი', note: 'ცხიმოვანი ქსოვილის დაგროვება' },
  36: { size: 'რომანული სალათი', note: 'მზადება მშობიარობისთვის' },
  40: { size: 'საზამთრო', note: 'სრული ვადა' },
};

export function fetalInsightForWeek(week) {
  const keys = Object.keys(FETAL_SIZE_KA)
    .map(Number)
    .sort((a, b) => a - b);
  let best = keys[0];
  for (const k of keys) {
    if (k <= week) best = k;
  }
  return { week, ...(FETAL_SIZE_KA[best] || FETAL_SIZE_KA[14]) };
}

export function buildDoctorSummary({ profile, logs, predictions }) {
  const flowDays = logs.filter((l) => isPeriodFlow(l.flow));
  const inferred = inferCycleStats(logs, profile.avgCycleLength, profile.avgPeriodLength);
  const lengths = [];
  for (let i = 1; i < (inferred.periodStarts?.length ?? 0); i += 1) {
    const gap = daysBetween(inferred.periodStarts[i - 1], inferred.periodStarts[i]);
    if (gap >= 18 && gap <= 45) lengths.push(gap);
  }
  const stats = cycleLengthStats(lengths.map((length) => ({ length })));
  const confidence = predictionConfidence({
    cycleCount: stats.count,
    isIrregular: profile.isIrregular,
  });
  const symptomFreq = {};
  const moodFreq = {};
  for (const log of logs) {
    for (const s of Array.isArray(log.symptoms) ? log.symptoms : []) {
      symptomFreq[s] = (symptomFreq[s] || 0) + 1;
    }
    for (const m of Array.isArray(log.moods) ? log.moods : []) {
      moodFreq[m] = (moodFreq[m] || 0) + 1;
    }
  }
  const topSymptoms = Object.entries(symptomFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => ({ key, count }));
  const topMoods = Object.entries(moodFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ key, count }));

  return {
    mode: profile.mode,
    avgCycleLength: profile.avgCycleLength,
    avgPeriodLength: profile.avgPeriodLength,
    isIrregular: profile.isIrregular,
    loggedDays: logs.length,
    periodDaysLogged: flowDays.length,
    nextPeriodStart: predictions.nextPeriodStart,
    ovulationDate: predictions.ovulationDate,
    fertileWindow: predictions.fertileWindow,
    selfReportedContraception: {
      method: profile.contraceptionMethod ?? null,
      startedAt: toDateKey(profile.contraceptionStartedAt) ??
        (typeof profile.contraceptionStartedAt === 'string' ? profile.contraceptionStartedAt : null),
      label: 'self_reported',
    },
    topSymptoms,
    topMoods,
    shortestCycle: stats.shortest,
    longestCycle: stats.longest,
    variability: stats.variability,
    cycleCount: stats.count,
    confidence,
    generatedAt: new Date().toISOString(),
    fertilityTests: {
      ...collectFertilityTests(logs),
      label: 'user_logged',
    },
  };
}

const SYMPTOM_KA = {
  cramps: 'კრუნჩხვები',
  headache: 'თავის ტკივილი',
  bloating: 'შებერილობა',
  acne: 'აკნე',
  fatigue: 'დაღლილობა',
  back_pain: 'წელის ტკივილი',
  breast_tenderness: 'მკერდის მგრძნობელობა',
  nausea: 'გულისრევა',
  anxious: 'შფოთვა',
  irritable: 'გაღიზიანება',
  sensitive: 'მგრძნობიარე',
  energetic: 'ენერგიული',
  sad: 'სევდიანი',
};

export function detectCyclePhase({
  lastPeriodStart,
  avgCycleLength = DEFAULT_CYCLE_LENGTH,
  avgPeriodLength = DEFAULT_PERIOD_LENGTH,
  today = todayInTimeZone(),
}) {
  if (!lastPeriodStart) return { day: null, phase: 'unknown', phaseKa: 'უცნობი ფაზა' };
  const day = daysBetween(lastPeriodStart, today) + 1;
  if (day < 1) return { day: null, phase: 'unknown', phaseKa: 'უცნობი ფაზა' };
  const cycleDay = ((day - 1) % avgCycleLength) + 1;
  // Same civil day as buildPredictions: ovulation = LMP + (length − 14) → cycle day length − 13.
  const ovulationCycleDay = avgCycleLength - 13;
  if (cycleDay <= avgPeriodLength) {
    return { day: cycleDay, phase: 'period', phaseKa: 'მენსტრუაცია' };
  }
  if (cycleDay >= ovulationCycleDay - 5 && cycleDay <= ovulationCycleDay + 1) {
    return {
      day: cycleDay,
      phase: cycleDay === ovulationCycleDay ? 'ovulation' : 'fertile',
      phaseKa: cycleDay === ovulationCycleDay ? 'ოვულაცია' : 'ნაყოფიერი ფანჯარა',
    };
  }
  if (cycleDay > ovulationCycleDay + 1) {
    return { day: cycleDay, phase: 'luteal', phaseKa: 'ლუთეალური ფაზა' };
  }
  return { day: cycleDay, phase: 'follicular', phaseKa: 'ფოლიკულური ფაზა' };
}

/** Instant Flo-like tips (no AI) — shown while / as fallback to EvidenceMD. */
export function buildLocalInsights({ profile, logs, predictions, pregnancy, averages, today, contraception }) {
  const phase = detectCyclePhase({
    lastPeriodStart: toDateKey(profile.lastPeriodStart),
    avgCycleLength: averages?.usedCycleLength ?? profile.avgCycleLength,
    avgPeriodLength: averages?.usedPeriodLength ?? profile.avgPeriodLength,
    today: today || todayInTimeZone(),
  });
  const flags = cycleHonestyFlags({
    confidence: predictions?.confidence,
    isIrregular: profile.isIrregular,
    conditions: parseConditions(profile),
  });
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const symptoms = recent.flatMap((l) => (Array.isArray(l.symptoms) ? l.symptoms : []));
  const moods = recent.flatMap((l) => (Array.isArray(l.moods) ? l.moods : []));
  const cards = [];

  cards.push({
    id: 'phase_today',
    tone: phase.phase === 'fertile' || phase.phase === 'ovulation' ? 'fertile' : 'calm',
    title: phase.phaseKa,
    body:
      phase.day != null
        ? `დღეს ციკლის ${phase.day}-ე დღეა. სავარაუდო ფაზა: ${phase.phaseKa}. ეს კალენდარული შეფასებაა, არა ჰორმონის გაზომვა.`
        : 'მონიშნეთ ბოლო მენსტრუაციის დასაწყისი უფრო ზუსტი პროგნოზებისთვის.',
    action: 'გახსენი დღის აღრიცხვა',
  });

  if (symptoms.includes('cramps') || symptoms.includes('back_pain')) {
    cards.push({
      id: 'cramps_care',
      tone: 'care',
      title: 'კრუნჩხვების შემსუბუქება',
      body: 'სითბო მუცელზე, მსუბუქი გაჭიმვა და ჰიდრატაცია ხშირად ეხმარება. ძლიერი ტკივილისას მიმართეთ ექიმს.',
      action: 'დალიე წყალი და დაისვენე',
    });
  }
  if (moods.includes('anxious') || moods.includes('irritable') || moods.includes('sad')) {
    cards.push({
      id: 'mood_support',
      tone: 'mood',
      title: 'განწყობის მხარდაჭერა',
      body: 'მოკლე სეირნობა, სუნთქვის ვარჯიში ან საყვარელ ადამიანთან საუბარი შეუძლია დაძაბულობის შემცირებას.',
      action: '5 წუთი სიღრმისეული სუნთქვა',
    });
  }
  if (
    profile.mode === 'TRY_TO_CONCEIVE' &&
    predictions?.fertileWindow &&
    contraception?.presentation?.showFertileWindow !== false
  ) {
    cards.push({
      id: 'ttc_window',
      tone: 'fertile',
      title: 'სავარაუდო ნაყოფიერი ფანჯარა',
      body: ttcWindowBody(predictions, flags),
      action: 'აღრიცხე BBT ან ლორწო',
    });
    cards.push(
      ...buildTtcObservationCards({
        logs,
        today: today || todayInTimeZone(),
        lastPeriodStart: toDateKey(profile.lastPeriodStart),
      }),
    );
  }
  if (profile.mode === 'PREGNANCY' && pregnancy?.age) {
    cards.push({
      id: 'preg_week',
      tone: 'pregnancy',
      title: `ორსულობა · კვირა ${pregnancy.age.week}`,
      body:
        pregnancy.insight?.note ||
        'პრენატალური ვიტამინი, წყალი და რბილი აქტივობა დღესაც მნიშვნელოვანია.',
      action: 'გახსენი ორსულობის ჩეკლისტი',
    });
  }
  if (predictions?.nextPeriodStart && profile.mode !== 'PREGNANCY') {
    cards.push({
      id: 'next_period',
      tone: 'energy',
      title:
        contraception?.bleedingLabel === 'bleeding'
          ? 'სავარაუდო შემდეგი სისხლდენა'
          : 'სავარაუდო შემდეგი მენსტრუაცია',
      body: nextPeriodEstimateBody(predictions.nextPeriodStart, flags),
      action: null,
    });
  }

  const filtered = contraceptionInsightsFilter(cards, contraception);

  return {
    headline:
      contraception?.predictionAvailability === 'LIMITED'
        ? 'აღრიცხვები და კონტრაცეფციის კონტექსტი'
        : phase.day != null
          ? `დღეს: სავარაუდო ${phase.phaseKa}`
          : 'თქვენი ციკლის რჩევები',
    phaseLabel:
      contraception?.predictionAvailability === 'LIMITED'
        ? contraception.presentation?.phaseLabelOverride || phase.phaseKa
        : phase.phaseKa,
    cards: filtered.slice(0, 7),
    source: 'local',
    generatedAt: new Date().toISOString(),
  };
}

const PMS_SYMPTOM_KEYS = new Set([
  'cramps',
  'headache',
  'bloating',
  'fatigue',
  'back_pain',
  'breast_tenderness',
  'breast_swelling',
  'nausea',
  'insomnia',
  'hot_flashes',
  'pelvic_pain',
  'anxious',
  'irritable',
  'sensitive',
  'sad',
  'mood_swings',
  'cravings',
]);

export function parseConditions(profile) {
  const raw = profile?.conditions;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return [];
}

export function buildCycleTrends({ profile, logs, inferred, averages, today }) {
  const periodStarts = inferred?.periodStarts ?? [];
  const cycleLengths = [];
  for (let i = 1; i < periodStarts.length; i += 1) {
    const gap = daysBetween(periodStarts[i - 1], periodStarts[i]);
    if (gap >= 18 && gap <= 45) {
      cycleLengths.push({ start: periodStarts[i], length: gap });
    }
  }

  const avgCycle =
    averages?.usedCycleLength ?? profile.avgCycleLength ?? DEFAULT_CYCLE_LENGTH;
  const lastPeriod = toDateKey(profile.lastPeriodStart) || inferred?.lastPeriodStart;
  const todayKey = today || todayInTimeZone();
  const pmsByDay = {};
  for (let d = 18; d <= 35; d += 1) pmsByDay[d] = { count: 0, symptoms: {} };

  for (const log of logs) {
    if (!lastPeriod) break;
    const offset = daysBetween(lastPeriod, log.date);
    if (offset < 0) continue;
    const cycleDay = ((offset % avgCycle) + 1);
    if (cycleDay < 18 || cycleDay > 35) continue;
    const symptoms = Array.isArray(log.symptoms) ? log.symptoms : [];
    const moods = Array.isArray(log.moods) ? log.moods : [];
    const hits = [...symptoms, ...moods].filter((k) => PMS_SYMPTOM_KEYS.has(k));
    if (!hits.length) continue;
    pmsByDay[cycleDay].count += 1;
    for (const k of hits) {
      pmsByDay[cycleDay].symptoms[k] = (pmsByDay[cycleDay].symptoms[k] || 0) + 1;
    }
  }

  const pmsSeries = Object.entries(pmsByDay)
    .map(([cycleDay, v]) => ({
      cycleDay: Number(cycleDay),
      count: v.count,
      topSymptoms: Object.entries(v.symptoms)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key, count]) => ({ key, count })),
    }))
    .filter((row) => row.count > 0);

  const symptomFreq = {};
  const cutoff = addDays(todayKey, -90);
  for (const log of logs) {
    if (log.date < cutoff) continue;
    for (const s of Array.isArray(log.symptoms) ? log.symptoms : []) {
      symptomFreq[s] = (symptomFreq[s] || 0) + 1;
    }
  }
  const topSymptoms90d = Object.entries(symptomFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => ({ key, count }));

  const bbtPoints = logs
    .filter((l) => l.bbt != null && Number.isFinite(l.bbt))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-60)
    .map((l) => ({ date: l.date, bbt: l.bbt }));

  const stats = cycleLengthStats(cycleLengths);
  return {
    cycleLengths,
    pmsByDay: pmsSeries,
    topSymptoms90d,
    bbtPoints,
    periodStarts,
    shortestCycle: stats.shortest,
    longestCycle: stats.longest,
    variability: stats.variability,
    cycleCount: stats.count,
    confidence: predictionConfidence({
      cycleCount: stats.count,
      isIrregular: profile.isIrregular,
    }),
  };
}

export function buildCycleAlerts({ profile, logs, predictions, inferred, today }) {
  const alerts = [];
  const todayKey = today || todayInTimeZone();
  const conditions = parseConditions(profile);

  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  let heavyRun = 0;
  for (const log of sorted) {
    if (log.flow === 'heavy') heavyRun += 1;
    else break;
  }
  if (heavyRun >= 8) {
    alerts.push({
      level: 'urgent',
      messageKa: '8+ დღეა ძლიერი გამონადენი აღრიცხულია — მიმართეთ გინეკოლოგს.',
      action: 'chat',
    });
  }

  const starts = inferred?.periodStarts ?? [];
  if (starts.length >= 2) {
    const lastGap = daysBetween(starts[starts.length - 2], starts[starts.length - 1]);
    if (lastGap > 35 || lastGap < 21) {
      alerts.push({
        level: profile.isIrregular ? 'warn' : 'info',
        messageKa: irregularLengthAlertKa(lastGap),
        action: 'chat',
      });
    }
  }

  if (profile.mode !== 'PREGNANCY' && sorted.length > 0) {
    const lastFlow = sorted.find((l) => isPeriodFlow(l.flow));
    if (lastFlow && daysBetween(lastFlow.date, todayKey) > 40) {
      alerts.push({
        level: 'warn',
        messageKa: latePeriodAlertKa(),
        action: 'chat',
      });
    }
  }

  if (conditions.includes('pcos')) {
    alerts.push({
      level: 'info',
      messageKa: pcosCautionKa(),
      action: null,
    });
  }

  if (conditions.includes('endometriosis')) {
    alerts.push({
      level: 'info',
      messageKa:
        'ენდომეტრიოზისას ტკივილი და სიმპტომები შეიძლება ციკლის გარეთაც გამოჩნდეს — აღრიცხეთ ყველა დღე.',
      action: null,
    });
  }

  return alerts.slice(0, 4);
}

export function buildCycleAiUserPrompt({ profile, logs, predictions, pregnancy, user, averages, today, contraception }) {
  const phase = detectCyclePhase({
    lastPeriodStart: toDateKey(profile.lastPeriodStart),
    avgCycleLength: averages?.usedCycleLength ?? profile.avgCycleLength,
    avgPeriodLength: averages?.usedPeriodLength ?? profile.avgPeriodLength,
    today: today || todayInTimeZone(),
  });
  const flags = cycleHonestyFlags({
    confidence: predictions?.confidence,
    isIrregular: profile.isIrregular,
    conditions: parseConditions(profile),
  });
  const contra =
    contraception ||
    interpretContraception({
      ...profile,
      contraceptionStartedAt: toDateKey(profile.contraceptionStartedAt),
    });
  const limited = contra.predictionAvailability === 'LIMITED';
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  const lines = recent.map((l) => {
    const sym = (l.symptoms || []).map((s) => SYMPTOM_KA[s] || s).join(', ') || '—';
    const mood = (l.moods || []).map((m) => SYMPTOM_KA[m] || m).join(', ') || '—';
    const extra = fertilityObservationBits(l);
    return `${l.date}: flow=${l.flow || 'none'}; სიმპტომები=${sym}; განწყობა=${mood}${extra.length ? `; ${extra.join('; ')}` : ''}`;
  });

  return [
    'USER_LOGGED:',
    `რეჟიმი: ${profile.mode}`,
    `ასაკი: ${user?.age ?? 'უცნობი'}`,
    lines.length ? 'ბოლო აღრიცხვები:' : 'ბოლო აღრიცხვები: —',
    ...lines,
    '',
    'ESTIMATED:',
    limited
      ? `ციკლის დღე: ${phase.day ?? '—'} · კალენდარული ფაზა არ არის ხაზგასასმელი (LIMITED)`
      : `ციკლის დღე: ${phase.day ?? '—'} · სავარაუდო ფაზა: ${phase.phaseKa}`,
    limited
      ? `სავარაუდო შემდეგი სისხლდენა: ${predictions?.nextPeriodStart ?? '—'}`
      : `სავარაუდო შემდეგი მენსტრუაცია: ${predictions?.nextPeriodStart ?? '—'}`,
    limited
      ? 'ოვულაცია / ნაყოფიერი ფანჯარა: ნუ ხაზს უსვამ — კონტრაცეფციის კონტექსტში შეიძლება შეცდომაში შემყვანი იყოს.'
      : `სავარაუდო ოვულაცია: ${predictions?.ovulationDate ?? '—'}`,
    limited
      ? null
      : predictions?.fertileWindow
        ? `სავარაუდო ნაყოფიერი ფანჯარა: ${predictions.fertileWindow.start} – ${predictions.fertileWindow.end}`
        : 'სავარაუდო ნაყოფიერი ფანჯარა: —',
    `სიზუსტე: ${flags.confidence}`,
    `არარეგულარული (მომხმარებლის მითითება): ${profile.isIrregular ? 'კი' : 'არა'}`,
    averages?.source ? `პროგნოზის წყარო: ${averages.source}` : null,
    `საშუალო ციკლი (შეფასება): ${averages?.usedCycleLength ?? profile.avgCycleLength} დღე, მენსტრუაცია: ${averages?.usedPeriodLength ?? profile.avgPeriodLength} დღე`,
    pregnancy?.age
      ? `ორსულობის რეჟიმი (მომხმარებლის მითითება): კვირა ${pregnancy.age.week}, დღე ${pregnancy.age.day}, ტრიმესტრი ${pregnancy.age.trimester}`
      : null,
    '',
    'CONDITIONS_SELF_REPORTED:',
    flags.conditions.length ? flags.conditions.join(', ') : '—',
    contra.method ? '' : null,
    contra.method ? 'CONTRACEPTION_SELF_REPORTED:' : null,
    contra.method ? `method: ${contra.method}` : null,
    contra.method ? `startedAt: ${contra.startedAt || 'unknown'}` : null,
    contra.method ? `predictionAvailability: ${contra.predictionAvailability}` : null,
    '',
    'HONESTY_RULES:',
    ...CYCLE_AI_HONESTY_RULES.map((rule) => `- ${rule}`),
    ...CYCLE_FERTILITY_AI_RULES.map((rule) => `- ${rule}`),
    ...CYCLE_CONTRACEPTION_AI_RULES.map((rule) => `- ${rule}`),
    '',
    'დააბრუნე მხოლოდ JSON რჩევების ბარათებით.',
  ]
    .filter((line) => line != null)
    .join('\n');
}

export function parseCycleInsightsJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const data = JSON.parse(text.slice(start, end + 1));
    if (!data || !Array.isArray(data.cards)) return null;
    const cards = data.cards
      .slice(0, 6)
      .map((card, i) => ({
        id: String(card.id || `tip_${i}`).slice(0, 40),
        tone: ['calm', 'energy', 'care', 'fertile', 'pregnancy', 'mood'].includes(card.tone)
          ? card.tone
          : 'calm',
        title: String(card.title || 'რჩევა').slice(0, 80),
        body: String(card.body || '').slice(0, 400),
        action: card.action ? String(card.action).slice(0, 80) : null,
      }))
      .filter((c) => c.body);
    if (!cards.length) return null;
    return {
      headline: String(data.headline || 'დღის რჩევები').slice(0, 100),
      phaseLabel: data.phaseLabel ? String(data.phaseLabel).slice(0, 60) : null,
      cards,
      source: 'ai',
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

