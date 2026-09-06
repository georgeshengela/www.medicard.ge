/** Product analytics calendar is Asia/Tbilisi (same as DailyCheckIn). Georgia has no DST. */
export const ANALYTICS_TZ = 'Asia/Tbilisi';
export const TBILISI_OFFSET = '+04:00';
export const MIN_DELTA_BASE = 3;

export function tbilisiYmd(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ANALYTICS_TZ }).format(now);
}

export function ymdToUtcDate(ymd) {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function tbilisiMidnight(ymd) {
  return new Date(`${ymd}T00:00:00${TBILISI_OFFSET}`);
}

export function addDaysYmd(ymd, days) {
  const date = ymdToUtcDate(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function enumerateYmds(fromYmd, toYmd) {
  const days = [];
  let cursor = fromYmd;
  while (cursor <= toYmd) {
    days.push(cursor);
    cursor = addDaysYmd(cursor, 1);
    if (days.length > 400) break;
  }
  return days;
}

export function mondayOfWeek(ymd) {
  const date = ymdToUtcDate(ymd);
  const dow = date.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDaysYmd(ymd, offset);
}

const PRESETS = new Set(['today', '7d', '30d', '90d', 'custom']);

/**
 * Inclusive Tbilisi calendar range + previous equivalent window.
 * DateTime bounds use Tbilisi midnight so createdAt queries match product days.
 */
export function parseAnalyticsRange(query = {}, now = new Date()) {
  const today = tbilisiYmd(now);
  let preset = String(query.range || '7d').toLowerCase();
  if (!PRESETS.has(preset)) preset = '7d';

  let toYmd = today;
  let fromYmd = addDaysYmd(today, -6);

  if (preset === 'today') {
    fromYmd = today;
    toYmd = today;
  } else if (preset === '7d') {
    fromYmd = addDaysYmd(today, -6);
    toYmd = today;
  } else if (preset === '30d') {
    fromYmd = addDaysYmd(today, -29);
    toYmd = today;
  } else if (preset === '90d') {
    fromYmd = addDaysYmd(today, -89);
    toYmd = today;
  } else {
    const fromRaw = String(query.from || '').slice(0, 10);
    const toRaw = String(query.to || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
      const err = new Error('custom range requires from and to as YYYY-MM-DD');
      err.status = 400;
      throw err;
    }
    fromYmd = fromRaw;
    toYmd = toRaw;
    if (fromYmd > toYmd) {
      const err = new Error('from must be on or before to');
      err.status = 400;
      throw err;
    }
    const span = enumerateYmds(fromYmd, toYmd).length;
    if (span > 366) {
      const err = new Error('custom range cannot exceed 366 days');
      err.status = 400;
      throw err;
    }
  }

  const days = enumerateYmds(fromYmd, toYmd);
  const dayCount = days.length;
  const prevToYmd = addDaysYmd(fromYmd, -1);
  const prevFromYmd = addDaysYmd(prevToYmd, -(dayCount - 1));

  const labels = {
    today: 'დღეს',
    '7d': '7 დღე',
    '30d': '30 დღე',
    '90d': '90 დღე',
    custom: `${fromYmd} → ${toYmd}`,
  };

  return {
    preset,
    timezone: ANALYTICS_TZ,
    fromYmd,
    toYmd,
    prevFromYmd,
    prevToYmd,
    days,
    dayCount,
    from: ymdToUtcDate(fromYmd),
    to: ymdToUtcDate(toYmd),
    prevFrom: ymdToUtcDate(prevFromYmd),
    prevTo: ymdToUtcDate(prevToYmd),
    fromDt: tbilisiMidnight(fromYmd),
    toExclusiveDt: tbilisiMidnight(addDaysYmd(toYmd, 1)),
    prevFromDt: tbilisiMidnight(prevFromYmd),
    prevToExclusiveDt: tbilisiMidnight(fromYmd),
    label: labels[preset] || labels.custom,
    today,
  };
}

/** Hide noisy % when both sides are too small to mean anything. */
export function deltaSafe(current, previous, { minPrev = MIN_DELTA_BASE } = {}) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev < minPrev && cur < minPrev) {
    return { current: cur, previous: prev, abs: null, pct: null, show: false };
  }
  const abs = cur - prev;
  const pct = prev > 0 ? Math.round((abs / prev) * 1000) / 10 : null;
  return { current: cur, previous: prev, abs, pct, show: true };
}

export function rateSafe(numerator, denominator) {
  const n = Number(numerator) || 0;
  const d = Number(denominator) || 0;
  if (d <= 0) return null;
  return Math.round((n / d) * 1000) / 10;
}

export function emptyDaySeries(days) {
  return days.map((day) => ({ day, count: 0 }));
}

export function fillDaySeries(days, rows, keyFn, countFn = () => 1) {
  const map = new Map(days.map((day) => [day, 0]));
  for (const row of rows) {
    const day = keyFn(row);
    if (day && map.has(day)) map.set(day, (map.get(day) || 0) + countFn(row));
  }
  return [...map.entries()].map(([day, count]) => ({ day, count }));
}

export function createdAtToTbilisiYmd(value) {
  if (!value) return null;
  return tbilisiYmd(value instanceof Date ? value : new Date(value));
}

export const METRIC_DEFINITIONS = {
  totalUsers: 'ყველა რეგისტრირებული User ჩანაწერი (არჩეული პერიოდით არ იფილტრება).',
  activeToday: 'უნიკალური მომხმარებლები AppActivity-ით თბილისის დღეს. DailyCheckIn არის შესვლის ბონუსი და DAU არ არის.',
  wau: 'უნიკალური მომხმარებლები AppActivity-ით ბოლო 7 თბილისის დღეში.',
  mau: 'უნიკალური მომხმარებლები AppActivity-ით ბოლო 30 თბილისის დღეში.',
  newUsers: 'User.createdAt არჩეულ თბილისის პერიოდში.',
  mediConversations: 'ChatSession ჩანაწერები, რომლებიც შეიქმნა არჩეულ პერიოდში.',
  healthLogs: 'ჰიდრატაციის დღეები (hydrationMl>0), წონის დღეები, ციკლის ჩანაწერები, შექმნილი ვიზიტები და მედიკამენტის გრაფიკები პერიოდში.',
  notificationsDelivered: 'PushEvent ჩანაწერები პერიოდში პლუს PushCampaign.sentCount იმავე პერიოდში გაგზავნილი კამპანიებისთვის.',
  dauSeries: 'უნიკალური AppActivity მომხმარებლები თბილისის თითოეულ დღეზე.',
  retentionD1: 'რეგისტრაციის დღიდან +1-ზე აქტიური (AppActivity, ისტორიისთვის DailyCheckIn).',
};

export function dateOnlyYmd(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return createdAtToTbilisiYmd(value);
}
