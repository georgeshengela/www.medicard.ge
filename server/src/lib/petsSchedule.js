import { createHash } from 'node:crypto';
import { addCalendarMonths, addCalendarWeeks, addDays, compareYmd, compareYmdTime, maxYmd, parseYmd } from './petsCivilDate.js';

export const CARE_KINDS = Object.freeze(['VACCINATION', 'FLEA_TICK', 'DEWORMING', 'MEDICATION', 'OTHER']);
export const RECURRENCE_KINDS = Object.freeze(['ONCE', 'EVERY_N_DAYS', 'EVERY_N_WEEKS', 'EVERY_N_MONTHS', 'DAILY_COURSE']);
export const RECURRENCE_BASES = Object.freeze(['NONE', 'FIXED_CALENDAR', 'FROM_ADMINISTRATION']);
export const SCHEDULE_STATUSES = Object.freeze(['ACTIVE', 'COMPLETED', 'CANCELLED']);
export const OCCURRENCE_STATUSES = Object.freeze(['OPEN', 'ADMINISTERED', 'SKIPPED', 'CANCELLED']);
export const EVENT_STATUSES = Object.freeze(['RECORDED', 'VOIDED']);
export const CARE_SOURCES = Object.freeze(['VETERINARIAN', 'PRODUCT_INSTRUCTIONS', 'USER_ENTERED']);
export const CARE_ROUTES = Object.freeze(['oral', 'topical', 'injection', 'other', 'unknown']);
export const TIME_MODES = Object.freeze(['DATE_BASED', 'EXACT_TIME']);

export const OVERDUE_LOOKBACK_DAYS = 14;
export const MAX_OVERDUE = 3;
export const UPCOMING_DAYS = 60;
export const UPCOMING_LIMIT = 40;
export const ENUMERATE_HARD_CAP = 200;

export function occurrenceKey({ revision, plannedOn, plannedTime, sequence }) {
  return `r${revision}|${plannedOn}|${plannedTime || 'date'}|${sequence}`;
}

export function phase5ReminderIdentity({ userId, petId, scheduleId, occurrenceKey, alertKind = 'due' }) {
  return `pets:${userId}:${petId}:${scheduleId}:${occurrenceKey}:${alertKind}`;
}

export function buildOccurrence(schedule, { plannedOn, plannedTime, sequence }) {
  const key = occurrenceKey({
    revision: schedule.revision,
    plannedOn,
    plannedTime: plannedTime || null,
    sequence,
  });
  return {
    scheduleId: schedule.id || null,
    revision: schedule.revision,
    plannedOn,
    plannedTime: plannedTime || null,
    sequence,
    occurrenceKey: key,
    reminderIdentity:
      schedule.userId && schedule.petId && schedule.id
        ? phase5ReminderIdentity({
            userId: schedule.userId,
            petId: schedule.petId,
            scheduleId: schedule.id,
            occurrenceKey: key,
          })
        : null,
    reminderEnabled: Boolean(schedule.reminderEnabled),
  };
}

export function parseOccurrenceKey(key) {
  if (typeof key !== 'string') return null;
  const match = /^r(\d+)\|(\d{4}-\d{2}-\d{2})\|([^|]+)\|(\d+)$/.exec(key);
  if (!match) return null;
  return {
    revision: Number(match[1]),
    plannedOn: match[2],
    plannedTime: match[3] === 'date' ? null : match[3],
    sequence: Number(match[4]),
  };
}

export function sortedTimes(times) {
  if (!Array.isArray(times)) return [];
  return [...new Set(times.filter(Boolean))].sort();
}

export function courseLimitReached(schedule, sequenceOrCount) {
  if (schedule.occurrenceLimit == null) return false;
  return sequenceOrCount >= schedule.occurrenceLimit;
}

export function pastCourseEnd(schedule, plannedOn) {
  if (!schedule.courseEndsOn) return false;
  return plannedOn > schedule.courseEndsOn;
}

function intervalDateFromStart(schedule, sequence) {
  const n = schedule.intervalCount;
  if (schedule.recurrenceKind === 'ONCE') return schedule.startOn;
  if (schedule.recurrenceKind === 'EVERY_N_DAYS') return addDays(schedule.startOn, n * sequence);
  if (schedule.recurrenceKind === 'EVERY_N_WEEKS') return addCalendarWeeks(schedule.startOn, n * sequence);
  if (schedule.recurrenceKind === 'EVERY_N_MONTHS') {
    return addCalendarMonths(schedule.startOn, n * sequence, schedule.anchorDay);
  }
  return null;
}

export function addIntervalToDate(ymd, schedule) {
  const n = schedule.intervalCount;
  if (schedule.recurrenceKind === 'EVERY_N_DAYS') return addDays(ymd, n);
  if (schedule.recurrenceKind === 'EVERY_N_WEEKS') return addCalendarWeeks(ymd, n);
  if (schedule.recurrenceKind === 'EVERY_N_MONTHS') {
    const parsed = parseYmd(ymd);
    const anchor = schedule.recurrenceBasis === 'FROM_ADMINISTRATION' && parsed ? parsed.day : schedule.anchorDay;
    return addCalendarMonths(ymd, n, anchor);
  }
  return null;
}

export function enumerateSeries(schedule, { to, limit = ENUMERATE_HARD_CAP } = {}) {
  const out = [];
  if (!schedule?.startOn) return out;
  const times = schedule.recurrenceKind === 'DAILY_COURSE' ? sortedTimes(schedule.times) : null;

  if (schedule.recurrenceKind === 'DAILY_COURSE') {
    let date = schedule.startOn;
    let count = 0;
    while (date && (!to || date <= to) && count < limit && out.length < ENUMERATE_HARD_CAP) {
      if (pastCourseEnd(schedule, date)) break;
      for (const time of times) {
        if (courseLimitReached(schedule, count)) return out;
        out.push(buildOccurrence(schedule, { plannedOn: date, plannedTime: time, sequence: count }));
        count += 1;
        if (out.length >= limit) return out;
      }
      date = addDays(date, 1);
    }
    return out;
  }

  let sequence = 0;
  while (out.length < limit && out.length < ENUMERATE_HARD_CAP) {
    if (courseLimitReached(schedule, sequence)) break;
    const plannedOn = intervalDateFromStart(schedule, sequence);
    if (!plannedOn) break;
    if (to && plannedOn > to) break;
    if (pastCourseEnd(schedule, plannedOn)) break;
    out.push(
      buildOccurrence(schedule, {
        plannedOn,
        plannedTime: schedule.dueTime || null,
        sequence,
      }),
    );
    if (schedule.recurrenceKind === 'ONCE') break;
    sequence += 1;
  }
  return out;
}

export function nextInFixedSeries(schedule, planned) {
  if (schedule.recurrenceKind === 'ONCE') return null;
  if (schedule.recurrenceKind === 'DAILY_COURSE') {
    const times = sortedTimes(schedule.times);
    const nextSeq = planned.sequence + 1;
    if (courseLimitReached(schedule, nextSeq)) return null;
    const dayIndex = Math.floor(nextSeq / times.length);
    const timeIndex = nextSeq % times.length;
    const plannedOn = addDays(schedule.startOn, dayIndex);
    if (!plannedOn || pastCourseEnd(schedule, plannedOn)) return null;
    return buildOccurrence(schedule, { plannedOn, plannedTime: times[timeIndex], sequence: nextSeq });
  }
  const nextSeq = planned.sequence + 1;
  if (courseLimitReached(schedule, nextSeq)) return null;
  const plannedOn = intervalDateFromStart(schedule, nextSeq);
  if (!plannedOn || pastCourseEnd(schedule, plannedOn)) return null;
  return buildOccurrence(schedule, {
    plannedOn,
    plannedTime: schedule.dueTime || null,
    sequence: nextSeq,
  });
}

/**
 * Late FIXED_CALENDAR completion must not reset the calendar series.
 * FROM_ADMINISTRATION advances from the confirmed administration date.
 */
export function nextAfterCompletion(schedule, { planned, administeredOn }) {
  if (schedule.recurrenceKind === 'ONCE') return null;
  if (schedule.recurrenceKind === 'DAILY_COURSE') {
    return nextInFixedSeries(schedule, planned);
  }
  if (schedule.recurrenceBasis === 'FROM_ADMINISTRATION') {
    const nextSeq = planned.sequence + 1;
    if (courseLimitReached(schedule, nextSeq)) return null;
    const plannedOn = addIntervalToDate(administeredOn, schedule);
    if (!plannedOn || pastCourseEnd(schedule, plannedOn)) return null;
    return buildOccurrence(schedule, {
      plannedOn,
      plannedTime: schedule.dueTime || null,
      sequence: nextSeq,
    });
  }
  return nextInFixedSeries(schedule, planned);
}

export function generateOccurrences(
  schedule,
  {
    today,
    to,
    resolvedKeys = new Set(),
    maxOverdue = MAX_OVERDUE,
    overdueLookbackDays = OVERDUE_LOOKBACK_DAYS,
    upcomingLimit = UPCOMING_LIMIT,
  } = {},
) {
  const empty = { overdue: [], due: [], upcoming: [] };
  if (!schedule || schedule.status !== 'ACTIVE') return empty;
  const horizon = to || addDays(today, UPCOMING_DAYS);
  const overdueFrom = maxYmd(schedule.startOn, addDays(today, -overdueLookbackDays));

  let series;
  if (schedule.recurrenceBasis === 'FROM_ADMINISTRATION') {
    if (!schedule.nextDueOn) return empty;
    series = [
      buildOccurrence(schedule, {
        plannedOn: schedule.nextDueOn,
        plannedTime: schedule.nextDueTime || schedule.dueTime || null,
        sequence: schedule.nextSequence ?? 0,
      }),
    ];
  } else {
    series = enumerateSeries(schedule, { to: horizon, limit: ENUMERATE_HARD_CAP });
  }

  const overdue = [];
  const due = [];
  const upcoming = [];
  for (const occurrence of series) {
    if (resolvedKeys.has(occurrence.occurrenceKey)) continue;
    if (occurrence.plannedOn < today) {
      if (occurrence.plannedOn < overdueFrom) continue;
      overdue.push(occurrence);
    } else if (occurrence.plannedOn === today) {
      due.push(occurrence);
    } else if (occurrence.plannedOn <= horizon) {
      upcoming.push(occurrence);
    }
  }

  return {
    overdue: overdue.slice(-maxOverdue),
    due,
    upcoming: upcoming.slice(0, upcomingLimit),
  };
}

export function isGeneratedOccurrence(schedule, parsed, { today } = {}) {
  if (!parsed || parsed.revision !== schedule.revision) return false;
  if (schedule.recurrenceBasis === 'FROM_ADMINISTRATION') {
    return (
      parsed.plannedOn === schedule.nextDueOn &&
      (parsed.plannedTime || null) === (schedule.nextDueTime || schedule.dueTime || null) &&
      parsed.sequence === (schedule.nextSequence ?? 0)
    );
  }
  const horizon = addDays(today || parsed.plannedOn, UPCOMING_DAYS);
  const to = parsed.plannedOn > horizon ? parsed.plannedOn : horizon;
  const series = enumerateSeries(schedule, { to, limit: ENUMERATE_HARD_CAP });
  return series.some(
    (row) =>
      row.occurrenceKey ===
      occurrenceKey({
        revision: schedule.revision,
        plannedOn: parsed.plannedOn,
        plannedTime: parsed.plannedTime,
        sequence: parsed.sequence,
      }),
  );
}

export function derivedNextFromSeries(schedule, resolvedKeys, today) {
  const generated = generateOccurrences(schedule, { today, resolvedKeys });
  const next = generated.overdue[0] || generated.due[0] || generated.upcoming[0] || null;
  return next;
}

export function scheduleDerivedFields(schedule, next) {
  if (!next) {
    return {
      nextDueOn: null,
      nextDueTime: null,
      nextSequence: null,
      status: 'COMPLETED',
    };
  }
  return {
    nextDueOn: next.plannedOn,
    nextDueTime: next.plannedTime,
    nextSequence: next.sequence,
    status: 'ACTIVE',
  };
}

export function nextAfterVoidingAdministration(schedule, remainingEvents) {
  const recorded = [...remainingEvents]
    .filter((row) => row.status === 'RECORDED')
    .sort((a, b) => compareYmdTime(a.administeredOn, a.administeredTime, b.administeredOn, b.administeredTime));
  if (!recorded.length) {
    return buildOccurrence(schedule, {
      plannedOn: schedule.startOn,
      plannedTime: schedule.dueTime || null,
      sequence: 0,
    });
  }
  const last = recorded[recorded.length - 1];
  return nextAfterCompletion(schedule, {
    planned: { sequence: recorded.length - 1, plannedOn: last.administeredOn, plannedTime: last.administeredTime },
    administeredOn: last.administeredOn,
  });
}

export function canonicalCarePayload(payload) {
  const keys = Object.keys(payload).sort();
  const obj = {};
  for (const key of keys) {
    const value = payload[key];
    if (value === undefined) continue;
    obj[key] = value === undefined ? null : value;
  }
  return JSON.stringify(obj);
}

export function carePayloadHash(payload) {
  return createHash('sha256').update(canonicalCarePayload(payload)).digest('hex');
}

export function idempotencyDecision(existingHash, nextHash) {
  if (!existingHash || existingHash === nextHash) return 'replay';
  return 'conflict';
}

export function completePayloadHash(input) {
  return carePayloadHash({
    occurrenceKey: input.occurrenceKey,
    revision: input.revision,
    administeredOn: input.administeredOn,
    administeredTime: input.administeredTime || null,
    notes: input.notes || null,
    dose: input.dose || null,
    doseUnit: input.doseUnit || null,
    route: input.route || null,
  });
}

export function eventPayloadHash(input) {
  return carePayloadHash({
    kind: input.kind,
    productId: input.productId || null,
    title: input.title,
    administeredOn: input.administeredOn,
    administeredTime: input.administeredTime || null,
    notes: input.notes || null,
    dose: input.dose || null,
    doseUnit: input.doseUnit || null,
    route: input.route || null,
    createSchedule: Boolean(input.createSchedule),
  });
}

export function sortOccurrences(rows) {
  return [...rows].sort((a, b) => {
    const cmp = compareYmdTime(a.plannedOn, a.plannedTime, b.plannedOn, b.plannedTime);
    if (cmp !== 0) return cmp;
    return a.sequence - b.sequence;
  });
}

export function compareYmdSafe(a, b) {
  return compareYmd(a, b);
}
