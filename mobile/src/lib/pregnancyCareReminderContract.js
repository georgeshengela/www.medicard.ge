/**
 * Phase 33 — user-opted prenatal care reminders.
 * Phase 36 — optional EXACT_TIME mode when owner entered plannedDate + plannedTime.
 *
 * USER_PLANNED_EVENT only. Never MEDICAL_DUE_ITEM.
 * Catalog windows never create a candidate.
 * Notification Brain remains the fire-time authority.
 * DATE_BASED ignores plannedTime (09:00). Adding plannedTime never auto-upgrades.
 */

import {
  CYCLE_REMINDER_HOUR,
  CYCLE_REMINDER_MINUTE,
  getEffectiveCycleMask,
  maskedCopyIsSafe,
} from './cycleNotificationContract.js';
import { isCivilDateKey, isRenderableCareItem, pregnancyCareItemById } from './pregnancyCareCatalog.js';
import {
  clockToMinutes,
  formatClockTime,
  isClockTime,
  parseClockTime,
  resolvePlannedTime,
} from './pregnancyCareAppointmentTimeContract.js';

export const PREGNANCY_CARE_REMINDER_TYPE = 'pregnancy_care_plan';
export const PREGNANCY_CARE_REMINDER_FAMILY = 'pregnancyCareReminder';
export const PREGNANCY_CARE_REMINDER_MEANING = 'USER_PLANNED_EVENT';
export const PREGNANCY_CARE_REMINDER_OFFSETS = Object.freeze([0, 1, 3]);
export const PREGNANCY_CARE_REMINDER_DEFAULT_OFFSET = 1;
export const PREGNANCY_CARE_REMINDER_TEMPLATE = 'pregnancy-care-plan';
export const PREGNANCY_CARE_REMINDER_MASKED_TEMPLATE = 'pregnancy-care-masked';

export const REMINDER_MODE = Object.freeze({
  DATE_BASED: 'DATE_BASED',
  EXACT_TIME: 'EXACT_TIME',
});

export const EXACT_REMINDER_OFFSET_MINUTES = Object.freeze([0, 30, 60, 120]);
export const EXACT_REMINDER_DEFAULT_MINUTES = 60;

export const PREGNANCY_CARE_REMINDER_SUPPRESSION = Object.freeze({
  USER_DISABLED: 'USER_DISABLED',
  NO_PLANNED_DATE: 'NO_PLANNED_DATE',
  NO_PLANNED_TIME: 'NO_PLANNED_TIME',
  NOT_PLANNED: 'NOT_PLANNED',
  COMPLETED: 'COMPLETED',
  DISMISSED: 'DISMISSED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  CLEARED: 'CLEARED',
  DATE_CHANGED: 'DATE_CHANGED',
  TIME_CHANGED: 'TIME_CHANGED',
  OFFSET_CHANGED: 'OFFSET_CHANGED',
  MODE_CHANGED: 'MODE_CHANGED',
  PAST_DATE: 'PAST_DATE',
  LATE_CATCH_UP: 'LATE_CATCH_UP',
  MODE_EXIT: 'MODE_EXIT',
  EPISODE_ENDED: 'EPISODE_ENDED',
  CROSS_USER: 'CROSS_USER',
  ITEM_REMOVED: 'ITEM_REMOVED',
  INVALID_OFFSET: 'INVALID_OFFSET',
  NONEXISTENT_LOCAL_TIME: 'NONEXISTENT_LOCAL_TIME',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
});

export function isPregnancyCareReminderOffset(value) {
  return PREGNANCY_CARE_REMINDER_OFFSETS.includes(Number(value));
}

export function normalizeReminderOffset(value) {
  const n = Number(value);
  return isPregnancyCareReminderOffset(n) ? n : PREGNANCY_CARE_REMINDER_DEFAULT_OFFSET;
}

export function canonicalizeReminderMode(value) {
  return value === REMINDER_MODE.EXACT_TIME ? REMINDER_MODE.EXACT_TIME : REMINDER_MODE.DATE_BASED;
}

export function isExactReminderOffsetMinutes(value) {
  if (value === null || value === undefined || value === '') return false;
  return EXACT_REMINDER_OFFSET_MINUTES.includes(Number(value));
}

export function normalizeExactReminderOffsetMinutes(value) {
  return isExactReminderOffsetMinutes(value) ? Number(value) : EXACT_REMINDER_DEFAULT_MINUTES;
}

export function addingPlannedTimeAutoUpgradesReminder() {
  return false;
}

export function exactTimeRequiresExplicitSelection() {
  return true;
}

export function reminderSchedulingUsesPlannedTime(state) {
  return canonicalizeReminderMode(state?.reminderMode) === REMINDER_MODE.EXACT_TIME;
}

function addDaysCivil(key, days) {
  const [y, m, d] = String(key).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate(),
  ).padStart(2, '0')}`;
}

export function reminderFireCivilDate(plannedDate, offset) {
  if (!isCivilDateKey(plannedDate) || !isPregnancyCareReminderOffset(offset)) return null;
  return addDaysCivil(plannedDate, -Number(offset));
}

export function reminderLocalFireDate(eventDate, { hour = CYCLE_REMINDER_HOUR, minute = CYCLE_REMINDER_MINUTE } = {}) {
  if (!isCivilDateKey(eventDate)) return null;
  const [y, m, d] = eventDate.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

export function isLateCatchUp({ eventDate, now }) {
  const fire = reminderLocalFireDate(eventDate);
  if (!fire || !now) return false;
  return fire.getTime() <= new Date(now).getTime();
}

export function subtractMinutesFromWallClock(civilDate, clock, minutes) {
  if (!isCivilDateKey(civilDate) || !isClockTime(clock) || !Number.isInteger(Number(minutes))) return null;
  const start = clockToMinutes(clock);
  if (start == null) return null;
  const delta = Number(minutes);
  const total = start - delta;
  if (total >= 0) {
    return { civilDate, clock: formatClockTime(Math.floor(total / 60), total % 60) };
  }
  const wrap = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return {
    civilDate: addDaysCivil(civilDate, -1),
    clock: formatClockTime(Math.floor(wrap / 60), wrap % 60),
  };
}

function wallParts(ms, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const map = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    h: Number(map.hour) % 24,
    min: Number(map.minute),
  };
}

/**
 * Interpret civil date + HH:mm as a local wall-clock instant.
 * Device/Brain path omits timeZone and uses the runtime local Date constructor.
 * DST gap (non-existent): fail closed. DST overlap (ambiguous): first occurrence (ICU / Date local).
 */
export function wallClockInstant(civilDate, clock, timeZone) {
  if (!isCivilDateKey(civilDate) || !isClockTime(clock)) return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.NOT_ELIGIBLE };
  const parsed = parseClockTime(clock);
  const [y, mo, d] = civilDate.split('-').map(Number);
  if (!timeZone) {
    const dt = new Date(y, mo - 1, d, parsed.hour, parsed.minute, 0, 0);
    if (
      dt.getFullYear() !== y ||
      dt.getMonth() !== mo - 1 ||
      dt.getDate() !== d ||
      dt.getHours() !== parsed.hour ||
      dt.getMinutes() !== parsed.minute
    ) {
      return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.NONEXISTENT_LOCAL_TIME };
    }
    return { ok: true, ms: dt.getTime(), date: dt };
  }
  const want = { y, m: mo, d, h: parsed.hour, min: parsed.minute };
  let instant = Date.UTC(y, mo - 1, d, parsed.hour, parsed.minute, 0);
  for (let i = 0; i < 4; i += 1) {
    const got = wallParts(instant, timeZone);
    const gotUtc = Date.UTC(got.y, got.m - 1, got.d, got.h, got.min);
    const wantUtc = Date.UTC(want.y, want.m - 1, want.d, want.h, want.min);
    instant += wantUtc - gotUtc;
  }
  const got = wallParts(instant, timeZone);
  if (got.y !== want.y || got.m !== want.m || got.d !== want.d || got.h !== want.h || got.min !== want.min) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.NONEXISTENT_LOCAL_TIME };
  }
  const earlier = instant - 60 * 60 * 1000;
  const earlierParts = wallParts(earlier, timeZone);
  if (
    earlierParts.y === want.y &&
    earlierParts.m === want.m &&
    earlierParts.d === want.d &&
    earlierParts.h === want.h &&
    earlierParts.min === want.min
  ) {
    instant = earlier;
  }
  return { ok: true, ms: instant, date: new Date(instant) };
}

/**
 * Canonical prenatal care reminder schedule. Server/Brain owns fire math.
 * Mobile displays this result; it does not invent a second engine.
 */
export function resolvePrenatalCareReminderSchedule(state = {}, live = {}) {
  const mode = canonicalizeReminderMode(state?.reminderMode);
  const plannedDate = isCivilDateKey(state?.plannedDate) ? state.plannedDate : null;
  const plannedTime = resolvePlannedTime({ plannedDate, plannedTime: state?.plannedTime });
  const offsetDays = isPregnancyCareReminderOffset(state?.reminderOffset)
    ? Number(state.reminderOffset)
    : PREGNANCY_CARE_REMINDER_DEFAULT_OFFSET;
  const offsetMinutes = isExactReminderOffsetMinutes(state?.exactReminderOffsetMinutes)
    ? Number(state.exactReminderOffsetMinutes)
    : EXACT_REMINDER_DEFAULT_MINUTES;

  if (mode === REMINDER_MODE.DATE_BASED) {
    const eventDate = reminderFireCivilDate(plannedDate, offsetDays);
    if (!eventDate) return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.NOT_ELIGIBLE, mode };
    const fireClock = `${String(CYCLE_REMINDER_HOUR).padStart(2, '0')}:${String(CYCLE_REMINDER_MINUTE).padStart(2, '0')}`;
    const wall = wallClockInstant(eventDate, fireClock, live.timeZone);
    if (!wall.ok) return { ...wall, mode };
    return {
      ok: true,
      mode,
      plannedDate,
      plannedTime: null,
      offsetDays,
      offsetMinutes: null,
      eventDate,
      fireCivilDate: eventDate,
      fireClock,
      fireAtMs: wall.ms,
      usesPlannedTime: false,
    };
  }

  if (!plannedDate) return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.NO_PLANNED_DATE, mode };
  if (!plannedTime) return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.NO_PLANNED_TIME, mode };
  if (!isExactReminderOffsetMinutes(state?.exactReminderOffsetMinutes) && state?.exactReminderOffsetMinutes != null) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.INVALID_OFFSET, mode };
  }
  const fire = subtractMinutesFromWallClock(plannedDate, plannedTime, offsetMinutes);
  if (!fire) return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.NOT_ELIGIBLE, mode };
  const wall = wallClockInstant(fire.civilDate, fire.clock, live.timeZone);
  if (!wall.ok) return { ...wall, mode };
  return {
    ok: true,
    mode,
    plannedDate,
    plannedTime,
    offsetDays: null,
    offsetMinutes,
    eventDate: fire.civilDate,
    fireCivilDate: fire.civilDate,
    fireClock: fire.clock,
    fireAtMs: wall.ms,
    usesPlannedTime: true,
  };
}

export function reminderPreviewFromSchedule(schedule, now) {
  if (!schedule?.ok) return null;
  const past = now ? schedule.fireAtMs <= new Date(now).getTime() : false;
  return {
    mode: schedule.mode,
    fireCivilDate: schedule.fireCivilDate,
    fireClock: schedule.fireClock,
    past,
  };
}

export function pregnancyCareReminderCandidateId({
  userId,
  episodeId,
  careItemId,
  plannedDate,
  offset,
  reminderMode,
  plannedTime,
  exactOffsetMinutes,
} = {}) {
  const mode = canonicalizeReminderMode(reminderMode);
  if (mode === REMINDER_MODE.EXACT_TIME) {
    return `pregnancy_care:${userId || ''}:${episodeId || ''}:${careItemId || ''}:${plannedDate || ''}:${plannedTime || ''}:EXACT:${exactOffsetMinutes}`;
  }
  return `pregnancy_care:${userId || ''}:${episodeId || ''}:${careItemId || ''}:${plannedDate || ''}:${offset}`;
}

export function pregnancyCareReminderRoute(careItemId) {
  const id = encodeURIComponent(String(careItemId || ''));
  return `/cycle/pregnancy/care-plan?item=${id}`;
}

export function pregnancyCareReminderCopy({ offset, itemTitle, reminderMode } = {}) {
  const item = String(itemTitle || '').trim() || 'მოვლის პუნქტი';
  if (canonicalizeReminderMode(reminderMode) === REMINDER_MODE.EXACT_TIME) {
    return {
      title: 'შეხსენება',
      body: `შეგახსენებ: შენ დაგეგმე ${item}.`,
    };
  }
  if (Number(offset) === 0) {
    return {
      title: 'შეხსენება',
      body: `შეგახსენებ: შენ დაგეგმე ${item} დღეს.`,
    };
  }
  if (Number(offset) === 1) {
    return {
      title: 'შეხსენება',
      body: `შეგახსენებ: შენ დაგეგმე ${item} ხვალ.`,
    };
  }
  return {
    title: 'შეხსენება',
    body: `შეგახსენებ: შენ დაგეგმე ${item} — დაგეგმილ თარიღამდე ${offset} დღით ადრე.`,
  };
}

export function pregnancyCareMaskedCopy() {
  return {
    title: 'Medi-სგან შეხსენება',
    body: 'შენი დაგეგმილი მოვლის შეხსენება',
  };
}

function statusReason(status) {
  if (status === 'COMPLETED') return PREGNANCY_CARE_REMINDER_SUPPRESSION.COMPLETED;
  if (status === 'DISMISSED') return PREGNANCY_CARE_REMINDER_SUPPRESSION.DISMISSED;
  if (status === 'NOT_APPLICABLE') return PREGNANCY_CARE_REMINDER_SUPPRESSION.NOT_APPLICABLE;
  if (!status) return PREGNANCY_CARE_REMINDER_SUPPRESSION.CLEARED;
  if (status !== 'PLANNED') return PREGNANCY_CARE_REMINDER_SUPPRESSION.NOT_PLANNED;
  return null;
}

export function pregnancyCareReminderEligibility(item, live = {}) {
  if (live.userId && live.candidateUserId && live.userId !== live.candidateUserId) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.CROSS_USER };
  }
  if (live.mode && live.mode !== 'PREGNANCY') {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.MODE_EXIT };
  }
  if (live.pregnancyActive === false || live.episodeStatus === 'ENDED') {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.EPISODE_ENDED };
  }
  const careItemId = item?.id || item?.careItemId;
  const catalog = pregnancyCareItemById(careItemId);
  if (!catalog || !isRenderableCareItem(catalog)) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.ITEM_REMOVED };
  }
  const state = item?.userState || item;
  const blocked = statusReason(state?.status);
  if (blocked) return { ok: false, reason: blocked };
  if (!isCivilDateKey(state?.plannedDate)) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.NO_PLANNED_DATE };
  }
  if (state?.reminderEnabled !== true) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.USER_DISABLED };
  }
  const mode = canonicalizeReminderMode(state?.reminderMode);
  if (mode === REMINDER_MODE.DATE_BASED && !isPregnancyCareReminderOffset(state?.reminderOffset)) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.INVALID_OFFSET };
  }
  const schedule = resolvePrenatalCareReminderSchedule(state, { timeZone: live.timeZone });
  if (!schedule.ok) return { ok: false, reason: schedule.reason };
  if (live.today && schedule.eventDate < live.today && mode === REMINDER_MODE.DATE_BASED) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.PAST_DATE };
  }
  if (live.now) {
    const nowMs = new Date(live.now).getTime();
    if (mode === REMINDER_MODE.DATE_BASED && isLateCatchUp({ eventDate: schedule.eventDate, now: live.now })) {
      return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.LATE_CATCH_UP };
    }
    if (mode === REMINDER_MODE.EXACT_TIME && schedule.fireAtMs <= nowMs) {
      return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.LATE_CATCH_UP };
    }
  }
  return {
    ok: true,
    reason: null,
    eventDate: schedule.eventDate,
    plannedDate: schedule.plannedDate,
    plannedTime: schedule.plannedTime,
    offset: mode === REMINDER_MODE.DATE_BASED ? schedule.offsetDays : schedule.offsetMinutes,
    reminderMode: mode,
    fireClock: schedule.fireClock,
    fireAtMs: schedule.fireAtMs,
    usesPlannedTime: schedule.usesPlannedTime,
  };
}

export function buildPregnancyCareReminderCandidates({
  userId,
  episodeId,
  mode,
  pregnancyActive,
  episodeStatus = 'ACTIVE',
  items = [],
  today,
  now,
  timeZone,
} = {}) {
  if (mode !== 'PREGNANCY' || pregnancyActive === false || episodeStatus !== 'ACTIVE') return [];
  const out = [];
  for (const item of items || []) {
    const check = pregnancyCareReminderEligibility(item, {
      userId,
      mode,
      pregnancyActive,
      episodeStatus,
      today,
      now,
      timeZone,
    });
    if (!check.ok) continue;
    const careItemId = item.id;
    out.push({
      type: PREGNANCY_CARE_REMINDER_TYPE,
      family: PREGNANCY_CARE_REMINDER_FAMILY,
      meaning: PREGNANCY_CARE_REMINDER_MEANING,
      careItemId,
      episodeId,
      userId,
      plannedDate: check.plannedDate,
      plannedTime: check.plannedTime,
      offset: check.offset,
      reminderMode: check.reminderMode,
      eventDate: check.eventDate,
      fireClock: check.fireClock,
      fireAtMs: check.fireAtMs,
      usesPlannedTime: check.usesPlannedTime,
      candidateId: pregnancyCareReminderCandidateId({
        userId,
        episodeId,
        careItemId,
        plannedDate: check.plannedDate,
        offset: check.reminderMode === REMINDER_MODE.DATE_BASED ? check.offset : undefined,
        reminderMode: check.reminderMode,
        plannedTime: check.plannedTime,
        exactOffsetMinutes: check.reminderMode === REMINDER_MODE.EXACT_TIME ? check.offset : undefined,
      }),
      templateKey: PREGNANCY_CARE_REMINDER_TEMPLATE,
      route: pregnancyCareReminderRoute(careItemId),
      notifyEligible: true,
    });
  }
  return out;
}

export function revalidatePregnancyCareReminder(candidate, live = {}) {
  if (!candidate || candidate.type !== PREGNANCY_CARE_REMINDER_TYPE) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.NOT_ELIGIBLE };
  }
  if (live.userId && candidate.userId && live.userId !== candidate.userId) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.CROSS_USER };
  }
  if (live.mode && live.mode !== 'PREGNANCY') {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.MODE_EXIT };
  }
  if (live.pregnancyActive === false || live.episodeStatus === 'ENDED') {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.EPISODE_ENDED };
  }
  if (live.episodeId && candidate.episodeId && live.episodeId !== candidate.episodeId) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.EPISODE_ENDED };
  }
  const item = (live.items || []).find((row) => (row.id || row.careItemId) === candidate.careItemId);
  if (!item) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.CLEARED };
  }
  const check = pregnancyCareReminderEligibility(item, {
    userId: live.userId,
    candidateUserId: candidate.userId,
    mode: live.mode,
    pregnancyActive: live.pregnancyActive,
    episodeStatus: live.episodeStatus,
    today: live.today,
    now: live.now,
    timeZone: live.timeZone,
  });
  if (!check.ok) return check;
  const candidateMode = canonicalizeReminderMode(candidate.reminderMode);
  if (candidateMode !== check.reminderMode) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.MODE_CHANGED };
  }
  if (candidate.plannedDate && candidate.plannedDate !== check.plannedDate) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.DATE_CHANGED };
  }
  if (check.reminderMode === REMINDER_MODE.EXACT_TIME) {
    if ((candidate.plannedTime || null) !== (check.plannedTime || null)) {
      return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.TIME_CHANGED };
    }
  }
  if (candidate.offset != null && Number(candidate.offset) !== Number(check.offset)) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.OFFSET_CHANGED };
  }
  if (candidate.eventDate && candidate.eventDate !== check.eventDate) {
    return { ok: false, reason: PREGNANCY_CARE_REMINDER_SUPPRESSION.DATE_CHANGED };
  }
  return { ok: true, reason: null };
}

export function pregnancyCareReminderDeliveryDecision(candidate, live, mask) {
  const reval = revalidatePregnancyCareReminder(candidate, live);
  if (!reval.ok) return { ...reval, deliver: false, rewriteMasked: false };
  const effective = mask || getEffectiveCycleMask(live);
  if (effective.masked && !candidate.masked) {
    return {
      ok: true,
      reason: 'DELIVER_WITH_DISCREET_COPY',
      deliver: true,
      rewriteMasked: true,
    };
  }
  return {
    ok: true,
    reason: effective.masked ? 'PRIVACY_MASKED' : null,
    deliver: true,
    rewriteMasked: false,
  };
}

export function assertPregnancyCareMaskedCopySafe() {
  const copy = pregnancyCareMaskedCopy();
  return maskedCopyIsSafe(copy.title, copy.body);
}

export function catalogWindowNeverReminds({ relation, userState } = {}) {
  if (userState?.reminderEnabled === true && isCivilDateKey(userState?.plannedDate)) return false;
  return relation === 'IN_WINDOW' || relation === 'BEFORE_WINDOW' || relation === 'AFTER_WINDOW' || !relation;
}

export function exactQuietHoursFollowVisitAlarms() {
  return true;
}

export function dateBasedQuietHoursBump() {
  return true;
}
