/**
 * Pregnancy care planner — timing merge, summary, write validation.
 * Reuses Phase 18 presentPregnancyDating. Does not compute a second GA.
 */

import { daysBetween, todayInTimeZone } from './cycle.js';
import {
  PREGNANCY_CARE_CATALOG_REVIEWED_AT,
  PREGNANCY_CARE_CATALOG_SOURCE_SET,
  PREGNANCY_CARE_CATALOG_VERSION,
  PREGNANCY_CARE_NOTE_MAX,
  PREGNANCY_CARE_USER_STATUSES,
  careWindowRelation,
  isCivilDateKey,
  isRenderableCareItem,
  pregnancyCareItemById,
  pregnancyCareSourceById,
  renderablePregnancyCareItems,
} from '../../../mobile/src/lib/pregnancyCareCatalog.js';
import {
  isClockTime,
  rejectMalformedPlannedTime,
  resolvePlannedDateAndTime,
} from '../../../mobile/src/lib/pregnancyCareAppointmentTimeContract.js';
import {
  normalizePlannedPlace,
  resolvePlannedDateAndPlace,
} from '../../../mobile/src/lib/pregnancyCareVisitPlaceContract.js';
import {
  EXACT_REMINDER_DEFAULT_MINUTES,
  REMINDER_MODE,
  canonicalizeReminderMode,
  isExactReminderOffsetMinutes,
  isPregnancyCareReminderOffset,
  normalizeExactReminderOffsetMinutes,
  normalizeReminderOffset,
  reminderPreviewFromSchedule,
  resolvePrenatalCareReminderSchedule,
} from '../../../mobile/src/lib/pregnancyCareReminderContract.js';

export const CYCLE_PREGNANCY_CARE_PLAN_HTTP_PATH = '/pregnancy/care-plan';

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function shapeSources(refs) {
  return (refs || [])
    .map((id) => pregnancyCareSourceById(id))
    .filter((src) => src && src.organization && src.title && src.reviewedAt && src.url)
    .map((src) => ({
      organization: src.organization,
      title: src.title,
      reviewedAt: src.reviewedAt,
      url: src.url,
    }));
}

function shapeUserState(row) {
  if (!row) return null;
  const status = PREGNANCY_CARE_USER_STATUSES.includes(row.status) ? row.status : null;
  if (!status) return null;
  return {
    status,
    plannedDate: isCivilDateKey(row.plannedDate) ? row.plannedDate : null,
    plannedTime:
      isCivilDateKey(row.plannedDate) && isClockTime(row.plannedTime) ? row.plannedTime : null,
    plannedPlace:
      isCivilDateKey(row.plannedDate) && typeof row.plannedPlace === 'string' && row.plannedPlace
        ? row.plannedPlace
        : null,
    completedDate: isCivilDateKey(row.completedDate) ? row.completedDate : null,
    note: typeof row.note === 'string' && row.note ? row.note.slice(0, PREGNANCY_CARE_NOTE_MAX) : null,
    reminderEnabled: Boolean(row.reminderEnabled) && status === 'PLANNED' && isCivilDateKey(row.plannedDate),
    reminderOffset: isPregnancyCareReminderOffset(row.reminderOffset)
      ? Number(row.reminderOffset)
      : 1,
    reminderMode: canonicalizeReminderMode(row.reminderMode),
    exactReminderOffsetMinutes: isExactReminderOffsetMinutes(row.exactReminderOffsetMinutes)
      ? Number(row.exactReminderOffsetMinutes)
      : null,
    reminderPreview:
      Boolean(row.reminderEnabled) && status === 'PLANNED' && isCivilDateKey(row.plannedDate)
        ? reminderPreviewFromSchedule(
            resolvePrenatalCareReminderSchedule({
              plannedDate: isCivilDateKey(row.plannedDate) ? row.plannedDate : null,
              plannedTime: row.plannedTime,
              reminderEnabled: row.reminderEnabled,
              reminderOffset: row.reminderOffset,
              reminderMode: row.reminderMode,
              exactReminderOffsetMinutes: row.exactReminderOffsetMinutes,
            }),
            new Date(),
          )
        : null,
  };
}

function completedWeekOnDate(referenceDate, date) {
  if (!isCivilDateKey(referenceDate) || !isCivilDateKey(date)) return null;
  const elapsed = daysBetween(referenceDate, date);
  if (!Number.isInteger(elapsed) || elapsed < 0) return null;
  return Math.floor(elapsed / 7);
}

function isPlannedDateOutsideCatalogWindow({ plannedDate, referenceDate, startWeek, endWeek }) {
  if (!plannedDate) return false;
  const week = completedWeekOnDate(referenceDate, plannedDate);
  if (week == null) return true;
  return week < startWeek || week > endWeek;
}

function stateMap(states) {
  const map = new Map();
  for (const row of states || []) {
    if (row?.careItemId) map.set(row.careItemId, row);
  }
  return map;
}

export function presentPregnancyCareItem({ item, dating, reviewRequired, userState, pregnancyActive } = {}) {
  if (!isRenderableCareItem(item)) return null;
  const sources = shapeSources(item.sourceRefs);
  if (!sources.length) return null;
  const personalized = Boolean(pregnancyActive) && !reviewRequired;
  const week = dating?.estimatedGestationalAge?.week;
  const relation = personalized
    ? careWindowRelation({
        week,
        startWeek: item.startWeek,
        endWeek: item.endWeek,
        reviewRequired: false,
      })
    : null;
  const state = shapeUserState(userState);
  return {
    id: item.id,
    category: item.category,
    titleKey: item.titleKey,
    descriptionKey: item.descriptionKey,
    whyKey: item.whyKey,
    disclaimerKey: item.disclaimerKey,
    optional: Boolean(item.optional),
    regionalVariation: Boolean(item.regionalVariation),
    timing: {
      startWeek: item.startWeek,
      endWeek: item.endWeek,
      relation,
      type: item.timingType || 'WINDOW',
    },
    plannedDateOutsideWindow: isPlannedDateOutsideCatalogWindow({
      plannedDate: state?.plannedDate,
      referenceDate: dating?.referenceDate,
      startWeek: item.startWeek,
      endWeek: item.endWeek,
    }),
    sources,
    userState: state,
  };
}

export function presentPregnancyCarePlan({
  mode,
  pregnancyActive,
  dating,
  states = [],
  episodeId = null,
} = {}) {
  const catalogVersion = PREGNANCY_CARE_CATALOG_VERSION;
  const reviewRequired = Boolean(dating?.reviewRequired);
  const active = Boolean(pregnancyActive) && mode === 'PREGNANCY';
  const byId = stateMap(states);
  const items = renderablePregnancyCareItems()
    .map((item) =>
      presentPregnancyCareItem({
        item,
        dating,
        reviewRequired,
        userState: byId.get(item.id) || null,
        pregnancyActive: active,
      }),
    )
    .filter(Boolean);

  return {
    version: catalogVersion,
    reviewedAt: PREGNANCY_CARE_CATALOG_REVIEWED_AT,
    sourceSet: PREGNANCY_CARE_CATALOG_SOURCE_SET,
    available: active,
    personalized: active && !reviewRequired,
    reviewRequired: active && reviewRequired,
    pregnancyActive: active,
    pregnancyEpisodeId: active ? episodeId || null : null,
    items,
  };
}

function isHiddenStatus(status) {
  return status === 'DISMISSED' || status === 'NOT_APPLICABLE' || status === 'COMPLETED';
}

export function pickCarePlannerNext(plan) {
  if (!plan?.personalized) return null;
  const items = plan.items || [];
  const inWindow = items.find(
    (row) => row.timing?.relation === 'IN_WINDOW' && !isHiddenStatus(row.userState?.status),
  );
  if (inWindow) return inWindow;
  const planned = items.filter((row) => row.userState?.status === 'PLANNED');
  const dated = planned
    .filter((row) => row.userState?.plannedDate)
    .sort((a, b) => a.userState.plannedDate.localeCompare(b.userState.plannedDate));
  if (dated[0]) return dated[0];
  if (planned[0]) return planned[0];
  const upcoming = items
    .filter((row) => row.timing?.relation === 'BEFORE_WINDOW' && !isHiddenStatus(row.userState?.status))
    .sort((a, b) => a.timing.startWeek - b.timing.startWeek || a.id.localeCompare(b.id));
  return upcoming[0] || null;
}

export function buildPregnancyCarePlannerSummary(plan) {
  if (!plan) {
    return {
      available: false,
      personalized: false,
      reviewRequired: false,
      catalogVersion: PREGNANCY_CARE_CATALOG_VERSION,
      next: null,
    };
  }
  const next = pickCarePlannerNext(plan);
  return {
    available: Boolean(plan.available),
    personalized: Boolean(plan.personalized),
    reviewRequired: Boolean(plan.reviewRequired),
    catalogVersion: plan.version,
    next: next
      ? {
          id: next.id,
          titleKey: next.titleKey,
          startWeek: next.timing.startWeek,
          endWeek: next.timing.endWeek,
          relation: plan.personalized ? next.timing.relation : null,
          status: next.userState?.status || null,
        }
      : null,
  };
}

export function validateCarePlanWrite(body = {}, { today, careItemId } = {}) {
  const item = pregnancyCareItemById(careItemId);
  if (!item || !isRenderableCareItem(item)) {
    throw httpError('ეს მოვლის პუნქტი არ არსებობს.', 404);
  }
  const status = body.status;
  if (status === 'CLEAR' || status === null) {
    return { action: 'CLEAR', careItemId };
  }
  if (!PREGNANCY_CARE_USER_STATUSES.includes(status)) {
    throw httpError('მდგომარეობა არასწორია.', 400);
  }
  const plannedDate =
    body.plannedDate === null || body.plannedDate === ''
      ? null
      : body.plannedDate === undefined
        ? undefined
        : body.plannedDate;
  const completedDate =
    body.completedDate === null || body.completedDate === ''
      ? null
      : body.completedDate === undefined
        ? undefined
        : body.completedDate;
  if (plannedDate !== undefined && plannedDate !== null && !isCivilDateKey(plannedDate)) {
    throw httpError('დაგეგმილი თარიღი არასწორია.', 400);
  }
  let plannedTime =
    body.plannedTime === null || body.plannedTime === ''
      ? null
      : body.plannedTime === undefined
        ? undefined
        : body.plannedTime;
  if (plannedTime !== undefined && plannedTime !== null) {
    try {
      plannedTime = rejectMalformedPlannedTime(plannedTime);
    } catch {
      throw httpError('დაგეგმილი დრო არასწორია.', 400);
    }
  }
  if (plannedDate === null) plannedTime = null;
  let plannedPlace =
    body.plannedPlace === undefined
      ? undefined
      : body.plannedPlace === null || body.plannedPlace === ''
        ? null
        : body.plannedPlace;
  if (plannedPlace !== undefined && plannedPlace !== null) {
    try {
      plannedPlace = normalizePlannedPlace(plannedPlace);
    } catch (err) {
      throw httpError(err.message || 'ვიზიტის ადგილი არასწორია.', err.status || 400);
    }
  }
  if (plannedDate === null) plannedPlace = null;
  if (completedDate !== undefined && completedDate !== null && !isCivilDateKey(completedDate)) {
    throw httpError('დასრულების თარიღი არასწორია.', 400);
  }
  let note = body.note;
  if (note === undefined) note = undefined;
  else if (note === null || note === '') note = null;
  else if (typeof note !== 'string') {
    throw httpError('შენიშვნა არასწორია.', 400);
  } else if (note.length > PREGNANCY_CARE_NOTE_MAX) {
    throw httpError('შენიშვნა ძალიან გრძელია.', 400);
  }

  const todayKey = today || todayInTimeZone();
  let nextCompleted = completedDate;
  if (status === 'COMPLETED' && (nextCompleted === undefined || nextCompleted === null)) {
    nextCompleted = todayKey;
  }

  let reminderEnabled = body.reminderEnabled;
  if (reminderEnabled === undefined) reminderEnabled = undefined;
  else reminderEnabled = Boolean(reminderEnabled);

  let reminderOffset = body.reminderOffset;
  if (reminderOffset === undefined || reminderOffset === null || reminderOffset === '') {
    reminderOffset = undefined;
  } else if (!isPregnancyCareReminderOffset(reminderOffset)) {
    throw httpError('შეხსენების დრო არასწორია.', 400);
  } else {
    reminderOffset = Number(reminderOffset);
  }

  let reminderMode = body.reminderMode;
  if (reminderMode === undefined || reminderMode === null || reminderMode === '') {
    reminderMode = undefined;
  } else if (reminderMode !== REMINDER_MODE.DATE_BASED && reminderMode !== REMINDER_MODE.EXACT_TIME) {
    throw httpError('შეხსენების რეჟიმი არასწორია.', 400);
  }

  let exactReminderOffsetMinutes = body.exactReminderOffsetMinutes;
  if (exactReminderOffsetMinutes === undefined || exactReminderOffsetMinutes === '') {
    exactReminderOffsetMinutes = undefined;
  } else if (exactReminderOffsetMinutes === null) {
    exactReminderOffsetMinutes = null;
  } else if (!isExactReminderOffsetMinutes(exactReminderOffsetMinutes)) {
    throw httpError('შეხსენების დრო არასწორია.', 400);
  } else {
    exactReminderOffsetMinutes = Number(exactReminderOffsetMinutes);
  }

  return {
    action: 'UPSERT',
    careItemId,
    status,
    plannedDate,
    plannedTime,
    plannedPlace,
    completedDate: nextCompleted,
    note,
    reminderEnabled,
    reminderOffset,
    reminderMode,
    exactReminderOffsetMinutes,
    catalogVersion: PREGNANCY_CARE_CATALOG_VERSION,
  };
}

export function resolveCarePlanTimeFields({ parsed, existing } = {}) {
  return resolvePlannedDateAndTime({
    plannedDate: parsed.plannedDate,
    plannedTime: parsed.plannedTime,
    existing,
  });
}

export function resolveCarePlanPlaceFields({ parsed, existing, plannedDate } = {}) {
  return resolvePlannedDateAndPlace({
    plannedDate: plannedDate === undefined ? parsed?.plannedDate : plannedDate,
    plannedPlace: parsed?.plannedPlace,
    existing,
  }).plannedPlace;
}

export function resolveCarePlanReminderFields({ parsed, existing, plannedTime } = {}) {
  const plannedDate =
    parsed.plannedDate === undefined ? existing?.plannedDate ?? null : parsed.plannedDate;
  const nextTime =
    plannedTime !== undefined
      ? plannedTime
      : parsed.plannedTime === undefined
        ? existing?.plannedTime ?? null
        : parsed.plannedTime;
  const status = parsed.status;
  let reminderEnabled =
    parsed.reminderEnabled === undefined ? Boolean(existing?.reminderEnabled) : parsed.reminderEnabled;
  let reminderOffset =
    parsed.reminderOffset === undefined
      ? existing?.reminderOffset ?? 1
      : parsed.reminderOffset;
  let reminderMode =
    parsed.reminderMode === undefined
      ? canonicalizeReminderMode(existing?.reminderMode)
      : canonicalizeReminderMode(parsed.reminderMode);
  let exactReminderOffsetMinutes =
    parsed.exactReminderOffsetMinutes === undefined
      ? existing?.exactReminderOffsetMinutes ?? null
      : parsed.exactReminderOffsetMinutes;

  if (status !== 'PLANNED' || !isCivilDateKey(plannedDate)) {
    reminderEnabled = false;
    reminderMode = REMINDER_MODE.DATE_BASED;
    exactReminderOffsetMinutes = null;
  }

  if (reminderMode === REMINDER_MODE.EXACT_TIME && !isClockTime(nextTime)) {
    reminderEnabled = false;
    reminderMode = REMINDER_MODE.DATE_BASED;
    exactReminderOffsetMinutes = null;
  }

  if (reminderEnabled && reminderMode === REMINDER_MODE.EXACT_TIME) {
    if (parsed.reminderMode === REMINDER_MODE.EXACT_TIME && parsed.exactReminderOffsetMinutes === undefined) {
      exactReminderOffsetMinutes = normalizeExactReminderOffsetMinutes(existing?.exactReminderOffsetMinutes);
    }
    if (!isExactReminderOffsetMinutes(exactReminderOffsetMinutes)) {
      exactReminderOffsetMinutes = EXACT_REMINDER_DEFAULT_MINUTES;
    }
  }

  if (
    reminderEnabled &&
    reminderMode === REMINDER_MODE.DATE_BASED &&
    parsed.reminderEnabled === true &&
    parsed.reminderOffset === undefined
  ) {
    reminderOffset = normalizeReminderOffset(existing?.reminderOffset);
  }
  if (reminderEnabled && reminderMode === REMINDER_MODE.DATE_BASED && !isPregnancyCareReminderOffset(reminderOffset)) {
    reminderOffset = 1;
  }
  if (!reminderEnabled) {
    reminderOffset = isPregnancyCareReminderOffset(reminderOffset) ? Number(reminderOffset) : 1;
  }

  return {
    plannedDate,
    reminderEnabled,
    reminderOffset: Number(reminderOffset),
    reminderMode,
    exactReminderOffsetMinutes:
      reminderMode === REMINDER_MODE.EXACT_TIME && isExactReminderOffsetMinutes(exactReminderOffsetMinutes)
        ? Number(exactReminderOffsetMinutes)
        : null,
  };
}

export function serializeCarePlanStateForExport(row) {
  if (!row) return null;
  return {
    careItemId: row.careItemId,
    status: row.status,
    plannedDate: row.plannedDate || null,
    plannedTime: isClockTime(row.plannedTime) && isCivilDateKey(row.plannedDate) ? row.plannedTime : null,
    plannedPlace:
      isCivilDateKey(row.plannedDate) && typeof row.plannedPlace === 'string' && row.plannedPlace
        ? row.plannedPlace
        : null,
    completedDate: row.completedDate || null,
    note: row.note || null,
    reminderEnabled: Boolean(row.reminderEnabled),
    reminderOffset: isPregnancyCareReminderOffset(row.reminderOffset) ? Number(row.reminderOffset) : 1,
    reminderMode: canonicalizeReminderMode(row.reminderMode),
    exactReminderOffsetMinutes: isExactReminderOffsetMinutes(row.exactReminderOffsetMinutes)
      ? Number(row.exactReminderOffsetMinutes)
      : null,
    catalogVersion: row.catalogVersion || PREGNANCY_CARE_CATALOG_VERSION,
    pregnancyEpisodeId: row.pregnancyEpisodeId || null,
  };
}

export async function loadPregnancyCarePlanStates(prisma, { userId, episodeId } = {}) {
  if (!episodeId || !userId) return [];
  try {
    return await prisma.pregnancyCarePlanItemState.findMany({
      where: { userId, pregnancyEpisodeId: episodeId },
    });
  } catch {
    return [];
  }
}
