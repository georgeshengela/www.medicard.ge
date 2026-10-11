/**
 * Admin #/pills (MEDIPILL) — who keeps medicines in the app, marks doses, keeps reminders on and uses the
 * pharmacy prices.
 *
 * Sources: MedicationSchedule (the list; there is no edit — changing a medicine is delete + add again, and a
 * delete is permanent), MedicationDoseEvent (every „მივიღე“ / „გამოვტოვე“ mark, keyed by medicine + civil
 * date + slot time, also kept for deleted medicines), NotificationPermission (the phone's notification
 * switch — medication reminders are local, the Profile family switch never reaches the server),
 * PriceDropAlert + FunnelEvent `price_alert_opened` (price-drop pushes), HealthProfile `priceDropAlerts`
 * (turned off), AiInteraction `MEDICATION` (Medi's medication review). Pharmacy search is public and has no
 * per-person log, so „ფასები“ here means a medicine picked from the pharmacy catalogue (it is then compared
 * across pharmacies and gets price-drop alerts) or a price alert.
 *
 * Adherence (last 14 Tbilisi days) is computed from the schedules that are still active: a slot is due on a
 * day the course covers (start/end, weekdays Monday = 0), from the moment the medicine was added, once two
 * hours have passed. A mark answers a due slot. Paused and deleted medicines are left out (their history is
 * unknown), so are „as needed“ ones.
 *
 * Privacy: the response carries counts, the person's name and contact (as on the user page) — never a
 * medicine name, dosage, notes or dose times on a person. Medicine names appear only in the aggregate, and
 * only when at least three different people keep the same one (else they fold into „სხვა“).
 */
import { prisma } from './prisma.js';
import { addDaysYmd, enumerateYmds, rateSafe, TBILISI_OFFSET, tbilisiMidnight, tbilisiYmd } from './adminAnalyticsRange.js';
import {
  activityTracker, bump, daySeries, flagState, iso, loadPeople, loadTeamUserIds, median, missingTable, ms,
  personSummary, USAGE_PERIODS, usageWindow, zeroes,
} from './adminUsageKit.js';
import { listFeatureFlags } from './featureFlags.js';

/** The wall lists at most this many people (newest activity first); every count still covers all of them. */
export const PILLS_USAGE_LIST_MAX = 400;
/** Adherence and the card's „last 14 days“ always cover this many Tbilisi days, whatever the period. */
export const ADHERENCE_DAYS = 14;
/** Today's slot counts as due once this much time has passed since it. */
export const DUE_GRACE_MS = 2 * 3_600_000;
/** „Taking it well“: at least this share of due doses marked „მივიღე“, over at least ADHERENT_MIN_DUE due doses. */
export const ADHERENT_RATE = 80;
export const ADHERENT_MIN_DUE = 3;
/** A medicine name is shown in the aggregate only when this many different people keep it. */
export const NAME_MIN_PEOPLE = 3;

const FORMS = ['pills', 'capsules', 'liquid', 'injection', 'unknown'];
const FREQUENCY_KINDS = ['daily', 'weekly', 'one_time', 'as_needed'];
const MEAL_KEYS = ['any', 'before', 'after', 'with', 'unset'];
const ALERT_STATES = ['SENT', 'PENDING', 'SKIPPED', 'FAILED'];
const PERMISSION_KEYS = ['enabled', 'disabled', 'unknown'];

const isYmd = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isHm = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
/** The instant of a dose slot (civil Tbilisi date + HH:mm). Georgia has no DST. */
export const slotInstant = (ymd, hm) => ms(`${ymd}T${hm}:00${TBILISI_OFFSET}`);
/** Monday = 0 … Sunday = 6, like the app's `daysOfWeek`. */
const mondayIndex = (ymd) => (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7;
export const normalizeName = (name) => String(name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ka-GE');

/** The dose times of a schedule, sorted and unique ("09:00, 21:00" → ['09:00', '21:00']). */
export function scheduleTimes(frequency) {
  return [...new Set(String(frequency || '').split(',').map((t) => t.trim()).filter(isHm))].sort();
}

/** Slot times of one medicine on one civil day by the course rules (no "due yet" check). */
export function slotsOn(med, ymd) {
  const kind = med.frequencyKind || 'daily';
  if (kind === 'as_needed') return [];
  if (med.startDate && ymd < med.startDate) return [];
  if (med.endDate && ymd > med.endDate) return [];
  if (kind === 'one_time' && med.startDate && ymd !== med.startDate) return [];
  const days = Array.isArray(med.daysOfWeek) ? med.daysOfWeek : [];
  if (days.length && !days.includes(mondayIndex(ymd))) return [];
  return med.times || [];
}

/**
 * Pure: a person's adherence over `dayKeys` for their active medicines. A slot is due when the course covers
 * the day, it is not before the medicine was added and at least DUE_GRACE_MS has passed. Marks on a due slot
 * answer it; marks at a time the schedule no longer has (an older time) fill the remaining due slots of that
 * day; marks on slots that are not due yet (before adding, later today) are ignored.
 */
export function adherenceFor(meds, marks, dayKeys, now = new Date()) {
  const out = { due: 0, taken: 0, skipped: 0, missed: 0 };
  const cutoff = now.getTime() - DUE_GRACE_MS;
  const byMedDay = new Map();
  for (const m of marks || []) {
    const key = `${m.medicationId}|${m.date}`;
    if (!byMedDay.has(key)) byMedDay.set(key, []);
    byMedDay.get(key).push(m);
  }
  for (const med of meds || []) {
    if (!med.active) continue;
    const added = ms(med.createdAt);
    for (const day of dayKeys) {
      const slots = slotsOn(med, day);
      if (!slots.length) continue;
      const due = slots.filter((t) => {
        const at = slotInstant(day, t);
        return at >= added - 60_000 && at <= cutoff;
      });
      if (!due.length) continue;
      const open = new Set(due);
      const dayMarks = byMedDay.get(`${med.id}|${day}`) || [];
      let taken = 0;
      let skipped = 0;
      const loose = [];
      for (const mk of dayMarks) {
        if (open.has(mk.time)) {
          open.delete(mk.time);
          if (mk.status === 'taken') taken += 1;
          else skipped += 1;
        } else if (!slots.includes(mk.time)) loose.push(mk);
      }
      for (const mk of loose) {
        if (!open.size) break;
        open.delete(open.values().next().value);
        if (mk.status === 'taken') taken += 1;
        else skipped += 1;
      }
      out.due += due.length;
      out.taken += taken;
      out.skipped += skipped;
      out.missed += open.size;
    }
  }
  return { ...out, rate: rateSafe(out.taken, out.due) };
}

function adherenceBucket(a) {
  if (!a || a.due < ADHERENT_MIN_DUE) return null;
  if (a.rate >= ADHERENT_RATE) return 'high';
  if (a.rate >= 50) return 'mid';
  if (a.rate > 0) return 'low';
  return 'none';
}

/** Hours between the slot and the moment the mark was made → before / onTime / late (same day) / backfill. */
function markTiming(mark) {
  const slot = slotInstant(mark.date, mark.time);
  const at = ms(mark.occurredAt);
  if (!slot || !at) return null;
  const hours = (at - slot) / 3_600_000;
  if (hours < -1) return 'before';
  if (hours <= 1) return 'onTime';
  if (hours <= 24) return 'late';
  return 'backfill';
}

/**
 * Pure: raw rows (all accounts) → the page payload. `raw` comes from loadPillsUsageRaw (or a test fixture).
 * @param {object} raw
 * @param {{ days?: number, includeTeam?: boolean, now?: Date }} opts
 */
export function buildPillsUsage(raw, { days = 30, includeTeam = false, now = new Date() } = {}) {
  const win = usageWindow(days, now);
  const { today, dayKeys, inPeriod } = win;
  const recentFrom = addDaysYmd(today, -(ADHERENCE_DAYS - 1));
  const recentKeys = enumerateYmds(recentFrom, today);

  const teamIds = new Set(raw.teamUserIds || []);
  const keep = (row) => includeTeam || !teamIds.has(row.userId);
  const allMeds = raw.medications || [];
  const allMarks = (raw.marks || []).filter((m) => isYmd(m.date) && isHm(m.time) && (m.status === 'taken' || m.status === 'skipped'));
  const meds = allMeds.filter(keep);
  const marks = allMarks.filter(keep);
  const alerts = (raw.alerts || []).filter(keep);
  const opened = (raw.alertOpens || []).filter(keep);
  const reviews = (raw.reviews || []).filter(keep);
  const alertsOff = new Set((raw.alertsOff || []).filter(keep).map((r) => r.userId));
  const users = new Map((raw.people || []).map((u) => [u.id, u]));
  const permission = new Map((raw.permissions || []).map((p) => [p.userId, p]));
  const medIds = new Set(allMeds.map((m) => m.id));
  const tracker = activityTracker();

  // ── per person ───────────────────────────────────────────────────────────
  const people = new Map();
  const person = (userId) => {
    if (!people.has(userId)) {
      people.set(userId, {
        userId, meds: [], marks: [], deletedMeds: new Set(), alerts: { sent: 0, total: 0 }, opened: 0, reviews: 0,
        firstAt: 0, lastAt: 0, firstMedAt: 0,
      });
    }
    return people.get(userId);
  };
  const touch = (p, at) => {
    const t = ms(at);
    if (!t) return;
    if (!p.firstAt || t < p.firstAt) p.firstAt = t;
    if (t > p.lastAt) p.lastAt = t;
  };
  for (const m of meds) {
    const p = person(m.userId);
    p.meds.push(m);
    touch(p, m.createdAt);
    if (!p.firstMedAt || ms(m.createdAt) < p.firstMedAt) p.firstMedAt = ms(m.createdAt);
    tracker.act(m.userId, m.createdAt);
  }
  for (const mk of marks) {
    const p = person(mk.userId);
    p.marks.push(mk);
    if (!medIds.has(mk.medicationId)) p.deletedMeds.add(mk.medicationId);
    touch(p, mk.occurredAt);
    tracker.act(mk.userId, mk.occurredAt);
  }
  // Price alerts, opens and Medi reviews belong to someone who keeps (or kept) medicines; they never start a person.
  for (const a of alerts) {
    const p = people.get(a.userId);
    if (!p) continue;
    p.alerts.total += 1;
    if (a.state === 'SENT') p.alerts.sent += 1;
  }
  for (const o of opened) {
    const p = people.get(o.userId);
    if (!p) continue;
    p.opened += 1;
    touch(p, o.createdAt);
    tracker.act(o.userId, o.createdAt);
  }
  for (const r of reviews) {
    const p = people.get(r.userId);
    if (!p) continue;
    p.reviews += 1;
    touch(p, r.createdAt);
    tracker.act(r.userId, r.createdAt);
  }

  const shaped = [...people.values()].map((p) => {
    const active = p.meds.filter((m) => m.active && !(m.endDate && m.endDate < today));
    const ended = p.meds.filter((m) => m.active && m.endDate && m.endDate < today);
    const paused = p.meds.filter((m) => !m.active);
    const markDays = new Set(p.marks.map((m) => m.date));
    const recent = p.marks.filter((m) => m.date >= recentFrom && m.date <= today);
    const adherence = adherenceFor(p.meds, p.marks, recentKeys, now);
    const perm = permission.get(p.userId);
    const permissionState = !perm ? 'unknown' : perm.status === 'enabled' || perm.status === 'provisional' ? 'enabled' : perm.status === 'disabled' ? 'disabled' : 'unknown';
    return {
      p,
      active: active.length,
      ended: ended.length,
      paused: paused.length,
      deleted: p.deletedMeds.size,
      linked: active.filter((m) => m.linked).length,
      linkedAny: p.meds.filter((m) => m.linked).length,
      markDays: markDays.size,
      taken: p.marks.filter((m) => m.status === 'taken').length,
      skipped: p.marks.filter((m) => m.status === 'skipped').length,
      recent: { marked: recent.length, taken: recent.filter((m) => m.status === 'taken').length, skipped: recent.filter((m) => m.status === 'skipped').length, days: new Set(recent.map((m) => m.date)).size },
      adherence,
      bucket: adherenceBucket(adherence),
      permission: permissionState,
      activeDays: tracker.days(p.userId),
    };
  });

  const count = (fn) => shaped.filter(fn).length;
  const peopleCount = shaped.length;
  const ladder = [
    { key: 'added', count: peopleCount },
    { key: 'active', count: count((s) => s.active > 0) },
    { key: 'marked', count: count((s) => s.p.marks.length > 0) },
    { key: 'regular', count: count((s) => s.markDays >= 3) },
    { key: 'adherent', count: count((s) => s.bucket === 'high') },
    { key: 'returned', count: count((s) => s.activeDays >= 2) },
  ].map((step) => ({ ...step, rate: rateSafe(step.count, peopleCount) }));

  const accounts = Math.max(0, (raw.accountsTotal || 0) - (includeTeam ? 0 : teamIds.size));

  // ── adherence across people (last 14 days) ──────────────────────────────────
  const adherenceTotal = { due: 0, taken: 0, skipped: 0, missed: 0 };
  const buckets = { high: 0, mid: 0, low: 0, none: 0 };
  let adherencePeople = 0;
  for (const s of shaped) {
    if (!s.adherence.due) continue;
    adherencePeople += 1;
    for (const k of Object.keys(adherenceTotal)) adherenceTotal[k] += s.adherence[k];
    if (s.bucket) buckets[s.bucket] += 1;
  }

  // ── app return after the first medicine (any screen, from AppActivity) ───────
  const appDays = new Map();
  for (const a of raw.appActivity || []) {
    if (!appDays.has(a.userId)) appDays.set(a.userId, new Set());
    appDays.get(a.userId).add(String(a.date).slice(0, 10));
  }
  const appReturned = shaped.filter((s) => {
    const first = tbilisiYmd(new Date(s.p.firstAt || now));
    return [...(appDays.get(s.p.userId) || [])].some((d) => d > first);
  }).length;

  // ── first medicine after sign-up ──────────────────────────────────────────
  const firstMed = { sameDay: 0, week: 0, later: 0 };
  const hoursToFirst = [];
  for (const s of shaped) {
    const u = users.get(s.p.userId);
    if (!u?.createdAt || !s.p.firstAt) continue;
    const hours = Math.max(0, (s.p.firstAt - ms(u.createdAt)) / 3_600_000);
    hoursToFirst.push(hours);
    if (hours < 24) firstMed.sameDay += 1;
    else if (hours < 24 * 7) firstMed.week += 1;
    else firstMed.later += 1;
  }

  // ── what is on the list (kept medicines) ───────────────────────────────────
  const forms = zeroes(FORMS);
  const frequency = zeroes(FREQUENCY_KINDS);
  const timesPerDay = { one: 0, two: 0, three: 0, more: 0 };
  const weekdays = { everyDay: 0, someDays: 0 };
  const course = { week: 0, month: 0, quarter: 0, long: 0, open: 0 };
  const meal = zeroes(MEAL_KEYS);
  const perPerson = { one: 0, few: 0, many: 0 };
  let linked = 0;
  const activeMeds = meds.filter((m) => m.active && !(m.endDate && m.endDate < today));
  for (const m of activeMeds) {
    bump(forms, FORMS.includes(m.form) ? m.form : 'unknown');
    bump(frequency, FREQUENCY_KINDS.includes(m.frequencyKind) ? m.frequencyKind : 'daily');
    const n = (m.times || []).length;
    bump(timesPerDay, n <= 1 ? 'one' : n === 2 ? 'two' : n === 3 ? 'three' : 'more');
    const dow = Array.isArray(m.daysOfWeek) ? new Set(m.daysOfWeek) : new Set();
    bump(weekdays, !dow.size || dow.size >= 7 ? 'everyDay' : 'someDays');
    if (m.startDate && m.endDate) {
      const len = Math.round((ms(`${m.endDate}T00:00:00Z`) - ms(`${m.startDate}T00:00:00Z`)) / 86_400_000) + 1;
      bump(course, len <= 7 ? 'week' : len <= 31 ? 'month' : len <= 92 ? 'quarter' : 'long');
    } else bump(course, 'open');
    bump(meal, MEAL_KEYS.includes(m.mealTiming) ? m.mealTiming : 'unset');
    if (m.linked) linked += 1;
  }
  for (const s of shaped) if (s.active) bump(perPerson, s.active === 1 ? 'one' : s.active <= 3 ? 'few' : 'many');

  // Names: only when ≥ NAME_MIN_PEOPLE different people keep the same medicine (k-anonymity); the rest fold.
  const names = new Map();
  for (const m of meds) {
    const key = m.nameKey || normalizeName(m.name);
    if (!key) continue;
    if (!names.has(key)) names.set(key, { people: new Set(), meds: 0, labels: new Map() });
    const row = names.get(key);
    row.people.add(m.userId);
    row.meds += 1;
    const label = String(m.name || '').trim().replace(/\s+/g, ' ');
    row.labels.set(label, (row.labels.get(label) || 0) + 1);
  }
  const shownNames = [];
  const otherPeople = new Set();
  let otherMeds = 0;
  for (const row of names.values()) {
    if (row.people.size >= NAME_MIN_PEOPLE) {
      const label = [...row.labels].sort((a, b) => b[1] - a[1])[0][0];
      shownNames.push({ label, people: row.people.size, medications: row.meds });
    } else {
      row.people.forEach((u) => otherPeople.add(u));
      otherMeds += row.meds;
    }
  }
  shownNames.sort((a, b) => b.people - a.people || a.label.localeCompare(b.label));

  // ── marks ────────────────────────────────────────────────────────────────
  const sources = { app: 0, notification: 0 };
  const timing = { before: 0, onTime: 0, late: 0, backfill: 0 };
  for (const mk of marks) {
    bump(sources, mk.source === 'notification' ? 'notification' : 'app');
    const t = markTiming(mk);
    if (t) bump(timing, t);
  }
  const deletedMarks = marks.filter((mk) => !medIds.has(mk.medicationId));

  // ── reminders (phone notification permission of people with an active medicine) ──
  const permissionAll = zeroes(PERMISSION_KEYS);
  const permissionActive = zeroes(PERMISSION_KEYS);
  const platforms = {};
  for (const s of shaped) {
    bump(permissionAll, s.permission);
    if (!s.active) continue;
    bump(permissionActive, s.permission);
    const plat = permission.get(s.p.userId)?.platform;
    if (plat) bump(platforms, ['ios', 'android', 'web'].includes(plat) ? plat : 'other');
  }

  // ── prices + Medi ─────────────────────────────────────────────────────────
  const alertStates = zeroes(ALERT_STATES);
  for (const a of alerts) if (people.has(a.userId)) bump(alertStates, ALERT_STATES.includes(a.state) ? a.state : 'PENDING');
  const reviewOk = reviews.filter((r) => people.has(r.userId));

  // ── period ────────────────────────────────────────────────────────────────
  const periodMarks = marks.filter((mk) => mk.date >= win.from && mk.date <= today);
  const marksByDay = new Map(dayKeys.map((d) => [d, 0]));
  for (const mk of periodMarks) marksByDay.set(mk.date, (marksByDay.get(mk.date) || 0) + 1);
  const signups = (raw.signups || []).filter((u) => (includeTeam || !teamIds.has(u.id)) && inPeriod(u.createdAt));
  const signupsWithMed = signups.filter((u) => people.has(u.id));

  // ── wall ─────────────────────────────────────────────────────────────────
  const items = shaped
    .map((s) => ({
      id: s.p.userId,
      firstAt: s.p.firstAt ? new Date(s.p.firstAt).toISOString() : null,
      lastAt: s.p.lastAt ? new Date(s.p.lastAt).toISOString() : null,
      meds: { active: s.active, ended: s.ended, paused: s.paused, deleted: s.deleted },
      marks: { total: s.p.marks.length, taken: s.taken, skipped: s.skipped, days: s.markDays },
      recent: s.recent,
      adherence: { ...s.adherence, bucket: s.bucket },
      permission: s.permission,
      price: { linked: s.linked, alerts: s.p.alerts.sent, opened: s.p.opened, off: alertsOff.has(s.p.userId) },
      medi: s.p.reviews,
      activeDays: s.activeDays,
      person: personSummary(users.get(s.p.userId) || { id: s.p.userId }, { teamIds }),
    }))
    .sort((a, b) => ms(b.lastAt) - ms(a.lastAt));

  const teamMeds = allMeds.filter((m) => teamIds.has(m.userId));
  const teamMarks = allMarks.filter((m) => teamIds.has(m.userId));

  return {
    installed: true,
    generatedAt: now.toISOString(),
    includeTeam,
    team: {
      accounts: teamIds.size,
      people: new Set([...teamMeds, ...teamMarks].map((r) => r.userId)).size,
      medications: teamMeds.length,
      marks: teamMarks.length,
    },
    flags: { medications: flagState(raw.flags, 'medications'), pharmacy: flagState(raw.flags, 'pharmacy') },
    totals: {
      accounts,
      people: peopleCount,
      peopleRate: rateSafe(peopleCount, accounts),
      peopleActive: count((s) => s.active > 0),
      medications: meds.length,
      medicationsActive: activeMeds.length,
      medicationsPaused: meds.filter((m) => !m.active).length,
      medicationsEnded: meds.filter((m) => m.active && m.endDate && m.endDate < today).length,
      marks: marks.length,
      taken: marks.filter((m) => m.status === 'taken').length,
      skipped: marks.filter((m) => m.status === 'skipped').length,
      markPeople: count((s) => s.p.marks.length > 0),
      neverMarked: count((s) => s.p.marks.length === 0),
      withoutMedicine: count((s) => s.p.meds.length === 0),
      appReturned,
    },
    ladder,
    firstMed: { ...firstMed, medianHours: median(hoursToFirst) },
    adherence: {
      days: ADHERENCE_DAYS,
      from: recentKeys[0],
      to: today,
      ...adherenceTotal,
      rate: rateSafe(adherenceTotal.taken, adherenceTotal.due),
      people: adherencePeople,
      buckets,
    },
    period: {
      days: win.days,
      from: win.from,
      to: win.to,
      newMedications: meds.filter((m) => inPeriod(m.createdAt)).length,
      newPeople: shaped.filter((s) => s.p.firstAt && inPeriod(new Date(s.p.firstAt))).length,
      activePeople: tracker.activeIn(win.from, today),
      marks: periodMarks.length,
      taken: periodMarks.filter((m) => m.status === 'taken').length,
      skipped: periodMarks.filter((m) => m.status === 'skipped').length,
      markPeople: new Set(periodMarks.map((m) => m.userId)).size,
      signups: signups.length,
      signupsWithMed: signupsWithMed.length,
      signupMedRate: rateSafe(signupsWithMed.length, signups.length),
      trend: {
        medications: daySeries(dayKeys, meds),
        active: tracker.activeByDay(dayKeys),
        marks: [...marksByDay].map(([day, n]) => ({ day, count: n })),
      },
    },
    schedules: {
      active: activeMeds.length,
      forms,
      frequency,
      timesPerDay,
      weekdays,
      course,
      meal,
      perPerson,
      linked,
      names: shownNames.slice(0, 12),
      namesOther: { people: otherPeople.size, medications: otherMeds },
    },
    marks: {
      total: marks.length,
      taken: marks.filter((m) => m.status === 'taken').length,
      skipped: marks.filter((m) => m.status === 'skipped').length,
      sources,
      timing,
      deleted: { marks: deletedMarks.length, people: new Set(deletedMarks.map((m) => m.userId)).size },
      orphaned: { marks: raw.orphanMarks?.marks || 0, accounts: raw.orphanMarks?.accounts || 0 },
    },
    reminders: { all: permissionAll, active: permissionActive, platforms },
    price: {
      linkedMedications: linked,
      linkedPeople: count((s) => s.linked > 0),
      alerts: alertStates,
      alertPeople: new Set(alerts.filter((a) => people.has(a.userId) && a.state === 'SENT').map((a) => a.userId)).size,
      opened: opened.filter((o) => people.has(o.userId)).length,
      openedPeople: new Set(opened.filter((o) => people.has(o.userId)).map((o) => o.userId)).size,
      off: [...alertsOff].filter((u) => people.has(u)).length,
      catalogProducts: raw.catalogProducts || 0,
    },
    medi: {
      reviews: reviewOk.length,
      people: new Set(reviewOk.map((r) => r.userId)).size,
      errors: reviewOk.filter((r) => r.status === 'ERROR').length,
      lastAt: iso(reviewOk.reduce((max, r) => Math.max(max, ms(r.createdAt)), 0) || null),
    },
    items: items.slice(0, PILLS_USAGE_LIST_MAX),
    itemsTotal: items.length,
  };
}

const optional = (promise) => promise.catch((error) => {
  if (missingTable(error)) return [];
  throw error;
});

/** Every row the page needs, for all accounts (the builder drops team accounts). Read-only. */
export async function loadPillsUsageRaw(db = prisma, { now = new Date() } = {}) {
  const since = tbilisiMidnight(addDaysYmd(tbilisiYmd(now), -(Math.max(...USAGE_PERIODS) - 1)));
  const [teamUserIds, accountsTotal, medRows, marks, alerts, alertOpens, alertsOff, reviews, catalogProducts, signups, flags] = await Promise.all([
    loadTeamUserIds(db),
    db.user.count(),
    // Never dosage or notes. The name stays on the server: it only feeds the ≥3-people aggregate.
    db.medicationSchedule.findMany({ select: { id: true, userId: true, medName: true, frequency: true, active: true, config: true, createdAt: true } }),
    optional(db.medicationDoseEvent.findMany({ select: { userId: true, medicationId: true, date: true, time: true, status: true, source: true, occurredAt: true } })),
    // Never medName / prices: who got a price alert and what happened to it.
    optional(db.priceDropAlert.findMany({ select: { userId: true, state: true, createdAt: true } })),
    optional(db.funnelEvent.findMany({ where: { name: 'price_alert_opened', userId: { not: null } }, select: { userId: true, createdAt: true } })),
    optional(db.$queryRaw`SELECT "userId" FROM "HealthProfile" WHERE "extraAnswers"->>'priceDropAlerts' = 'false'`),
    db.aiInteraction.findMany({ where: { mode: 'MEDICATION' }, select: { userId: true, status: true, createdAt: true } }),
    db.catalogProduct.count({ where: { offerCount: { gt: 0 } } }).catch(() => 0),
    db.user.findMany({ where: { createdAt: { gte: since } }, select: { id: true, createdAt: true } }),
    listFeatureFlags(db).catch(() => []),
  ]);
  const ids = [...new Set([...medRows.map((m) => m.userId), ...marks.map((m) => m.userId)])];
  const [{ people, appDays }, permissions] = await Promise.all([
    loadPeople(ids, db),
    ids.length ? optional(db.notificationPermission.findMany({ where: { userId: { in: ids } }, select: { userId: true, status: true, platform: true } })) : [],
  ]);
  // MedicationDoseEvent is a raw-SQL table without a foreign key: a deleted account's marks stay behind.
  // They are nobody's usage — counted only as a data-hygiene note.
  const known = new Set(people.map((u) => u.id));
  const orphaned = marks.filter((m) => !known.has(m.userId));
  return {
    teamUserIds,
    accountsTotal,
    // Only the schedule fields the page counts (no dosage, notes, image, strength, manufacturer, pill look).
    medications: medRows.map((m) => {
      const c = m.config && typeof m.config === 'object' ? m.config : {};
      return {
        id: m.id,
        userId: m.userId,
        active: m.active !== false,
        createdAt: m.createdAt,
        times: scheduleTimes(m.frequency),
        form: c.form || null,
        frequencyKind: c.frequencyKind || null,
        daysOfWeek: Array.isArray(c.daysOfWeek) ? c.daysOfWeek.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
        startDate: isYmd(c.startDate) ? c.startDate : null,
        endDate: isYmd(c.endDate) ? c.endDate : null,
        mealTiming: c.mealTiming || null,
        linked: Boolean(c.catalogProductId),
        name: m.medName,
        nameKey: normalizeName(m.medName),
      };
    }),
    marks: marks.filter((m) => known.has(m.userId)),
    orphanMarks: { marks: orphaned.length, accounts: new Set(orphaned.map((m) => m.userId)).size },
    alerts,
    alertOpens,
    alertsOff,
    reviews,
    catalogProducts,
    permissions,
    signups,
    people,
    appActivity: appDays,
    flags,
  };
}

export async function loadPillsUsage({ days = 30, includeTeam = false, db = prisma, now = new Date() } = {}) {
  try {
    const raw = await loadPillsUsageRaw(db, { now });
    return buildPillsUsage(raw, { days, includeTeam, now });
  } catch (error) {
    if (missingTable(error)) return { installed: false, generatedAt: now.toISOString() };
    throw error;
  }
}
