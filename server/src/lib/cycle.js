/**
 * Cycle prediction helpers — period, fertile window, ovulation.
 * Dates are calendar days as YYYY-MM-DD (no timezone math beyond that).
 */

export function toDateKey(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
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

/** Infer average cycle length from period-start logs (flow days). */
export function inferCycleStats(logs, fallbackCycle = 28, fallbackPeriod = 5) {
  const periodStarts = [];
  const sorted = [...logs].sort((x, y) => x.date.localeCompare(y.date));
  let prevWasFlow = false;
  for (const log of sorted) {
    const hasFlow = Boolean(log.flow && log.flow !== 'none');
    if (hasFlow && !prevWasFlow) periodStarts.push(log.date);
    prevWasFlow = hasFlow;
  }

  const gaps = [];
  for (let i = 1; i < periodStarts.length; i += 1) {
    const gap = daysBetween(periodStarts[i - 1], periodStarts[i]);
    if (gap >= 18 && gap <= 45) gaps.push(gap);
  }

  const avgCycle =
    gaps.length >= 2
      ? Math.round(gaps.reduce((s, n) => s + n, 0) / gaps.length)
      : fallbackCycle;

  let periodLengths = [];
  let run = 0;
  prevWasFlow = false;
  for (const log of sorted) {
    const hasFlow = Boolean(log.flow && log.flow !== 'none');
    if (hasFlow) {
      run += 1;
    } else if (prevWasFlow && run > 0) {
      periodLengths.push(run);
      run = 0;
    }
    prevWasFlow = hasFlow;
  }
  if (run > 0) periodLengths.push(run);
  periodLengths = periodLengths.filter((n) => n >= 2 && n <= 10);
  const avgPeriod =
    periodLengths.length >= 1
      ? Math.round(periodLengths.reduce((s, n) => s + n, 0) / periodLengths.length)
      : fallbackPeriod;

  return {
    avgCycleLength: Math.min(45, Math.max(21, avgCycle)),
    avgPeriodLength: Math.min(10, Math.max(2, avgPeriod)),
    periodStarts,
    lastPeriodStart: periodStarts[periodStarts.length - 1] ?? null,
  };
}

/**
 * Build predictions from last period start + averages.
 * Fertile window ≈ ovulation −5 … ovulation +1; ovulation ≈ cycleLength − 14.
 */
export function buildPredictions({
  lastPeriodStart,
  avgCycleLength = 28,
  avgPeriodLength = 5,
  horizonDays = 90,
}) {
  if (!lastPeriodStart) {
    return {
      nextPeriodStart: null,
      nextPeriodEnd: null,
      ovulationDate: null,
      fertileWindow: null,
      phases: [],
      calendar: {},
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
      calendar[key] = { ...(calendar[key] || {}), period: true, predicted: cycle > 0 || i > 0 };
    }
    for (let i = 0; i <= daysBetween(fertileStart, fertileEnd); i += 1) {
      const key = addDays(fertileStart, i);
      calendar[key] = { ...(calendar[key] || {}), fertile: true };
    }
    calendar[ovulation] = { ...(calendar[ovulation] || {}), ovulation: true, fertile: true };

    start = nextStart;
    if (daysBetween(lastPeriodStart, start) > horizonDays) break;
  }

  const upcoming = phases.find((p) => p.periodStart >= lastPeriodStart) || phases[0];
  const next = phases.find((p) => p.periodStart > lastPeriodStart) || phases[1] || upcoming;

  return {
    nextPeriodStart: next?.periodStart ?? null,
    nextPeriodEnd: next?.periodEnd ?? null,
    ovulationDate: upcoming?.ovulation ?? null,
    fertileWindow: upcoming
      ? { start: upcoming.fertileStart, end: upcoming.fertileEnd }
      : null,
    phases,
    calendar,
  };
}

export function gestationalAge(dueDateKey, todayKey = toDateKey(new Date())) {
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
  const flowDays = logs.filter((l) => l.flow && l.flow !== 'none');
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
    topSymptoms,
    topMoods,
    generatedAt: new Date().toISOString(),
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
  avgCycleLength = 28,
  avgPeriodLength = 5,
  today = toDateKey(new Date()),
}) {
  if (!lastPeriodStart) return { day: null, phase: 'unknown', phaseKa: 'უცნობი ფაზა' };
  const day = daysBetween(lastPeriodStart, today) + 1;
  if (day < 1) return { day: null, phase: 'unknown', phaseKa: 'უცნობი ფაზა' };
  const cycleDay = ((day - 1) % avgCycleLength) + 1;
  const ovulation = avgCycleLength - 14;
  if (cycleDay <= avgPeriodLength) {
    return { day: cycleDay, phase: 'period', phaseKa: 'მენსტრუაცია' };
  }
  if (cycleDay >= ovulation - 5 && cycleDay <= ovulation + 1) {
    return {
      day: cycleDay,
      phase: cycleDay === ovulation ? 'ovulation' : 'fertile',
      phaseKa: cycleDay === ovulation ? 'ოვულაცია' : 'ნაყოფიერი ფანჯარა',
    };
  }
  if (cycleDay > ovulation + 1) {
    return { day: cycleDay, phase: 'luteal', phaseKa: 'ლუთეალური ფაზა' };
  }
  return { day: cycleDay, phase: 'follicular', phaseKa: 'ფოლიკულური ფაზა' };
}

/** Instant Flo-like tips (no AI) — shown while / as fallback to EvidenceMD. */
export function buildLocalInsights({ profile, logs, predictions, pregnancy }) {
  const phase = detectCyclePhase({
    lastPeriodStart: toDateKey(profile.lastPeriodStart),
    avgCycleLength: profile.avgCycleLength,
    avgPeriodLength: profile.avgPeriodLength,
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
        ? `დღეს ციკლის ${phase.day}-ე დღეა (${phase.phaseKa}). მოუსმინეთ სხეულს და აღრიცხეთ სიმპტომები.`
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
  if (profile.mode === 'TRY_TO_CONCEIVE' && predictions?.fertileWindow) {
    cards.push({
      id: 'ttc_window',
      tone: 'fertile',
      title: 'ნაყოფიერი ფანჯარა',
      body: `თქვენი ნაყოფიერი პერიოდი დაახლოებით ${predictions.fertileWindow.start} – ${predictions.fertileWindow.end}. ოვულაცია: ${predictions.ovulationDate ?? '—'}.`,
      action: 'აღრიცხე BBT ან ლორწო',
    });
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
      title: 'შემდეგი მენსტრუაცია',
      body: `პროგნოზი: ${predictions.nextPeriodStart}. წინასწარ მოამზადეთ საშუალებები და შეამცირეთ სტრესი.`,
      action: null,
    });
  }

  return {
    headline: phase.day != null ? `დღეს: ${phase.phaseKa}` : 'თქვენი ციკლის რჩევები',
    phaseLabel: phase.phaseKa,
    cards: cards.slice(0, 5),
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

export function buildCycleTrends({ profile, logs, inferred }) {
  const periodStarts = inferred?.periodStarts ?? [];
  const cycleLengths = [];
  for (let i = 1; i < periodStarts.length; i += 1) {
    const gap = daysBetween(periodStarts[i - 1], periodStarts[i]);
    if (gap >= 18 && gap <= 45) {
      cycleLengths.push({ start: periodStarts[i], length: gap });
    }
  }

  const avgCycle = profile.avgCycleLength || inferred?.avgCycleLength || 28;
  const lastPeriod = toDateKey(profile.lastPeriodStart) || inferred?.lastPeriodStart;
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
  const cutoff = addDays(toDateKey(new Date()), -90);
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

  return {
    cycleLengths,
    pmsByDay: pmsSeries,
    topSymptoms90d,
    bbtPoints,
    periodStarts,
  };
}

export function buildCycleAlerts({ profile, logs, predictions, inferred }) {
  const alerts = [];
  const today = toDateKey(new Date());
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
        messageKa: `ბოლო ციკლის სიგრძე ${lastGap} დღეა — ნორმალურია 21–35 დღე. გირჩევთ ექიმთან კონსულტაციას.`,
        action: 'chat',
      });
    }
  }

  if (profile.mode !== 'PREGNANCY' && sorted.length > 0) {
    const lastFlow = sorted.find((l) => l.flow && l.flow !== 'none');
    if (lastFlow && daysBetween(lastFlow.date, today) > 40) {
      alerts.push({
        level: 'warn',
        messageKa: '40+ დღეა მენსტრუაცია არ არის აღრიცხული — გამორიცხეთ ორსულობა ან მიმართეთ ექიმს.',
        action: 'chat',
      });
    }
  }

  if (conditions.includes('pcos') && profile.isIrregular) {
    alerts.push({
      level: 'info',
      messageKa:
        'PCOS და არარეგულარული ციკლი — ნაყოფიერი ფანჯარა შეიძლება უფრო ხანგრძლივი იყოს. პროგნოზები დაახლოებითია.',
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

export function buildCycleAiUserPrompt({ profile, logs, predictions, pregnancy, user }) {
  const phase = detectCyclePhase({
    lastPeriodStart: toDateKey(profile.lastPeriodStart),
    avgCycleLength: profile.avgCycleLength,
    avgPeriodLength: profile.avgPeriodLength,
  });
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  const lines = recent.map((l) => {
    const sym = (l.symptoms || []).map((s) => SYMPTOM_KA[s] || s).join(', ') || '—';
    const mood = (l.moods || []).map((m) => SYMPTOM_KA[m] || m).join(', ') || '—';
    return `${l.date}: flow=${l.flow || 'none'}; სიმპტომები=${sym}; განწყობა=${mood}`;
  });

  const conditions = parseConditions(profile);

  return [
    `რეჟიმი: ${profile.mode}`,
    `ასაკი: ${user?.age ?? 'უცნობი'}`,
    `საშუალო ციკლი: ${profile.avgCycleLength} დღე, მენსტრუაცია: ${profile.avgPeriodLength} დღე`,
    `არარეგულარული: ${profile.isIrregular ? 'კი' : 'არა'}`,
    conditions.length ? `ჯანმრთელობის კონტექსტი: ${conditions.join(', ')}` : null,
    `ციკლის დღე: ${phase.day ?? '—'} · ფაზა: ${phase.phaseKa}`,
    `შემდეგი მენსტრუაცია: ${predictions?.nextPeriodStart ?? '—'}`,
    `ოვულაცია: ${predictions?.ovulationDate ?? '—'}`,
    predictions?.fertileWindow
      ? `ნაყოფიერი ფანჯარა: ${predictions.fertileWindow.start} – ${predictions.fertileWindow.end}`
      : null,
    pregnancy?.age
      ? `ორსულობა: კვირა ${pregnancy.age.week}, დღე ${pregnancy.age.day}, ტრიმესტრი ${pregnancy.age.trimester}`
      : null,
    'ბოლო აღრიცხვები:',
    ...lines,
    'დააბრუნე მხოლოდ JSON რჩევების ბარათებით.',
  ]
    .filter(Boolean)
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

