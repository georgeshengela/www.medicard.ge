/**
 * Browser + Node pregnancy / cycle calculators.
 * Civil dates only (YYYY-MM-DD). No PII leaves the page.
 */

export const KA_MONTHS = [
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
];

export const KA_WEEKDAYS = [
  'კვირა',
  'ორშაბათი',
  'სამშაბათი',
  'ოთხშაბათი',
  'ხუთშაბათი',
  'პარასკევი',
  'შაბათი',
];

/** Monday-first, matching Georgian calendars. */
export const KA_WEEKDAYS_MON_SHORT = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'];

const DAY_MS = 86400000;
const TERM_DAYS = 280;
const LUTEAL_DAYS = 14;
const CONCEPTION_OFFSET = 266;

export const HCG_RANGES = [
  { week: 3, min: 5, max: 50 },
  { week: 4, min: 5, max: 426 },
  { week: 5, min: 18, max: 7340 },
  { week: 6, min: 1080, max: 56500 },
  { week: 7, min: 7650, max: 229000 },
  { week: 8, min: 7650, max: 229000 },
  { week: 9, min: 25700, max: 288000 },
  { week: 10, min: 25700, max: 288000 },
  { week: 11, min: 25700, max: 288000 },
  { week: 12, min: 25700, max: 288000 },
  { week: 13, min: 13300, max: 254000 },
  { week: 16, min: 13300, max: 254000 },
  { week: 20, min: 4060, max: 165400 },
  { week: 28, min: 3640, max: 117000 },
];

const MONTH_FROM_WEEK = [
  [1, 1, 4],
  [2, 5, 8],
  [3, 9, 13],
  [4, 14, 17],
  [5, 18, 22],
  [6, 23, 27],
  [7, 28, 31],
  [8, 32, 35],
  [9, 36, 42],
];

export function isYmd(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function utcFromYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function ymdFromUtc(ms) {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(ymd, days) {
  return ymdFromUtc(utcFromYmd(ymd) + days * DAY_MS);
}

export function daysBetween(a, b) {
  return Math.round((utcFromYmd(b) - utcFromYmd(a)) / DAY_MS);
}

export function todayYmd(now = new Date(), timeZone = 'Asia/Tbilisi') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function formatKa(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${KA_WEEKDAYS[weekday]}, ${d} ${KA_MONTHS[m - 1]}, ${y}`;
}

export function formatKaParts(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return {
    weekday: KA_WEEKDAYS[weekday],
    date: `${d} ${KA_MONTHS[m - 1]}, ${y}`,
  };
}

export function ymdParts(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toYmd(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** 42 cells, week starts Monday. */
export function calendarMonthCells(year, month) {
  const first = toYmd(year, month, 1);
  const sundayIndex = new Date(utcFromYmd(first)).getUTCDay();
  const mondayOffset = (sundayIndex + 6) % 7;
  const start = addDays(first, -mondayOffset);
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = addDays(start, i);
    const parts = ymdParts(date);
    cells.push({
      date,
      day: parts.d,
      inMonth: parts.m === month && parts.y === year,
      weekend: i % 7 >= 5,
    });
  }
  return cells;
}

export function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function ovulationDayIndex(cycleLength) {
  return clampInt(cycleLength, 21, 45, 28) - LUTEAL_DAYS;
}

export function estimateOvulation(lmp, cycleLength = 28) {
  const length = clampInt(cycleLength, 21, 45, 28);
  const ovulation = addDays(lmp, ovulationDayIndex(length));
  return {
    cycleLength: length,
    ovulation,
    fertileStart: addDays(ovulation, -5),
    fertileEnd: addDays(ovulation, 1),
    nextPeriod: addDays(lmp, length),
  };
}

export function periodForecast(lmp, cycleLength = 28, periodLength = 5, cycles = 6) {
  const length = clampInt(cycleLength, 21, 45, 28);
  const bleed = clampInt(periodLength, 2, 10, 5);
  const list = [];
  let start = lmp;
  for (let i = 0; i < cycles; i += 1) {
    const end = addDays(start, bleed - 1);
    list.push({ start, end, cycle: i + 1 });
    start = addDays(start, length);
  }
  return { cycleLength: length, periodLength: bleed, cycles: list, next: list[1] || null };
}

export function menstrualCycle(lmp, cycleLength = 28, periodLength = 5, today = todayYmd()) {
  const ov = estimateOvulation(lmp, cycleLength);
  const bleed = clampInt(periodLength, 2, 10, 5);
  const day = daysBetween(lmp, today) + 1;
  let phase = 'follicular';
  let phaseKa = 'ფოლიკულური ფაზა';
  if (day >= 1 && day <= bleed) {
    phase = 'period';
    phaseKa = 'მენსტრუაცია';
  } else if (today === ov.ovulation) {
    phase = 'ovulation';
    phaseKa = 'ოვულაცია';
  } else if (today >= ov.fertileStart && today <= ov.fertileEnd) {
    phase = 'fertile';
    phaseKa = 'ნაყოფიერი ფანჯარა';
  } else if (today > ov.ovulation) {
    phase = 'luteal';
    phaseKa = 'ლუთეალური ფაზა';
  }
  return {
    ...ov,
    periodLength: bleed,
    periodEnd: addDays(lmp, bleed - 1),
    cycleDay: day,
    inCycle: day >= 1 && day <= ov.cycleLength,
    phase,
    phaseKa,
    today,
  };
}

export function pregnancyTestWindow({ mode, date, cycleLength = 28 }) {
  const ov =
    mode === 'ovulation'
      ? {
          ovulation: date,
          cycleLength: clampInt(cycleLength, 21, 45, 28),
          nextPeriod: addDays(date, LUTEAL_DAYS),
        }
      : estimateOvulation(date, cycleLength);
  const earliest = addDays(ov.ovulation, 10);
  const recommended = ov.nextPeriod;
  const mostAccurate = addDays(recommended, 7);
  return {
    ovulation: ov.ovulation,
    nextPeriod: ov.nextPeriod,
    earliest,
    recommended,
    mostAccurate,
    twoWeekWait: addDays(ov.ovulation, 14),
  };
}

export function implantationWindow({ mode, date, cycleLength = 28 }) {
  const ovulation = mode === 'ovulation' ? date : estimateOvulation(date, cycleLength).ovulation;
  return {
    ovulation,
    start: addDays(ovulation, 6),
    end: addDays(ovulation, 10),
    testFrom: addDays(ovulation, 14),
  };
}

export function pregnancyMonthFromWeek(weeks) {
  const w = clampInt(weeks, 1, 42, 1);
  const row = MONTH_FROM_WEEK.find(([, from, to]) => w >= from && w <= to);
  return row ? row[0] : 9;
}

export function trimesterFromWeek(weeks) {
  const w = clampInt(weeks, 1, 42, 1);
  if (w <= 13) return 1;
  if (w <= 27) return 2;
  return 3;
}

export function weeksToMonths(weeks, days = 0) {
  const w = clampInt(weeks, 1, 42, 1);
  const d = clampInt(days, 0, 6, 0);
  const month = pregnancyMonthFromWeek(w);
  const trimester = trimesterFromWeek(w);
  const remaining = Math.max(0, TERM_DAYS - (w * 7 + d));
  return {
    weeks: w,
    days: d,
    month,
    trimester,
    remainingDays: remaining,
    remainingWeeks: Math.floor(remaining / 7),
    chart: MONTH_FROM_WEEK.map(([monthN, from, to]) => ({
      month: monthN,
      from,
      to,
      active: monthN === month,
    })),
  };
}

export function gestationalAge(fromYmd, today = todayYmd()) {
  const total = Math.max(0, daysBetween(fromYmd, today));
  return {
    totalDays: total,
    weeks: Math.floor(total / 7),
    days: total % 7,
  };
}

export function dueDateFromLmp(lmp, cycleLength = 28, today = todayYmd()) {
  const length = clampInt(cycleLength, 21, 45, 28);
  const edd = addDays(lmp, TERM_DAYS + (length - 28));
  const ga = gestationalAge(lmp, today);
  return {
    lmp,
    cycleLength: length,
    edd,
    conceptionEstimate: addDays(lmp, length - LUTEAL_DAYS),
    gestationalAge: ga,
    month: pregnancyMonthFromWeek(Math.max(1, ga.weeks || 1)),
    trimester: trimesterFromWeek(Math.max(1, ga.weeks || 1)),
  };
}

export const IVF_TYPES = {
  retrieval: { age: 0, label: 'კვერცხუჯრედის აღება' },
  day3: { age: 3, label: '3-დღიანი ემბრიონი' },
  day5: { age: 5, label: '5-დღიანი ბლასტოცისტი' },
  day6: { age: 6, label: '6-დღიანი ბლასტოცისტი' },
};

export function dueDateFromIvf(transferDate, type = 'day5', today = todayYmd()) {
  const spec = IVF_TYPES[type] || IVF_TYPES.day5;
  const edd = addDays(transferDate, CONCEPTION_OFFSET - spec.age);
  const lmpEquivalent = addDays(edd, -TERM_DAYS);
  const ga = gestationalAge(lmpEquivalent, today);
  return {
    transferDate,
    type,
    embryoAge: spec.age,
    edd,
    lmpEquivalent,
    gestationalAge: ga,
    month: pregnancyMonthFromWeek(Math.max(1, ga.weeks || 1)),
    trimester: trimesterFromWeek(Math.max(1, ga.weeks || 1)),
  };
}

export function dueDateFromUltrasound(scanDate, weeks, days = 0, today = todayYmd()) {
  const w = clampInt(weeks, 4, 42, 8);
  const d = clampInt(days, 0, 6, 0);
  const gaAtScan = w * 7 + d;
  const edd = addDays(scanDate, TERM_DAYS - gaAtScan);
  const lmpEquivalent = addDays(edd, -TERM_DAYS);
  const ga = gestationalAge(lmpEquivalent, today);
  return {
    scanDate,
    weeksAtScan: w,
    daysAtScan: d,
    edd,
    lmpEquivalent,
    gestationalAge: ga,
    month: pregnancyMonthFromWeek(Math.max(1, ga.weeks || 1)),
    trimester: trimesterFromWeek(Math.max(1, ga.weeks || 1)),
  };
}

export function hcgDoubling({ date1, value1, date2, value2 }) {
  const v1 = Number(value1);
  const v2 = Number(value2);
  const hours = daysBetween(date1, date2) * 24;
  if (!(v1 > 0) || !(v2 > 0) || hours <= 0) return { ok: false };
  const ratio = v2 / v1;
  const doublingHours = hours * Math.LN2 / Math.log(ratio);
  let band = 'typical';
  if (v2 < v1) band = 'falling';
  else if (doublingHours < 36) band = 'fast';
  else if (doublingHours <= 72) band = 'typical';
  else if (doublingHours <= 96) band = 'slow';
  else band = 'very-slow';
  return {
    ok: true,
    hours,
    days: hours / 24,
    ratio,
    doublingHours,
    doublingDays: doublingHours / 24,
    band,
    next48: v2 * 2 ** (48 / doublingHours),
    next72: v2 * 2 ** (72 / doublingHours),
  };
}

export function hcgRangeForWeek(weeks) {
  const w = clampInt(weeks, 3, 40, 4);
  let best = HCG_RANGES[0];
  for (const row of HCG_RANGES) {
    if (w >= row.week) best = row;
  }
  return best;
}

export function cycleStrip(lmp, cycleLength = 28, periodLength = 5) {
  const length = clampInt(cycleLength, 21, 45, 28);
  const bleed = clampInt(periodLength, 2, 10, 5);
  const ov = estimateOvulation(lmp, length);
  const days = [];
  for (let i = 1; i <= length; i += 1) {
    const date = addDays(lmp, i - 1);
    let kind = 'rest';
    if (i <= bleed) kind = 'period';
    else if (date === ov.ovulation) kind = 'ovulation';
    else if (date >= ov.fertileStart && date <= ov.fertileEnd) kind = 'fertile';
    days.push({ day: i, date, kind });
  }
  return days;
}
