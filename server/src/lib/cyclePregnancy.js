/**
 * Pregnancy mode foundation — dating, episode invariants, owner read model.
 * Does not change forecast arithmetic. Does not diagnose pregnancy.
 * Civil dates only (YYYY-MM-DD). Reuse cycle.js daysBetween / addDays.
 */

import { addDays, daysBetween, todayInTimeZone } from './cycle.js';
import { capabilitiesForProfileMode } from './cycleModes.js';
import { isCycleTestResult } from './cycleFertility.js';
import { attachWeekDevelopment } from '../../../mobile/src/lib/pregnancyWeekData.js';
import { presentPregnancyTimeline } from '../../../mobile/src/lib/pregnancyTimelinePresent.js';
import {
  episodeObservationWindow,
  presentPregnancyDay,
  presentPregnancyRecentObservations,
  pregnancyLogQueryFrom,
} from './cyclePregnancyObservations.js';
import { buildPregnancyObservationTrends } from './cyclePregnancyObservationTrends.js';
import {
  buildPregnancyCarePlannerSummary,
  presentPregnancyCarePlan,
} from './pregnancyCarePlan.js';

export const CYCLE_PREGNANCY_HTTP_PATH = '/pregnancy';
export const PREGNANCY_LMP_TO_DUE_DAYS = 280;
/** Inclusive active display ceiling (44 weeks). Beyond this: reviewRequired, no week/day. */
export const PREGNANCY_ACTIVE_MAX_DAYS = 308;
/** Hard reject for a new/updated active reference. */
export const PREGNANCY_REJECT_AFTER_DAYS = 365;
export const PREGNANCY_HISTORY_DAYS = 280;
export const PREGNANCY_REFERENCE_TYPES = Object.freeze(['LMP', 'USER_SELECTED']);
export const PREGNANCY_EPISODE_ACTIVE = 'ACTIVE';
export const PREGNANCY_EPISODE_ENDED = 'ENDED';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function isPregnancyProfileMode(mode) {
  return mode === 'PREGNANCY';
}

export function isPregnancyReferenceType(value) {
  return PREGNANCY_REFERENCE_TYPES.includes(value);
}

export function estimatedDueDateFromReference(referenceDate) {
  if (!DATE_KEY.test(referenceDate)) return null;
  return addDays(referenceDate, PREGNANCY_LMP_TO_DUE_DAYS);
}

/**
 * Completed-week trimester bands (NHS week-number convention).
 * T1: weeks 0–12, T2: 13–26, T3: 27+.
 * Identical values to the previous inline formula in gestationalAgeFromReference.
 */
export function trimesterFromCompletedWeek(week) {
  if (!Number.isInteger(week) || week < 0) return null;
  if (week < 13) return 1;
  if (week < 27) return 2;
  return 3;
}

/**
 * Gestational age from a user-confirmed reference date (typically LMP).
 * Same civil day = 0 weeks + 0 days. Does not imply embryo age.
 */
export function gestationalAgeFromReference(referenceDate, todayKey) {
  if (!DATE_KEY.test(referenceDate) || !DATE_KEY.test(todayKey)) return null;
  const elapsed = daysBetween(referenceDate, todayKey);
  if (elapsed < 0 || elapsed > PREGNANCY_ACTIVE_MAX_DAYS) return null;
  const week = Math.floor(elapsed / 7);
  const day = elapsed % 7;
  return {
    week,
    day,
    dayOfPregnancy: elapsed,
    trimester: trimesterFromCompletedWeek(week),
  };
}

export function pregnancyReferenceSourceLabel(referenceType) {
  if (referenceType === 'LMP') return 'LMP';
  if (referenceType === 'USER_SELECTED') return 'USER_SELECTED';
  return null;
}

/**
 * Validate a pregnancy reference for an ACTIVE episode.
 * Future → 400. Older than 365 days → 400. 309–365 → allowed, reviewRequired.
 */
export function validatePregnancyReferenceDate(referenceDate, todayKey) {
  if (!DATE_KEY.test(referenceDate)) {
    return { ok: false, status: 400, code: 'invalid_date', message: 'ორსულობის საცნობი თარიღი არასწორია.' };
  }
  if (!DATE_KEY.test(todayKey)) {
    return { ok: false, status: 400, code: 'invalid_today', message: 'დღევანდელი თარიღი არასწორია.' };
  }
  const elapsed = daysBetween(referenceDate, todayKey);
  if (elapsed < 0) {
    return { ok: false, status: 400, code: 'future', message: 'ორსულობის საცნობი თარიღი მომავალში ვერ იქნება.' };
  }
  if (elapsed > PREGNANCY_REJECT_AFTER_DAYS) {
    return {
      ok: false,
      status: 400,
      code: 'too_old',
      message: 'ორსულობის საცნობი თარიღი ძალიან ძველია აქტიური რეჟიმისთვის.',
    };
  }
  return {
    ok: true,
    elapsed,
    reviewRequired: elapsed > PREGNANCY_ACTIVE_MAX_DAYS,
  };
}

export function presentPregnancyDating({ referenceDate, referenceType, today } = {}) {
  const todayKey = today || todayInTimeZone();
  const type = isPregnancyReferenceType(referenceType) ? referenceType : null;
  if (!DATE_KEY.test(referenceDate || '') || !type) {
    return {
      referenceDate: referenceDate || null,
      referenceType: type,
      estimatedGestationalAge: null,
      estimatedDueDate: null,
      reviewRequired: true,
      estimated: true,
    };
  }
  const check = validatePregnancyReferenceDate(referenceDate, todayKey);
  if (!check.ok) {
    return {
      referenceDate,
      referenceType: type,
      estimatedGestationalAge: null,
      estimatedDueDate: null,
      reviewRequired: true,
      estimated: true,
      invalid: check.code,
    };
  }
  if (check.reviewRequired) {
    return {
      referenceDate,
      referenceType: type,
      estimatedGestationalAge: null,
      estimatedDueDate: null,
      reviewRequired: true,
      estimated: true,
    };
  }
  const age = gestationalAgeFromReference(referenceDate, todayKey);
  const due = estimatedDueDateFromReference(referenceDate);
  return {
    referenceDate,
    referenceType: type,
    estimatedGestationalAge: age,
    estimatedDueDate: due ? { date: due, estimated: true } : null,
    reviewRequired: false,
    estimated: true,
  };
}

export function civilInRange(date, from, to) {
  return typeof date === 'string' && date >= from && date <= to;
}

function shapeEpisode(row) {
  if (!row) return null;
  return {
    id: row.id,
    referenceDate: row.referenceDate,
    referenceType: row.referenceType,
    status: row.status,
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
    endedAt: row.endedAt ? new Date(row.endedAt).toISOString() : null,
  };
}

export function serializePregnancyEpisodeForExport(row) {
  if (!row) return null;
  return {
    id: row.id,
    referenceDate: row.referenceDate,
    referenceType: row.referenceType,
    status: row.status,
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
    endedAt: row.endedAt ? new Date(row.endedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

function todayFacts(log) {
  if (!log) {
    return {
      flow: null,
      spotting: false,
      painEntries: [],
      symptoms: [],
      pregnancyTest: null,
      hasNotes: false,
    };
  }
  return {
    flow: log.flow || null,
    spotting: log.flow === 'spotting',
    painEntries: Array.isArray(log.painEntries) ? log.painEntries : [],
    symptoms: Array.isArray(log.symptoms) ? log.symptoms : [],
    pregnancyTest: isCycleTestResult(log.pregnancyTest) ? log.pregnancyTest : null,
    hasNotes: Boolean(log.notes),
  };
}

export function buildCyclePregnancyData({
  today,
  profile = {},
  episode = null,
  logs = [],
  carePlanStates = [],
} = {}) {
  const to = today;
  const from = pregnancyLogQueryFrom({ episode, today, historyDays: PREGNANCY_HISTORY_DAYS });
  const windowLogs = (logs || []).filter((log) => civilInRange(log.date, from, to));
  const observationWindow = episodeObservationWindow({ episode, today });
  const capabilities = capabilitiesForProfileMode(profile.mode);
  const active = isPregnancyProfileMode(profile.mode);
  const dating = episode
    ? presentPregnancyDating({
        referenceDate: episode.referenceDate,
        referenceType: episode.referenceType,
        today,
      })
    : {
        referenceDate: null,
        referenceType: null,
        estimatedGestationalAge: null,
        estimatedDueDate: null,
        reviewRequired: Boolean(active),
        estimated: true,
      };

  const spottingHistory = windowLogs
    .filter((log) => log.flow === 'spotting' || log.flow === 'light' || log.flow === 'medium' || log.flow === 'heavy')
    .map((log) => ({
      date: log.date,
      flow: log.flow,
      spotting: log.flow === 'spotting',
      source: 'USER_LOGGED',
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const pregnancyTestHistory = windowLogs
    .filter((log) => isCycleTestResult(log.pregnancyTest))
    .map((log) => ({
      date: log.date,
      result: log.pregnancyTest,
      source: 'USER_LOGGED',
      doesNotConfirmMode: true,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const recentLogs = windowLogs
    .filter((log) => {
      if (log.flow) return true;
      if (Array.isArray(log.symptoms) && log.symptoms.length) return true;
      if (Array.isArray(log.painEntries) && log.painEntries.length) return true;
      if (isCycleTestResult(log.pregnancyTest)) return true;
      if (log.notes) return true;
      return false;
    })
    .map((log) => ({
      date: log.date,
      flow: log.flow || null,
      spotting: log.flow === 'spotting',
      symptoms: Array.isArray(log.symptoms) ? log.symptoms : [],
      painEntries: Array.isArray(log.painEntries) ? log.painEntries : [],
      pregnancyTest: isCycleTestResult(log.pregnancyTest) ? log.pregnancyTest : null,
      hasNotes: Boolean(log.notes),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const todayLog = windowLogs.find((log) => log.date === today) || null;
  const recentObservations = observationWindow.empty
    ? []
    : presentPregnancyRecentObservations(windowLogs, {
        from: observationWindow.from,
        to: observationWindow.to,
        includeIntimate: true,
      });
  const todayObservations = presentPregnancyDay(todayLog, { includeIntimate: false });

  return {
    version: 'cycle-pregnancy-v1',
    mode: profile.mode || 'TRACK_PERIOD',
    pregnancyActive: active && Boolean(episode && episode.status === PREGNANCY_EPISODE_ACTIVE),
    capabilities,
    range: { from, to, queryDays: PREGNANCY_HISTORY_DAYS },
    episode: shapeEpisode(episode),
    referenceDate: dating.referenceDate,
    referenceType: dating.referenceType,
    estimatedGestationalAge: dating.estimatedGestationalAge,
    estimatedDueDate: dating.estimatedDueDate,
    reviewRequired: Boolean(dating.reviewRequired),
    weekDevelopment: active ? attachWeekDevelopment(dating) : null,
    timeline: presentPregnancyTimeline({
      mode: profile.mode,
      pregnancyActive: active && Boolean(episode && episode.status === PREGNANCY_EPISODE_ACTIVE),
      dating,
    }),
    carePlannerSummary: buildPregnancyCarePlannerSummary(
      presentPregnancyCarePlan({
        mode: profile.mode,
        pregnancyActive: active && Boolean(episode && episode.status === PREGNANCY_EPISODE_ACTIVE),
        dating,
        episodeId: episode?.id || null,
        states: carePlanStates,
      }),
    ),
    estimated: true,
    honesty: {
      notADiagnosis: true,
      testIsNotMode: true,
      estimated: true,
      sourceExplicit: Boolean(dating.referenceType),
    },
    todayLogged: todayFacts(todayLog),
    todayObservations,
    spottingHistory,
    pregnancyTestHistory,
    recentLogs,
    recentObservations,
    observationRange: {
      from: observationWindow.from,
      to: observationWindow.to,
      queryDays: 90,
    },
    observationTrends: buildPregnancyObservationTrends({
      logs: windowLogs,
      today,
      episode,
      pregnancyActive: active && Boolean(episode && episode.status === PREGNANCY_EPISODE_ACTIVE),
    }),
  };
}

export function bundlePregnancyView({ profile, episode, today } = {}) {
  if (!isPregnancyProfileMode(profile?.mode)) return null;
  const dating = episode
    ? presentPregnancyDating({
        referenceDate: episode.referenceDate,
        referenceType: episode.referenceType,
        today,
      })
    : presentPregnancyDating({
        referenceDate: null,
        referenceType: null,
        today,
      });
  return {
    dueDate: dating.estimatedDueDate?.date || null,
    age: dating.estimatedGestationalAge,
    referenceDate: dating.referenceDate,
    referenceType: dating.referenceType,
    estimated: true,
    reviewRequired: Boolean(dating.reviewRequired),
  };
}

async function findActiveEpisode(prisma, userId) {
  return prisma.cyclePregnancyEpisode.findFirst({
    where: { userId, status: PREGNANCY_EPISODE_ACTIVE },
    orderBy: { startedAt: 'desc' },
  });
}

export async function loadActivePregnancyEpisode(prisma, userId) {
  try {
    return await findActiveEpisode(prisma, userId);
  } catch {
    return null;
  }
}

/**
 * Mode switch + episode create/end. Caller wraps with CycleProfile update in one transaction.
 * Entering PREGNANCY requires pregnancyConfirm + reference date. Leaving ends the ACTIVE episode.
 */
export async function applyPregnancyEpisodeTransition(prisma, {
  userId,
  currentMode,
  nextMode,
  body = {},
  today,
} = {}) {
  const todayKey = today || todayInTimeZone();
  const entering = nextMode === 'PREGNANCY' && currentMode !== 'PREGNANCY';
  const leaving = currentMode === 'PREGNANCY' && nextMode !== 'PREGNANCY';
  const staying = nextMode === 'PREGNANCY' && currentMode === 'PREGNANCY';

  let derivedDueDate;

  if (entering) {
    if (body.pregnancyConfirm !== true) {
      throw httpError('ორსულობის რეჟიმი მხოლოდ დადასტურებით ირთვება.', 400);
    }
    const referenceType = isPregnancyReferenceType(body.pregnancyReferenceType)
      ? body.pregnancyReferenceType
      : 'LMP';
    const referenceDate = body.pregnancyReferenceDate;
    const check = validatePregnancyReferenceDate(referenceDate, todayKey);
    if (!check.ok) throw httpError(check.message, check.status);

    const orphan = await findActiveEpisode(prisma, userId);
    if (orphan) {
      await prisma.cyclePregnancyEpisode.update({
        where: { id: orphan.id },
        data: { status: PREGNANCY_EPISODE_ENDED, endedAt: new Date() },
      });
    }

    await prisma.cyclePregnancyEpisode.create({
      data: {
        userId,
        referenceDate,
        referenceType,
        status: PREGNANCY_EPISODE_ACTIVE,
      },
    });
    derivedDueDate = estimatedDueDateFromReference(referenceDate);
    return { dueDate: derivedDueDate };
  }

  if (leaving) {
    const active = await findActiveEpisode(prisma, userId);
    if (active) {
      await prisma.cyclePregnancyEpisode.update({
        where: { id: active.id },
        data: { status: PREGNANCY_EPISODE_ENDED, endedAt: new Date() },
      });
    }
    return { dueDate: undefined };
  }

  if (staying && body.pregnancyReferenceDate) {
    const referenceType = isPregnancyReferenceType(body.pregnancyReferenceType)
      ? body.pregnancyReferenceType
      : undefined;
    const check = validatePregnancyReferenceDate(body.pregnancyReferenceDate, todayKey);
    if (!check.ok) throw httpError(check.message, check.status);
    const active = await findActiveEpisode(prisma, userId);
    if (!active) {
      if (body.pregnancyConfirm !== true) {
        throw httpError('ორსულობის რეჟიმი მხოლოდ დადასტურებით ირთვება.', 400);
      }
      await prisma.cyclePregnancyEpisode.create({
        data: {
          userId,
          referenceDate: body.pregnancyReferenceDate,
          referenceType: referenceType || 'LMP',
          status: PREGNANCY_EPISODE_ACTIVE,
        },
      });
    } else {
      await prisma.cyclePregnancyEpisode.update({
        where: { id: active.id },
        data: {
          referenceDate: body.pregnancyReferenceDate,
          ...(referenceType ? { referenceType } : {}),
        },
      });
    }
    derivedDueDate = estimatedDueDateFromReference(body.pregnancyReferenceDate);
    return { dueDate: derivedDueDate };
  }

  return { dueDate: undefined };
}
