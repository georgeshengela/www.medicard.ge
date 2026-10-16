/**
 * MEDIBOOK availability — pure. Which start times a service can be booked at on one Tbilisi day:
 *   business hours ∩ the person's working hours − time off − appointments (with the service's buffer),
 *   on the business's slot grid, not before now + lead time, not beyond the horizon,
 *   and only while every room / device the service needs still has a free unit (`resources`, capacity-aware).
 * „Any staff“ = the union over every person who performs the service. Tested in availability.test.js.
 * Group classes (`service.seats` > 1): a `BookClass` row blocks its trainer like a booking and holds its rooms once,
 * and the same service is offered into it (a „join“ slot with `classId`, `seats`, `seatsLeft`) while a seat is free.
 * A class service with a timetable (`service.scheduled`) offers only its planned classes, never the free grid.
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
/** The service ids a slot must cover: a bundle ({ ids }) or one service ({ id }). */
export function serviceIdsOf(service) {
  const ids = Array.isArray(service?.ids) ? service.ids.filter(Boolean) : [];
  return ids.length ? ids : [service?.id].filter(Boolean);
}

/** The resources a set of services needs — the union over the service → resource links, in link order. */
export function resourceIdsFor(links, serviceIds) {
  const wanted = new Set((serviceIds ?? []).filter(Boolean));
  const out = [];
  for (const l of links ?? []) if (wanted.has(l.serviceId) && l.resourceId && !out.includes(l.resourceId)) out.push(l.resourceId);
  return out;
}

const holdsResource = (a, id) => Array.isArray(a?.resourceIds) && a.resourceIds.includes(id);
const iso = (v) => (v instanceof Date ? v : new Date(v)).toISOString();
const clockLabel = (start) => `${String(Math.floor((start / 60) % 24)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;

/** Seats of a class: how many it has and how many are still free (live attendees never push it below zero). */
export function seatsOf(cls) {
  const seats = Math.max(1, Math.round(Number(cls?.seats)) || 1);
  const booked = Math.max(0, Math.round(Number(cls?.booked)) || 0);
  return { seats, booked, left: Math.max(0, seats - booked) };
}
export const seatsLeft = (cls) => seatsOf(cls).left;

/**
 * A planned or formed class as the engine sees it: one block on the trainer's time (like a booking) that holds
 * the class's rooms exactly once — the attendees' own rows hold none. Cancelled classes block nothing.
 */
export function classBlocks(classes) {
  return (classes ?? []).filter((c) => c && c.status !== 'CANCELLED').map((c) => ({
    id: `class:${c.id}`, classId: c.id, staffId: c.staffId ?? null, status: 'CONFIRMED', startsAt: iso(c.startsAt), endsAt: iso(c.endsAt), resourceIds: Array.isArray(c.resourceIds) ? c.resourceIds : [], isClass: true,
  }));
}

/** The open class of `serviceId` that starts exactly at `startsAt` (and belongs to `staffId` when given); the one with most seats free wins. */
export function classAt(classes, { serviceId, startsAt, staffId = null }) {
  const at = new Date(startsAt).getTime();
  const same = (classes ?? []).filter((c) => c && c.status !== 'CANCELLED' && c.serviceId === serviceId && new Date(c.startsAt).getTime() === at && (!staffId || c.staffId === staffId));
  return same.sort((a, b) => seatsLeft(b) - seatsLeft(a))[0] ?? null;
}

/**
 * Which needed resource has every unit taken in [startsAt, endsAt) (buffer on both sides, like the person check)?
 * Counts the live appointments that hold the resource and overlap; a resource with `capacity` units blocks once
 * that many overlap. Unknown or retired resources never block. Returns { resource, taken, capacity } or null.
 */
export function resourceConflict(appointments, resources, { resourceIds = [], startsAt, endsAt, bufferMin = 0, ignoreId = null }) {
  const needed = (resourceIds ?? []).filter(Boolean);
  if (!needed.length) return null;
  const s = new Date(startsAt).getTime() - bufferMin * MIN;
  const e = new Date(endsAt).getTime() + bufferMin * MIN;
  const byId = new Map((resources ?? []).map((r) => [r.id, r]));
  for (const id of needed) {
    const resource = byId.get(id);
    if (!resource || resource.active === false) continue;
    const capacity = Math.max(1, Number(resource.capacity) || 1);
    const taken = (appointments ?? []).filter((a) => a.id !== ignoreId && a.status !== 'CANCELLED' && holdsResource(a, id)
      && new Date(a.startsAt).getTime() < e && new Date(a.endsAt).getTime() > s).length;
    if (taken >= capacity) return { resource, taken, capacity };
  }
  return null;
}

/**
 * @param {object} args
 * @param {object} args.business  { hours, settings }
 * @param {object} args.service   { id, durationMin, bufferMin, resourceIds? } — or a bundle { id, ids: [...], durationMin: total, bufferMin: the last one's, resourceIds: the union }
 * @param {object[]} args.staff   active people [{ id, serviceIds, schedule, bookable }]
 * @param {object[]} args.appointments  on that day (and the night before), any status but CANCELLED: [{ staffId, startsAt, endsAt, resourceIds? }]
 * @param {object[]} args.timeOff [{ staffId|null, startsAt, endsAt }]
 * @param {object[]} [args.resources]  the business's live rooms / devices [{ id, capacity, active }] — a start is refused while a needed one is full
 * @param {object[]} [args.classes]  open classes touching the day [{ id, serviceId, staffId, startsAt, endsAt, seats, booked, resourceIds, status }]
 * @param {string} args.date  YYYY-MM-DD (Tbilisi)
 * @param {Date} [args.now]
 * @param {string|null} [args.staffId]  a chosen person, or null for anyone
 * @param {boolean} [args.ignoreLead]  the business books for a walk-in (no lead time, no horizon)
 * @returns {{ slots: Array<{ time: string, startsAt: string, staffIds: string[], classId?: string, seats?: number, seatsLeft?: number, booked?: number }>, closed: boolean, reason?: string }}
 */
export function slotsForDay({ business, service, staff, appointments = [], timeOff = [], resources = [], classes = [], date, now = new Date(), staffId = null, ignoreLead = false }) {
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

  const wanted = serviceIdsOf(service);
  const people = (staff ?? []).filter((s) => s && s.active !== false && s.bookable !== false && wanted.every((id) => performs(s, id)) && (!staffId || s.id === staffId));
  if (!people.length) return { slots: [], closed: true, reason: staffId ? 'staff' : 'no-staff' };

  const toMin = (iso) => (new Date(iso).getTime() - dayStart) / MIN;
  // Classes block their trainer and hold their rooms like bookings do; attendee rows add nothing on top.
  const blockers = [...appointments, ...classBlocks(classes)];
  // A room or device is shared by everyone: whether a start is blocked by one is the same for every person.
  const needed = Array.isArray(service?.resourceIds) ? service.resourceIds.filter(Boolean) : [];
  const resourceFull = new Map();
  const blockedByResource = (start) => {
    if (!needed.length) return false;
    if (!resourceFull.has(start)) resourceFull.set(start, Boolean(resourceConflict(blockers, resources, { resourceIds: needed, startsAt: dayStart + start * MIN, endsAt: dayStart + (start + duration) * MIN, bufferMin: buffer })));
    return resourceFull.get(start);
  };
  // A class service: its own open classes of the day are offered as „join“ slots while a seat is free (to the
  // class's trainer, never to anyone else); with a timetable the free grid is not offered at all.
  const isClass = seatsOf(service).seats > 1 && wanted.length === 1;
  const joinable = isClass
    ? (classes ?? []).filter((c) => c && c.status !== 'CANCELLED' && c.serviceId === wanted[0] && c.staffId && (!staffId || c.staffId === staffId)
      && seatsLeft(c) > 0 && tbilisiYmd(new Date(c.startsAt)) === date && new Date(c.startsAt).getTime() >= earliest)
    : [];
  const gridOff = isClass && Boolean(service?.scheduled);
  const byTime = new Map();
  let anyWorking = false;
  for (const person of people) {
    let free = staffWorkingRanges(person, business?.hours, weekday);
    if (!free.length) continue;
    anyWorking = true;
    if (gridOff) continue;
    for (const off of timeOff) {
      if (off.staffId && off.staffId !== person.id) continue;
      free = subtractRange(free, toMin(off.startsAt), toMin(off.endsAt));
    }
    for (const a of blockers) {
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
        if (blockedByResource(start)) continue;
        const key = start;
        const slot = byTime.get(key) ?? { time: clockLabel(start), startsAt: new Date(at).toISOString(), staffIds: [] };
        slot.staffIds.push(person.id);
        byTime.set(key, slot);
      }
    }
  }
  for (const c of joinable) {
    const start = toMin(c.startsAt);
    const slot = byTime.get(start) ?? { time: clockLabel(start), startsAt: iso(c.startsAt), staffIds: [] };
    if (!slot.staffIds.includes(c.staffId)) slot.staffIds.push(c.staffId);
    // Two classes of the same service at one minute (two trainers): the slot names the one with more seats free.
    const { seats, booked, left } = seatsOf(c);
    if (!slot.classId || left > slot.seatsLeft) Object.assign(slot, { classId: c.id, seats, seatsLeft: left, booked });
    byTime.set(start, slot);
  }
  if (!anyWorking && !joinable.length) return { slots: [], closed: true, reason: 'closed' };
  const slots = [...byTime.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s);
  return { slots, closed: false };
}

/** Days in the horizon that have at least one slot (for the date strip). Cheap: reuses one appointment list. */
export function daysWithSlots({ business, service, staff, appointments, timeOff, resources = [], classes = [], from, now = new Date(), staffId = null, days = 14 }) {
  const out = [];
  const touches = (x, date) => tbilisiYmd(new Date(x.startsAt)) === date || tbilisiYmd(new Date(x.endsAt)) === date;
  for (let i = 0; i < days; i += 1) {
    const date = addDaysYmd(from, i);
    const dayAppointments = appointments.filter((a) => touches(a, date));
    const dayClasses = (classes ?? []).filter((c) => touches(c, date));
    const dayOff = timeOff.filter((o) => new Date(o.startsAt).getTime() < tbilisiInstant(date, 24 * 60).getTime() && new Date(o.endsAt).getTime() > tbilisiInstant(date, 0).getTime());
    const r = slotsForDay({ business, service, staff, appointments: dayAppointments, timeOff: dayOff, resources, classes: dayClasses, date, now, staffId });
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
