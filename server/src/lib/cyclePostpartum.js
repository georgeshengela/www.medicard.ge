/**
 * Postpartum tracking mode — explicit owner-selected context.
 * Not a pregnancy outcome. Does not change forecast arithmetic.
 * Civil dates only (YYYY-MM-DD). Elapsed math lives here, not on mobile.
 */

import { daysBetween, todayInTimeZone } from './cycle.js';
import { capabilitiesForProfileMode } from './cycleModes.js';

export const CYCLE_POSTPARTUM_HTTP_PATH = '/postpartum';
export const POSTPARTUM_TRACKING_CONTEXT = 'POSTPARTUM';
export const POSTPARTUM_EPISODE_ACTIVE = 'ACTIVE';
export const POSTPARTUM_EPISODE_ENDED = 'ENDED';
export const POSTPARTUM_HISTORY_DAYS = 90;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const POSTPARTUM_PRESENTATION_KEYS = Object.freeze([
  'fatigue',
  'dizziness',
  'headache',
  'migraine',
  'swelling',
  'constipation',
  'nausea',
  'frequent_urination',
]);

const BLEED_FLOWS = Object.freeze(['spotting', 'light', 'medium', 'heavy']);

function httpError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

export function isPostpartumProfileMode(mode) {
  return mode === 'POSTPARTUM';
}

export function isPostpartumTrackingContext(value) {
  return value === POSTPARTUM_TRACKING_CONTEXT;
}

export function isCivilDateKey(value) {
  if (!DATE_KEY.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function engineExcludePostpartumClause() {
  return {
    OR: [{ trackingContext: null }, { trackingContext: { not: POSTPARTUM_TRACKING_CONTEXT } }],
  };
}

export function isEngineEligibleLog(log) {
  return !isPostpartumTrackingContext(log?.trackingContext);
}

export function stampPostpartumLogWrite({ mode, episodeId } = {}) {
  if (mode !== 'POSTPARTUM') return {};
  return {
    trackingContext: POSTPARTUM_TRACKING_CONTEXT,
    ...(episodeId ? { postpartumEpisodeId: episodeId } : {}),
  };
}

/**
 * Owner-entered reference only. Never derived from due date, episode end, logs, or AI.
 * Future dates are rejected (not clamped). Null/undefined clears or skips.
 */
export function validatePostpartumReferenceDate(referenceDate, todayKey, { allowEmpty = false } = {}) {
  if (referenceDate == null || referenceDate === '') {
    if (allowEmpty) return { ok: true, referenceDate: null };
    return { ok: false, status: 400, code: 'invalid_date', message: 'საწყისი თარიღი არასწორია.' };
  }
  if (!isCivilDateKey(referenceDate)) {
    return { ok: false, status: 400, code: 'invalid_date', message: 'საწყისი თარიღი არასწორია.' };
  }
  if (!isCivilDateKey(todayKey)) {
    return { ok: false, status: 400, code: 'invalid_today', message: 'დღევანდელი თარიღი არასწორია.' };
  }
  if (referenceDate > todayKey) {
    return {
      ok: false,
      status: 400,
      code: 'future',
      message: 'საწყისი თარიღი მომავალში არ შეიძლება.',
    };
  }
  return { ok: true, referenceDate, elapsed: postpartumElapsed(referenceDate, todayKey) };
}

/**
 * Elapsed civil time from the owner-entered reference.
 * Same civil day = 0 weeks + 0 days. Not recovery progress.
 */
export function postpartumElapsed(referenceDate, todayKey) {
  if (!isCivilDateKey(referenceDate) || !isCivilDateKey(todayKey)) return null;
  if (referenceDate > todayKey) return null;
  const days = daysBetween(referenceDate, todayKey);
  return {
    days,
    week: Math.floor(days / 7),
    day: days % 7,
  };
}

export function shapePostpartumEpisode(episode) {
  if (!episode) return null;
  return {
    id: episode.id ?? null,
    referenceDate: episode.referenceDate ?? null,
    status: episode.status ?? null,
    startedAt: episode.startedAt ?? null,
    endedAt: episode.endedAt ?? null,
  };
}

export async function findActivePostpartumEpisode(prisma, userId) {
  if (!prisma?.cyclePostpartumEpisode || !userId) return null;
  return prisma.cyclePostpartumEpisode.findFirst({
    where: { userId, status: POSTPARTUM_EPISODE_ACTIVE },
  });
}

export async function loadActivePostpartumEpisode(prisma, userId) {
  try {
    return await findActivePostpartumEpisode(prisma, userId);
  } catch {
    return null;
  }
}

/**
 * Mode switch + postpartum episode create/end. Caller wraps with CycleProfile update.
 * Entering requires postpartumConfirm. Leaving ends ACTIVE. Re-entry creates a new episode.
 * Does not attach a pregnancy-outcome reason.
 */
export async function applyPostpartumEpisodeTransition(prisma, {
  userId,
  currentMode,
  nextMode,
  body = {},
  today,
} = {}) {
  const todayKey = today || todayInTimeZone();
  const entering = nextMode === 'POSTPARTUM' && currentMode !== 'POSTPARTUM';
  const leaving = currentMode === 'POSTPARTUM' && nextMode !== 'POSTPARTUM';
  const staying = nextMode === 'POSTPARTUM' && currentMode === 'POSTPARTUM';

  if (entering) {
    if (body.postpartumConfirm !== true) {
      throw httpError('მშობიარობის შემდგომი რეჟიმი მხოლოდ დადასტურებით ირთვება.', 400, 'confirm_required');
    }
    let referenceDate = null;
    if (body.postpartumReferenceDate !== undefined && body.postpartumReferenceDate !== null && body.postpartumReferenceDate !== '') {
      const check = validatePostpartumReferenceDate(body.postpartumReferenceDate, todayKey);
      if (!check.ok) throw httpError(check.message, check.status, check.code);
      referenceDate = check.referenceDate;
    }
    const orphan = await findActivePostpartumEpisode(prisma, userId);
    if (orphan) {
      await prisma.cyclePostpartumEpisode.update({
        where: { id: orphan.id },
        data: { status: POSTPARTUM_EPISODE_ENDED, endedAt: new Date() },
      });
    }
    await prisma.cyclePostpartumEpisode.create({
      data: {
        userId,
        referenceDate,
        status: POSTPARTUM_EPISODE_ACTIVE,
      },
    });
    return { entered: true, left: false, endedEpisodeId: null };
  }

  if (leaving) {
    const active = await findActivePostpartumEpisode(prisma, userId);
    if (active) {
      await prisma.cyclePostpartumEpisode.update({
        where: { id: active.id },
        data: { status: POSTPARTUM_EPISODE_ENDED, endedAt: new Date() },
      });
    }
    return { entered: false, left: true, endedEpisodeId: active?.id || null };
  }

  if (staying && Object.prototype.hasOwnProperty.call(body, 'postpartumReferenceDate')) {
    const check = validatePostpartumReferenceDate(body.postpartumReferenceDate, todayKey, { allowEmpty: true });
    if (!check.ok) throw httpError(check.message, check.status, check.code);
    const active = await findActivePostpartumEpisode(prisma, userId);
    if (!active) {
      throw httpError('აქტიური მშობიარობის შემდგომი ეპიზოდი არ არის.', 404, 'no_episode');
    }
    await prisma.cyclePostpartumEpisode.update({
      where: { id: active.id },
      data: { referenceDate: check.referenceDate },
    });
    return { entered: false, referenceDate: check.referenceDate };
  }

  return { entered: false };
}

function isBleedFlow(flow) {
  return BLEED_FLOWS.includes(flow);
}

function presentTodayObservations(log) {
  if (!log) {
    return {
      flow: null,
      painEntries: [],
      symptoms: [],
      moods: [],
      sleepQuality: null,
      energy: null,
    };
  }
  const symptoms = Array.isArray(log.symptoms)
    ? log.symptoms.filter((key) => POSTPARTUM_PRESENTATION_KEYS.includes(key))
    : [];
  return {
    flow: isBleedFlow(log.flow) ? log.flow : null,
    painEntries: Array.isArray(log.painEntries) ? log.painEntries : [],
    symptoms,
    moods: Array.isArray(log.moods) ? log.moods : [],
    sleepQuality: log.sleepQuality ?? null,
    energy: log.energy ?? log.observations?.energy ?? null,
  };
}

export function presentRecentLog(log, classifiedDateSet) {
  const classified = Boolean(
    log?.date && classifiedDateSet instanceof Set && classifiedDateSet.has(log.date) && isBleedFlow(log.flow) && log.flow !== 'spotting',
  );
  return {
    date: log.date,
    flow: isBleedFlow(log.flow) ? log.flow : null,
    spotting: log.flow === 'spotting',
    symptoms: Array.isArray(log.symptoms)
      ? log.symptoms.filter((key) => POSTPARTUM_PRESENTATION_KEYS.includes(key))
      : [],
    painEntries: Array.isArray(log.painEntries) ? log.painEntries : [],
    moods: Array.isArray(log.moods) ? log.moods : [],
    sleepQuality: log.sleepQuality ?? null,
    energy: log.energy ?? log.observations?.energy ?? null,
    hasNotes: Boolean(log.notes),
    classified,
  };
}

export function buildCyclePostpartumData({
  today,
  profile,
  episode,
  logs = [],
  classifiedDates = [],
  classifiedEpisodes = [],
  latestClassified = null,
  bleedEpisodes = null,
} = {}) {
  const mode = profile?.mode || 'TRACK_PERIOD';
  const active = isPostpartumProfileMode(mode) && episode?.status === POSTPARTUM_EPISODE_ACTIVE;
  const capabilities = capabilitiesForProfileMode(mode);
  const referenceDate = active ? episode?.referenceDate || null : null;
  const elapsed = active && referenceDate ? postpartumElapsed(referenceDate, today) : null;
  const episodeLogs = active
    ? (logs || []).filter((log) => log?.postpartumEpisodeId === episode.id)
    : [];
  const todayLog = (logs || []).find((log) => log.date === today) || null;
  const classifiedSet = new Set(classifiedDates || []);
  const recentLogs = episodeLogs
    .map((log) => presentRecentLog(log, classifiedSet))
    .filter((row) => row.flow || row.symptoms.length || row.painEntries.length || row.moods.length || row.sleepQuality || row.energy || row.hasNotes)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);
  const currentEpisodeClassified = (classifiedEpisodes || []).filter(
    (row) => row.postpartumEpisodeId === episode?.id,
  );
  const presentedBleedEpisodes = Array.isArray(bleedEpisodes)
    ? bleedEpisodes
    : currentEpisodeClassified.map((row) => ({
      start: row.start,
      end: row.end,
      classified: true,
    }));

  return {
    version: 'cycle-postpartum-v1',
    mode,
    active: Boolean(active),
    capabilities,
    episode: active ? shapePostpartumEpisode(episode) : null,
    referenceDate,
    elapsed,
    todayObservations: active ? presentTodayObservations(todayLog) : presentTodayObservations(null),
    recentLogs: active ? recentLogs : [],
    bleedEpisodes: active ? presentedBleedEpisodes : [],
    classifiedDates: active ? (classifiedDates || []).filter((date) => episodeLogs.some((log) => log.date === date)) : [],
    latestClassified: active && latestClassified?.postpartumEpisodeId === episode?.id
      ? { start: latestClassified.start, end: latestClassified.end, source: 'OWNER' }
      : null,
    honesty: {
      notADiagnosis: true,
      notAnOutcome: true,
      referenceOwnerEntered: true,
      referenceOptional: true,
      elapsedNotRecovery: true,
      classificationOwnerEntered: true,
      noFertilityInference: true,
      noOvulationInference: true,
    },
  };
}

export function bundlePostpartumView({ profile, episode, today, classifiedDates = [], latestClassified = null } = {}) {
  if (!isPostpartumProfileMode(profile?.mode)) return null;
  const active = episode?.status === POSTPARTUM_EPISODE_ACTIVE;
  const referenceDate = active ? episode?.referenceDate || null : null;
  return {
    version: 'cycle-postpartum-v1',
    active: Boolean(active),
    referenceDate,
    elapsed: active && referenceDate ? postpartumElapsed(referenceDate, today) : null,
    capabilities: capabilitiesForProfileMode(profile.mode),
    classifiedDates: active ? classifiedDates : [],
    latestClassified: active && latestClassified?.postpartumEpisodeId === episode?.id
      ? { start: latestClassified.start, end: latestClassified.end, source: 'OWNER' }
      : null,
  };
}

export function serializePostpartumEpisodeForExport(row) {
  return {
    id: row.id ?? null,
    referenceDate: row.referenceDate ?? null,
    status: row.status ?? null,
    startedAt: row.startedAt ?? null,
    endedAt: row.endedAt ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}
