/**
 * MEDIBOOK availability — pure. Which start times a service can be booked at on one Tbilisi day:
 *   business hours ∩ the person's working hours − time off − appointments (with the service's buffer),
 *   on the business's slot grid, not before now + lead time, not beyond the horizon.
 * „Any staff“ = the union over every person who performs the service. Tested in availability.test.js.
 */
import { dayRanges, normalizeSettings } from './catalog.js';
import { addDaysYmd, daysBetweenYmd, tbilisiInstant, tbilisiYmd, weekdayOfYmd } from './time.js';

const MIN = 60_000;

/** Subtract [b0,b1) from a list of [a0,a1) minute ranges. */
export function subtractRange(ranges, b0, b1) {
  const out = [];
  for (const [a0, a1] of ranges) {
    if (b1 <= a0 || b0 >= a1) {
      out.push([a0, a1]);
      continue;
    }
    if (b0 > a0) out.push([a0, b0]);
    if (b1 < a1) out.push([b1, a1]);
  }
  return out;
}

/** Intersection of two lists of [from,to) minute ranges. */
export function intersectRanges(a, b) {
  const out = [];
  for (const [a0, a1] of a) for (const [b0, b1] of b) {
    const lo = Math.max(a0, b0);
    const hi = Math.min(a1, b1);
    if (hi > lo) out.push([lo, hi]);
  }
  return out.sort((x, y) => x[0] - y[0]);
}

/** A person's working minutes on a weekday: their own schedule, or the business hours when none is set. */
export function staffWorkingRanges(staff, businessHours, weekday) {
  const own = staff?.schedule && typeof staff.schedule === 'object' ? staff.schedule : {};
  const hasOwn = Object.values(own).some((list) => Array.isArray(list) && list.length);
  const business = dayRanges(businessHours, weekday);
  if (!hasOwn) return business;
  const mine = dayRanges(own, weekday);
  return business.length ? intersectRanges(mine, business) : mine;
}

function performs(staff, serviceId) {
  const ids = Array.isArray(staff?.serviceIds) ? staff.serviceIds : [];
  return ids.length === 0 || ids.includes(serviceId);
}

/**
 * @param {object} args
 * @param {object} args.business  { hours, settings }
 * @param {object} args.service   { id, durationMin, bufferMin }
 * @param {object[]} args.staff   active people [{ id, serviceIds, schedule, bookable }]
 * @param {object[]} args.appointments  on that day (and the night before), any status but CANCELLED: [{ staffId, startsAt, endsAt }]
 * @param {object[]} args.timeOff [{ staffId|null, startsAt, endsAt }]
 * @param {string} args.date  YYYY-MM-DD (Tbilisi)
 * @param {Date} [args.now]
 * @param {string|null} [args.staffId]  a chosen person, or null for anyone
 * @param {boolean} [args.ignoreLead]  the business books for a walk-in (no lead time, no horizon)
 * @returns {{ slots: Array<{ time: string, startsAt: string, staffIds: string[] }>, closed: boolean, reason?: string }}
 */
export function slotsForDay({ business, service, staff, appointments = [], timeOff = [], date, now = new Date(), staffId = null, ignoreLead = false }) {
  const settings = normalizeSettings(business?.settings);
  const weekday = weekdayOfYmd(date);
  const today = tbilisiYmd(now);
  if (!ignoreLead) {
    const ahead = daysBetweenYmd(today, date);
    if (ahead < 0) return { slots: [], closed: true, reason: 'past' };
    if (ahead > settings.horizonDays) return { slots: [], closed: true, reason: 'horizon' };
  }
  const duration = Math.max(5, Number(service?.durationMin) || 30);
  const buffer = Math.max(0, Number(service?.bufferMin) || 0);
  const step = settings.slotMinutes;
  const dayStart = tbilisiInstant(date, 0).getTime();
  const earliest = ignoreLead ? -Infinity : now.getTime() + settings.leadMinutes * MIN;

  const people = (staff ?? []).filter((s) => s && s.active !== false && s.bookable !== false && performs(s, service?.id) && (!staffId || s.id === staffId));
  if (!people.length) return { slots: [], closed: true, reason: staffId ? 'staff' : 'no-staff' };

  const toMin = (iso) => (new Date(iso).getTime() - dayStart) / MIN;
  const byTime = new Map();
  let anyWorking = false;
  for (const person of people) {
    let free = staffWorkingRanges(person, business?.hours, weekday);
    if (!free.length) continue;
    anyWorking = true;
    for (const off of timeOff) {
      if (off.staffId && off.staffId !== person.id) continue;
      free = subtractRange(free, toMin(off.startsAt), toMin(off.endsAt));
    }
    for (const a of appointments) {
      if (a.status === 'CANCELLED') continue;
      if (a.staffId && a.staffId !== person.id) continue;
      // An appointment without a person blocks everyone only when the business has one bookable person.
      if (!a.staffId && people.length > 1) continue;
      free = subtractRange(free, toMin(a.startsAt) - buffer, toMin(a.endsAt) + buffer);
    }
    for (const [from, to] of free) {
      // Snap the first start to the grid (a shift from 09:15 on a 30-min grid offers 09:30).
      const first = Math.ceil(from / step) * step;
      for (let start = first; start + duration <= to; start += step) {
        const at = dayStart + start * MIN;
        if (at < earliest) continue;
        const key = start;
        const slot = byTime.get(key) ?? { time: `${String(Math.floor((start / 60) % 24)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`, startsAt: new Date(at).toISOString(), staffIds: [] };
        slot.staffIds.push(person.id);
        byTime.set(key, slot);
      }
    }
  }
  if (!anyWorking) return { slots: [], closed: true, reason: 'closed' };
  const slots = [...byTime.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s);
  return { slots, closed: false };
}

/** Days in the horizon that have at least one slot (for the date strip). Cheap: reuses one appointment list. */
export function daysWithSlots({ business, service, staff, appointments, timeOff, from, now = new Date(), staffId = null, days = 14 }) {
  const out = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDaysYmd(from, i);
    const dayAppointments = appointments.filter((a) => tbilisiYmd(new Date(a.startsAt)) === date || tbilisiYmd(new Date(a.endsAt)) === date);
    const dayOff = timeOff.filter((o) => new Date(o.startsAt).getTime() < tbilisiInstant(date, 24 * 60).getTime() && new Date(o.endsAt).getTime() > tbilisiInstant(date, 0).getTime());
    const r = slotsForDay({ business, service, staff, appointments: dayAppointments, timeOff: dayOff, date, now, staffId });
    out.push({ date, count: r.slots.length, closed: r.closed });
  }
  return out;
}

/** Does [startsAt, endsAt) overlap another appointment of this person (buffer included)? */
export function findConflict(appointments, { staffId, startsAt, endsAt, bufferMin = 0, ignoreId = null }) {
  const s = new Date(startsAt).getTime() - bufferMin * MIN;
  const e = new Date(endsAt).getTime() + bufferMin * MIN;
  return appointments.find((a) => a.id !== ignoreId && a.status !== 'CANCELLED' && (!staffId || !a.staffId || a.staffId === staffId)
    && new Date(a.startsAt).getTime() < e && new Date(a.endsAt).getTime() > s) ?? null;
}

/** Is `startsAt` one of the offered slots of that day for this person? */
export function isOfferedSlot(result, startsAt, staffId = null) {
  const iso = new Date(startsAt).toISOString();
  const slot = result.slots.find((s) => s.startsAt === iso);
  return Boolean(slot && (!staffId || slot.staffIds.includes(staffId)));
}

/** Can the client still cancel for free? */
export function canCancelFree(appointment, settings, now = new Date()) {
  const s = normalizeSettings(settings);
  return new Date(appointment.startsAt).getTime() - now.getTime() >= s.cancelHours * 3600_000;
}
