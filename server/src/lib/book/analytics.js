/**
 * MEDIBOOK analytics — pure. Turns the raw rows of a period into what the owner's „ანალიტიკა“ page shows:
 * bookings and revenue per day, status split, no-show and cancellation rates, utilisation per person
 * (მარგი ქმედების კოეფიციენტი = booked minutes ÷ working minutes), the same per room / device, the listing
 * funnel, busy hours, top services, new vs returning clients, sources, ratings. Tested in analytics.test.js.
 */
import { dayRanges } from './catalog.js';
import { classBlocks, staffWorkingRanges, subtractRange } from './availability.js';
import { addDaysYmd, daysBetweenYmd, tbilisiInstant, tbilisiMinutes, tbilisiWeekday, tbilisiYmd, weekdayOfYmd } from './time.js';

const MIN = 60_000;
const n2 = (v) => Math.round(Number(v) * 100) / 100;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const toDate = (v) => (v instanceof Date ? v : new Date(v));

/** Minutes of [startsAt, endsAt) that fall inside [from, to). */
function overlapMinutes(startsAt, endsAt, from, to) {
  const s = Math.max(toDate(startsAt).getTime(), from.getTime());
  const e = Math.min(toDate(endsAt).getTime(), to.getTime());
  return e > s ? (e - s) / MIN : 0;
}

/**
 * Working minutes of one person over the period: their schedule ∩ business hours per day, minus time off.
 * Days in the future are not counted (utilisation is about time that has passed or is booked today).
 */
export function workingMinutes({ staff, businessHours, timeOff = [], from, to, now = new Date() }) {
  const start = tbilisiYmd(from);
  const endExclusive = tbilisiYmd(new Date(to.getTime() - 1));
  const lastDay = tbilisiYmd(now) < endExclusive ? tbilisiYmd(now) : endExclusive;
  let total = 0;
  for (let d = start; daysBetweenYmd(d, lastDay) >= 0; d = addDaysYmd(d, 1)) {
    let ranges = staffWorkingRanges(staff, businessHours, weekdayOfYmd(d));
    if (!ranges.length) continue;
    const dayStart = tbilisiInstant(d, 0).getTime();
    for (const off of timeOff) {
      if (off.staffId && off.staffId !== staff.id) continue;
      ranges = subtractRange(ranges, (toDate(off.startsAt).getTime() - dayStart) / MIN, (toDate(off.endsAt).getTime() - dayStart) / MIN);
    }
    // Today: only the part of the shift that has passed.
    if (d === tbilisiYmd(now)) {
      const cut = tbilisiMinutes(now);
      ranges = ranges.map(([a, b]) => [a, Math.min(b, cut)]).filter(([a, b]) => b > a);
    }
    total += ranges.reduce((sum, [a, b]) => sum + (b - a), 0);
  }
  return total;
}

/**
 * Utilisation per room / device: booked minutes of the live appointments that hold it ÷ the business's open minutes
 * (passed hours only, business-wide time off removed) × capacity.
 */
export function resourceUtilisation({ resources = [], appointments = [], businessHours, timeOff = [], from, to, now = new Date() }) {
  const live = appointments.filter((a) => a.status !== 'CANCELLED');
  const open = resources.length ? workingMinutes({ staff: { id: null, schedule: {} }, businessHours, timeOff: timeOff.filter((o) => !o.staffId), from, to, now }) : 0;
  return resources.filter((r) => r.active !== false).map((r) => {
    const capacity = Math.max(1, Number(r.capacity) || 1);
    const mine = live.filter((a) => Array.isArray(a.resourceIds) && a.resourceIds.includes(r.id));
    const booked = mine.reduce((sum, a) => sum + overlapMinutes(a.startsAt, a.endsAt, from, now < to ? now : to), 0);
    const working = open * capacity;
    return {
      resourceId: r.id,
      name: r.name,
      kind: r.kind ?? 'ROOM',
      capacity,
      bookedMinutes: Math.round(booked),
      workingMinutes: Math.round(working),
      utilisation: working > 0 ? Math.min(100, Math.round((booked / working) * 1000) / 10) : null,
      appointments: mine.length,
      completed: mine.filter((a) => a.status === 'COMPLETED').length,
    };
  }).sort((a, b) => (b.utilisation ?? -1) - (a.utilisation ?? -1));
}

/** Attendees of one class share one block of time: for minutes, the class counts once (the first row stands for it). */
export function uniqueBlocks(list) {
  const seen = new Set();
  return list.filter((a) => {
    if (!a.classId) return true;
    if (seen.has(a.classId)) return false;
    seen.add(a.classId);
    return true;
  });
}

export function buildAnalytics({ appointments = [], events = [], transactions = [], staff = [], timeOff = [], clients = [], reviews = [], business = {}, resources = [], classes = [], from, to, now = new Date() }) {
  const live = appointments.filter((a) => a.status !== 'CANCELLED');
  const done = appointments.filter((a) => a.status === 'COMPLETED');
  const noShow = appointments.filter((a) => a.status === 'NO_SHOW');
  const cancelled = appointments.filter((a) => a.status === 'CANCELLED');
  const past = appointments.filter((a) => toDate(a.endsAt).getTime() <= now.getTime() && a.status !== 'CANCELLED');
  const income = transactions.filter((t) => t.kind === 'INCOME');
  const expense = transactions.filter((t) => t.kind === 'EXPENSE');
  const revenue = income.reduce((s, t) => s + Number(t.amount), 0);
  const spent = expense.reduce((s, t) => s + Number(t.amount), 0);

  // Per day series.
  const days = [];
  for (let d = tbilisiYmd(from); daysBetweenYmd(d, tbilisiYmd(new Date(to.getTime() - 1))) >= 0; d = addDaysYmd(d, 1)) days.push(d);
  const byDay = new Map(days.map((d) => [d, { date: d, bookings: 0, completed: 0, noShow: 0, cancelled: 0, revenue: 0, expense: 0, views: 0 }]));
  for (const a of appointments) {
    const row = byDay.get(tbilisiYmd(toDate(a.startsAt)));
    if (!row) continue;
    if (a.status !== 'CANCELLED') row.bookings += 1;
    if (a.status === 'COMPLETED') row.completed += 1;
    if (a.status === 'NO_SHOW') row.noShow += 1;
    if (a.status === 'CANCELLED') row.cancelled += 1;
  }
  for (const t of transactions) {
    const row = byDay.get(tbilisiYmd(toDate(t.at)));
    if (!row) continue;
    if (t.kind === 'INCOME') row.revenue = n2(row.revenue + Number(t.amount));
    else row.expense = n2(row.expense + Number(t.amount));
  }
  for (const e of events) if (e.kind === 'VIEW') { const row = byDay.get(tbilisiYmd(toDate(e.at))); if (row) row.views += 1; }

  // Utilisation per person. A class with ten attendees is one hour of the trainer's time, not ten.
  const utilisation = staff.filter((s) => s.active !== false).map((s) => {
    const booked = uniqueBlocks(live.filter((a) => a.staffId === s.id)).reduce((sum, a) => sum + overlapMinutes(a.startsAt, a.endsAt, from, now < to ? now : to), 0);
    const working = workingMinutes({ staff: s, businessHours: business.hours, timeOff, from, to, now });
    const mine = live.filter((a) => a.staffId === s.id);
    const myRevenue = income.filter((t) => t.staffId === s.id).reduce((sum, t) => sum + Number(t.amount), 0);
    return {
      staffId: s.id,
      name: s.name,
      color: s.color ?? null,
      bookedMinutes: Math.round(booked),
      workingMinutes: Math.round(working),
      utilisation: working > 0 ? Math.min(100, Math.round((booked / working) * 1000) / 10) : null,
      appointments: mine.length,
      completed: mine.filter((a) => a.status === 'COMPLETED').length,
      noShow: mine.filter((a) => a.status === 'NO_SHOW').length,
      revenue: n2(myRevenue),
    };
  }).sort((a, b) => (b.utilisation ?? -1) - (a.utilisation ?? -1));
  const totalBooked = utilisation.reduce((s, u) => s + u.bookedMinutes, 0);
  const totalWorking = utilisation.reduce((s, u) => s + u.workingMinutes, 0);

  // Funnel: unique viewers → calls / routes → bookings.
  const uniq = (kind) => new Set(events.filter((e) => e.kind === kind).map((e) => e.viewerHash ?? `${e.at}`)).size;
  const count = (kind) => events.filter((e) => e.kind === kind).length;
  const funnel = {
    views: count('VIEW'),
    viewers: uniq('VIEW'),
    calls: count('CALL'),
    routes: count('ROUTE'),
    website: count('WEBSITE'),
    shares: count('SHARE'),
    favorites: count('FAVORITE'),
    bookingStarted: count('BOOK_START'),
    booked: appointments.filter((a) => a.source !== 'BUSINESS').length,
    conversion: pct(appointments.filter((a) => a.source !== 'BUSINESS').length, uniq('VIEW') || count('VIEW')),
  };

  // Busy hours: weekday × hour (Tbilisi) of non-cancelled appointments.
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const a of live) heat[tbilisiWeekday(toDate(a.startsAt))][Math.floor(tbilisiMinutes(toDate(a.startsAt)) / 60)] += 1;
  const peak = (() => {
    let best = { weekday: null, hour: null, n: 0 };
    heat.forEach((row, wd) => row.forEach((v, h) => { if (v > best.n) best = { weekday: wd, hour: h, n: v }; }));
    return best.n ? best : null;
  })();

  // Top services by count and revenue (price copied at booking).
  const svc = new Map();
  for (const a of live) {
    // A booking with several services counts once per service.
    const parts = Array.isArray(a.items) && a.items.length ? a.items.map((i) => ({ serviceId: i.id ?? null, name: i.name, price: i.price, durationMin: i.durationMin })) : [{ serviceId: a.serviceId ?? null, name: a.serviceName, price: a.price, durationMin: a.durationMin }];
    for (const part of parts) {
      const key = part.serviceId ?? part.name;
      const row = svc.get(key) ?? { serviceId: part.serviceId, name: part.name, count: 0, completed: 0, revenue: 0, minutes: 0 };
      row.count += 1;
      if (a.status === 'COMPLETED') { row.completed += 1; row.revenue = n2(row.revenue + Number(part.price ?? 0)); }
      row.minutes += Number(part.durationMin ?? 0);
      svc.set(key, row);
    }
  }
  const topServices = [...svc.values()].sort((a, b) => b.count - a.count).slice(0, 12);

  // Clients: new in the period vs returning (had a visit before the period).
  const periodClientIds = new Set(live.map((a) => a.clientId).filter(Boolean));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  let newClients = 0;
  let returning = 0;
  for (const id of periodClientIds) {
    const c = clientById.get(id);
    if (!c) continue;
    if (toDate(c.createdAt).getTime() >= from.getTime()) newClients += 1;
    else returning += 1;
  }
  const withVisits = clients.filter((c) => Number(c.visits) > 0);
  const repeatShare = pct(withVisits.filter((c) => Number(c.visits) >= 2).length, withVisits.length);

  const sources = { APP: 0, WEB: 0, BUSINESS: 0 };
  for (const a of live) sources[a.source] = (sources[a.source] ?? 0) + 1;

  const ratingAvg = reviews.length ? Math.round((reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length) * 10) / 10 : null;
  const ratingDist = [1, 2, 3, 4, 5].map((r) => reviews.filter((x) => Number(x.rating) === r).length);
  const methods = {};
  for (const t of income) methods[t.method ?? 'UNKNOWN'] = n2((methods[t.method ?? 'UNKNOWN'] ?? 0) + Number(t.amount));
  const expenseByCategory = {};
  for (const t of expense) expenseByCategory[t.category ?? 'OTHER'] = n2((expenseByCategory[t.category ?? 'OTHER'] ?? 0) + Number(t.amount));
  const leadDays = live.filter((a) => a.source !== 'BUSINESS').map((a) => (toDate(a.startsAt).getTime() - toDate(a.createdAt).getTime()) / 86400_000);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totals: {
      bookings: live.length,
      completed: done.length,
      noShow: noShow.length,
      cancelled: cancelled.length,
      noShowRate: pct(noShow.length, past.length),
      cancelRate: pct(cancelled.length, appointments.length),
      revenue: n2(revenue),
      expense: n2(spent),
      profit: n2(revenue - spent),
      averageTicket: done.length ? n2(revenue / done.length) : null,
      utilisation: totalWorking > 0 ? Math.min(100, Math.round((totalBooked / totalWorking) * 1000) / 10) : null,
      discountGiven: n2(live.reduce((s, a) => s + Number(a.discountAmount ?? 0), 0)),
      averageLeadDays: leadDays.length ? Math.round((leadDays.reduce((s, v) => s + v, 0) / leadDays.length) * 10) / 10 : null,
      bookedMinutes: Math.round(totalBooked),
      workingMinutes: Math.round(totalWorking),
    },
    series: [...byDay.values()],
    utilisation,
    // A class holds its room once; its attendees' rows hold none.
    resources: resourceUtilisation({ resources, appointments: [...appointments, ...classBlocks(classes)], businessHours: business.hours, timeOff, from, to, now }),
    funnel,
    heat,
    peak,
    topServices,
    clients: { active: periodClientIds.size, new: newClients, returning, total: clients.length, repeatShare },
    sources,
    reviews: { count: reviews.length, avg: ratingAvg, dist: ratingDist, businessAvg: business.ratingAvg == null ? null : Math.round(Number(business.ratingAvg) * 10) / 10, businessCount: Number(business.ratingCount ?? 0) },
    money: { methods, expenseByCategory },
  };
}

/** The period for `?range=7|30|90|month` (Tbilisi days, `to` exclusive = tomorrow 00:00). */
export function periodFor(range, now = new Date()) {
  const today = tbilisiYmd(now);
  const to = tbilisiInstant(addDaysYmd(today, 1), 0);
  if (range === 'month') {
    const [y, m] = today.split('-');
    return { from: tbilisiInstant(`${y}-${m}-01`, 0), to, label: 'month' };
  }
  const days = [7, 30, 90, 365].includes(Number(range)) ? Number(range) : 30;
  return { from: tbilisiInstant(addDaysYmd(today, -(days - 1)), 0), to, label: String(days) };
}

export { dayRanges };
