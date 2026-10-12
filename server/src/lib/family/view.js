// Assembles what the app shows about one child (the child page, the list, Medi's record, reminders).
// Pure functions over rows already loaded by store.js, so tests can run without a database.
import { ageLabel, ageStage, correctedAgeDays, daysBetween, isPreterm, toYmd } from './age.js';
import { INDICATORS, chartWindow, growthCurves, growthNote, growthTrend, scoreMeasurement } from './growth.js';
import { feedingGuide, foodList, milestoneGuide, monthNote, stageTips } from './guide.js';
import { buildGeSchedule, extraMeta, isCalendarDoseId, summarizeSchedule, vaccineMeta, vaccineNote } from './vaccinesGe.js';
import { publicDose, publicHealthItem, publicLog, publicMeasurement, publicMember } from './store.js';

const pick = (pair, lang) => (pair ? pair[lang === 'en' ? 'en' : 'ka'] : null);

export function ageInfo(member, todayYmd, lang = 'ka') {
  const birth = toYmd(member.birthDate);
  const days = Math.max(0, daysBetween(birth, todayYmd));
  const corrected = correctedAgeDays(days, member.gestationWeeks);
  return {
    days,
    correctedDays: corrected,
    preterm: isPreterm(member.gestationWeeks),
    label: ageLabel(birth, todayYmd, lang),
    // The corrected label is shown only while it differs (preterm, under two years).
    correctedLabel: corrected !== days ? ageLabel(birth, addDaysSafe(birth, todayYmd, days - corrected), lang) : null,
    stage: ageStage(corrected),
    months: Math.floor(days / 30.4375),
    isBirthdayMonth: monthBirthday(birth, todayYmd),
  };
}

function addDaysSafe(birth, todayYmd, shift) {
  const ms = Date.parse(`${todayYmd}T00:00:00Z`) - shift * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** 1–24 when today is the child's month-birthday (same day of the month), else null. */
export function monthBirthday(birthYmd, todayYmd) {
  const [by, bm, bd] = birthYmd.split('-').map(Number);
  const [ty, tm, td] = todayYmd.split('-').map(Number);
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  if (td !== Math.min(bd, lastDay)) return null;
  const months = (ty - by) * 12 + (tm - bm);
  return months >= 1 && months <= 24 ? months : null;
}

/** Vaccine calendar items with names in the person's language. */
export function vaccineView(member, doseRows, todayYmd, lang = 'ka') {
  const birth = toYmd(member.birthDate);
  const calendarRows = doseRows.filter((r) => isCalendarDoseId(`${r.code}-${r.dose}`));
  const items = buildGeSchedule({ birthYmd: birth, todayYmd, records: calendarRows });
  const named = items.map((item) => {
    const meta = vaccineMeta(item.code);
    return {
      ...item,
      abbr: pick(meta?.abbr, lang),
      name: pick(meta?.name, lang),
      protects: pick(meta?.protects, lang),
      noteText: item.note ? vaccineNote(item.note, lang) : null,
      warningText: item.warning ? vaccineNote(item.warning, lang) : null,
      daysFromToday: daysBetween(todayYmd, item.dueOn),
    };
  });
  const extras = doseRows
    .filter((r) => String(r.code).startsWith('x:'))
    .map((r) => {
      const code = String(r.code).slice(2);
      return { ...publicDose(r), extraCode: code, name: pick(extraMeta(code)?.name, lang) || r.note || code };
    })
    .sort((a, b) => String(b.givenOn || '').localeCompare(String(a.givenOn || '')));
  return { items: named, summary: summarizeSchedule(items, todayYmd), extras };
}

/** Growth: points per indicator with WHO scores, chart curves for the child's window, latest values. */
export function growthView(member, measurementRows, todayYmd, lang = 'ka', { curves = true } = {}) {
  const birth = toYmd(member.birthDate);
  const age = ageInfo(member, todayYmd, lang);
  const measurements = measurementRows.map(publicMeasurement);
  const scored = measurements.map((m) => ({ m, s: scoreMeasurement({ birthYmd: birth, sex: member.sex, gestationWeeks: member.gestationWeeks, ...m }) }));
  const indicators = {};
  for (const indicator of INDICATORS) {
    const points = scored
      .filter(({ s }) => s.entries[indicator])
      .map(({ m, s }) => ({ id: m.id, on: m.measuredOn, ageDays: s.ageDays, ...s.entries[indicator], note: growthNote(s.entries[indicator].status, lang) }));
    const window = chartWindow(indicator, Math.max(age.correctedDays, points.at(-1)?.ageDays ?? 0));
    if (!points.length && !window) continue;
    indicators[indicator] = {
      points,
      latest: points.at(-1) || null,
      trend: growthTrend(points),
      window,
      curves: curves && window ? growthCurves(indicator, member.sex, window) : null,
    };
  }
  const last = measurements.at(-1) || null;
  return {
    measurements: [...measurements].reverse(),
    indicators,
    last,
    daysSinceLast: last ? daysBetween(last.measuredOn, todayYmd) : null,
    // Typical check rhythm: monthly in the first year, every 3 months to 3 years, then yearly.
    dueForCheck: !last || daysBetween(last.measuredOn, todayYmd) > (age.days < 365 ? 35 : age.days < 1095 ? 95 : 370),
  };
}

const FEVER_C = 38;

/** Sick-day picture from the day log: temperatures, symptoms, medicines in the last days. */
export function sickDayView(logRows, nowMs = Date.now()) {
  const logs = logRows.map(publicLog);
  const since = (h) => logs.filter((l) => nowMs - new Date(l.at).getTime() <= h * 3600000);
  const temps = since(72).filter((l) => l.kind === 'TEMP' && Number(l.data?.c) > 0).map((l) => ({ c: Number(l.data.c), at: l.at, site: l.data.site || null }));
  const feverTimes = logs.filter((l) => l.kind === 'TEMP' && Number(l.data?.c) >= FEVER_C).map((l) => new Date(l.at).getTime());
  // Length of the current fever stretch: from the first fever reading with no 48 h gap before the latest.
  let feverDays = 0;
  if (feverTimes.length) {
    const sorted = [...feverTimes].sort((a, b) => b - a);
    let start = sorted[0];
    for (const t of sorted.slice(1)) { if (start - t <= 48 * 3600000) start = t; else break; }
    if (nowMs - sorted[0] <= 48 * 3600000) feverDays = Math.ceil((sorted[0] - start) / 86400000) + 1;
  }
  return {
    temps,
    lastTemp: temps[0] || null,
    feverDays,
    symptoms: since(72).filter((l) => l.kind === 'SYMPTOM'),
    meds: since(72).filter((l) => l.kind === 'MED'),
    active: temps.some((t) => t.c >= FEVER_C) || since(48).some((l) => l.kind === 'SYMPTOM'),
  };
}

/** Feeds today (from the day log), for babies. */
export function feedingToday(logRows, todayStartMs) {
  const feeds = logRows.map(publicLog).filter((l) => l.kind === 'FEED' && new Date(l.at).getTime() >= todayStartMs);
  const ml = feeds.reduce((s, l) => s + (Number(l.data?.ml) || 0), 0);
  const breastMin = feeds.reduce((s, l) => s + (l.data?.type === 'BREAST' ? Number(l.data?.minutes) || 0 : 0), 0);
  const last = feeds[0] || null;
  return { count: feeds.length, ml, breastMinutes: breastMin, last, lastSide: feeds.find((f) => f.data?.type === 'BREAST')?.data?.side || null };
}

/**
 * The hero's one answer, in priority order: fever now → overdue vaccine → vaccine due now / within a week →
 * month-birthday note → growth check due → the stage's first tip.
 */
export function heroAnswer({ member, age, vaccines, growth, sick, lang = 'ka' }) {
  const t = (ka, en) => (lang === 'en' ? en : ka);
  if (sick?.lastTemp && sick.lastTemp.c >= FEVER_C) {
    return { kind: 'fever', tone: age.days < 90 ? 'alert' : 'watch', title: t(`სიცხე ${sick.lastTemp.c.toFixed(1)}°`, `Temperature ${sick.lastTemp.c.toFixed(1)}°`), body: age.days < 90 ? t('3 თვემდე ბავშვთან სიცხე — ახლავე ექიმთან.', 'Fever under 3 months — see a doctor now.') : t('ჩაწერე ტემპერატურა და ჰკითხე Medi-ს, როდის მიმართო ექიმს.', 'Keep logging the temperature and ask Medi when to see a doctor.'), action: 'health' };
  }
  const next = vaccines?.summary?.next;
  if (next) {
    const item = vaccines.items.find((i) => i.id === next.id);
    const names = vaccines.summary.nextVisit.map((id) => vaccines.items.find((i) => i.id === id)?.abbr).filter(Boolean).join(' · ');
    if (next.status === 'overdue') return { kind: 'vaccineOverdue', tone: 'watch', title: t('აცრა გადაცილებულია', 'A vaccine is overdue'), body: `${names || item?.abbr} — ${t('დაგეგმე პედიატრთან. სერია თავიდან არ იწყება.', 'plan it with your pediatrician. The series never restarts.')}`, action: 'vaccines', dueOn: next.dueOn };
    if (next.status === 'due' || (item && item.daysFromToday <= 7)) return { kind: 'vaccineDue', tone: 'ok', title: next.status === 'due' ? t('აცრის დროა', 'Vaccines are due') : t('აცრა ახლოვდება', 'Vaccines coming up'), body: names || item?.abbr, action: 'vaccines', dueOn: next.dueOn };
  }
  if (age.isBirthdayMonth) {
    const note = monthNote(age.isBirthdayMonth, lang);
    if (note) return { kind: 'month', tone: 'ok', title: t(`დღეს ${age.isBirthdayMonth} თვისაა!`, `${age.isBirthdayMonth} months today!`), body: note, action: 'guide' };
  }
  if (growth?.dueForCheck) return { kind: 'measure', tone: 'ok', title: t('გაზომვის დროა', 'Time to measure'), body: t('ჩაწერე წონა და სიმაღლე — ნახე, როგორ მიჰყვება თავის ხაზს.', 'Log weight and height — see how they follow their line.'), action: 'growth' };
  if (next) {
    const names = vaccines.summary.nextVisit.map((id) => vaccines.items.find((i) => i.id === id)?.abbr).filter(Boolean).join(' · ');
    const onTime = vaccines.summary.totalForAge > 0 && vaccines.summary.doneForAge === vaccines.summary.totalForAge;
    return { kind: 'vaccineNext', tone: 'ok', title: onTime ? t('აცრები დროულადაა', 'Vaccines are on time') : t('შემდეგი აცრა', 'Next vaccine'), body: t(`შემდეგი — ${names}, ${longDate(next.dueOn, 'ka')}`, `Next — ${names}, ${longDate(next.dueOn, 'en')}`), action: 'vaccines', dueOn: next.dueOn };
  }
  const tip = stageTips(age.stage, lang)[0];
  return { kind: 'tip', tone: 'ok', title: tip?.label || t('ამ ასაკში', 'At this age'), body: tip?.text || '', action: 'guide' };
}

const STATION_RANK = { overdue: 6, due: 5, soon: 4, upcoming: 3, done: 2, skipped: 1, expired: 0, not_needed: -1 };

/**
 * The hero's life ribbon: one station per calendar age (birth … 14 years) with the most urgent status of its
 * doses, and the age in days where it sits. Stations whose doses are all not needed are left out.
 */
export function ribbonStations(vaccineItems, birthYmd) {
  const byStage = new Map();
  for (const item of vaccineItems) {
    if (item.status === 'not_needed') continue;
    const at = daysBetween(birthYmd, item.calendarOn);
    const prev = byStage.get(item.stage);
    const status = !prev || STATION_RANK[item.status] > STATION_RANK[prev.status] ? item.status : prev.status;
    byStage.set(item.stage, { key: item.stage, ageDays: prev ? Math.min(prev.ageDays, at) : at, status, doses: (prev?.doses || 0) + 1 });
  }
  return [...byStage.values()].sort((a, b) => a.ageDays - b.ageDays);
}

const MONTHS_KA = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** „15 მარტი 2027“ / „15 March 2027“. */
export function longDate(ymd, lang = 'ka') {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${(lang === 'en' ? MONTHS_EN : MONTHS_KA)[m - 1]} ${y}`;
}

/** Everything the child page needs in one response. */
export function overviewView({ member, doses, measurements, logs, health, foods, milestones, todayYmd, todayStartMs, nowMs, lang = 'ka' }) {
  const age = ageInfo(member, todayYmd, lang);
  const vaccines = vaccineView(member, doses, todayYmd, lang);
  const growth = growthView(member, measurements, todayYmd, lang, { curves: false });
  const sick = sickDayView(logs, nowMs);
  const items = health.map(publicHealthItem);
  const foodsAll = foodList(foods, lang);
  return {
    member: publicMember(member),
    age,
    hero: heroAnswer({ member, age, vaccines, growth, sick, lang }),
    ribbon: ribbonStations(vaccines.items, toYmd(member.birthDate)),
    vaccines: {
      summary: vaccines.summary,
      upcoming: vaccines.items.filter((i) => ['overdue', 'due', 'soon', 'upcoming'].includes(i.status)).sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1)).slice(0, 3),
    },
    growth: {
      last: growth.last,
      dueForCheck: growth.dueForCheck,
      latest: Object.fromEntries(Object.entries(growth.indicators).map(([k, v]) => [k, v.latest ? { value: v.latest.value, percentile: v.latest.percentile, status: v.latest.status, tone: v.latest.tone, on: v.latest.on } : null])),
      trends: Object.fromEntries(Object.entries(growth.indicators).map(([k, v]) => [k, v.trend?.direction || null])),
      spark: growth.indicators.wfa?.points.slice(-8).map((p) => ({ on: p.on, value: p.value, z: p.z })) || [],
    },
    sick: { lastTemp: sick.lastTemp, feverDays: sick.feverDays, active: sick.active, temps: sick.temps.slice(0, 6) },
    feeding: age.days < 730 ? { ...feedingToday(logs, todayStartMs), mode: member.feedingMode || null } : null,
    foods: age.days >= 120 && age.days < 1095 ? { tried: foodsAll.filter((f) => f.status).length, allergensTried: foodsAll.filter((f) => f.allergen && f.status && f.status !== 'AVOID').length, allergensTotal: foodsAll.filter((f) => f.allergen).length, reactions: foodsAll.filter((f) => f.status === 'REACTION').map((f) => f.name) } : null,
    milestones: age.days >= 45 && age.days < 6 * 365 ? (() => { const g = milestoneGuide(age.correctedDays, milestones, lang); return { current: g.current ? { key: g.current.key, months: g.current.months, done: g.current.done, total: g.current.total, screen: g.current.screen } : null, next: g.next ? { key: g.next.key, months: g.next.months } : null }; })() : null,
    health: { allergies: items.filter((i) => i.kind === 'ALLERGY' && i.active), conditions: items.filter((i) => i.kind === 'CONDITION' && i.active), medicines: items.filter((i) => i.kind === 'MEDICATION' && i.active) },
    tips: stageTips(age.stage, lang),
    feedingGuide: feedingGuide(age.stage, lang),
  };
}

/** One row of the children list (light). */
export function listItemView({ member, doses, todayYmd, lang = 'ka' }) {
  const age = ageInfo(member, todayYmd, lang);
  const vaccines = vaccineView(member, doses, todayYmd, lang);
  return { ...publicMember(member), age: { label: age.label, days: age.days, stage: age.stage }, vaccines: vaccines.summary };
}
