/**
 * Cycle notification contract (Phase 4).
 * Pure helpers — no engine math, no second scheduler, no AI.
 *
 * Calendar reminders stay user-configured local alarms (09:00).
 * Notification Brain is the delivery-time authority (revalidation + mask).
 * Late status is representable but never notify-eligible.
 */

export const CYCLE_REMINDER_HOUR = 9;
export const CYCLE_REMINDER_MINUTE = 0;
export const LATE_NOTIFY_ELIGIBLE = false;

/**
 * `period_late` (brief §9 item 5): a scheduled check-in N days after the estimated start when no bleeding
 * was logged — „სავარაუდო თარიღი გავიდა — ყველაფერი რიგზეა?“. It is a calendar reminder like period_start,
 * not the `late` status (which stays represent-only).
 */
export const PERIOD_LATE_AFTER_DAYS = 2;

/**
 * Variable cycles (server `predictions.nextPeriodRange`, brief §9 item 12): „მალე“ counts from the window's
 * first day, „გვიანდება“ from its last day + PERIOD_LATE_AFTER_DAYS (owner decision 2026-10-04: 2 days).
 * Without a window both use the single estimate, as before.
 */
export function periodReminderAnchors(nextPeriodStart, nextPeriodRange) {
  if (!nextPeriodStart) return { soonFrom: null, lateFrom: null, bleedFrom: null };
  const range = nextPeriodRange && nextPeriodRange.from && nextPeriodRange.to ? nextPeriodRange : null;
  return {
    soonFrom: range ? range.from : nextPeriodStart,
    lateFrom: range ? range.to : nextPeriodStart,
    // Bleeding logged anywhere in the window means the period came.
    bleedFrom: range && range.from < nextPeriodStart ? range.from : nextPeriodStart,
  };
}

/**
 * Perimenopause (W3-4, brief §9 „მერე“ item 7): the next period is only a window, so the one period
 * reminder is „მალე“ — `periodDaysBefore` before the window's first day. No „today“ (that would be a
 * single date), no „late“ check-in and no late status (late alerts are noise in this mode).
 */
export function perimenopausePeriodSoonDate(nextPeriodRange, periodDaysBefore) {
  if (!nextPeriodRange?.from || !nextPeriodRange?.to || !(periodDaysBefore > 0)) return null;
  return addDaysUtc(nextPeriodRange.from, -periodDaysBefore);
}

/** Forecast honesty: before 3 completed cycles no fertile / ovulation reminder (server `predictions.fertility`). */
export const FERTILITY_LEARNING_SKIPS = Object.freeze(['ovulation', 'fertile', 'pms', 'opk']);

export const CYCLE_CANDIDATE_TYPES = Object.freeze([
  'period_start',
  'period_soon',
  'period_late',
  'ovulation',
  'fertile',
  'pms',
  'opk',
  'bbt',
  'log_nudge',
  'late',
]);

/** Higher wins when several Cycle reminders share a civil date. */
export const CYCLE_SAME_DAY_PRIORITY = Object.freeze({
  period_start: 100,
  period_late: 95,
  period_soon: 90,
  ovulation: 80,
  fertile: 70,
  pms: 60,
  opk: 50,
  bbt: 40,
  log_nudge: 30,
  late: 0,
});

export const FERTILITY_CYCLE_TYPES = Object.freeze(['ovulation', 'fertile', 'pms', 'opk', 'bbt']);
export const PREDICTION_CYCLE_TYPES = Object.freeze(['period_start', 'period_soon', 'period_late', 'ovulation', 'fertile', 'pms']);

export const CYCLE_TEMPLATE_BY_TYPE = Object.freeze({
  period_start: 'cycle-period-start',
  period_soon: 'cycle-period-soon',
  period_late: 'cycle-period-late',
  ovulation: 'cycle-ovulation',
  fertile: 'cycle-fertile',
  pms: 'cycle-pms',
  opk: 'cycle-opk',
  bbt: 'cycle-bbt',
  log_nudge: 'cycle-log',
  late: 'cycle-masked',
});

export const CYCLE_ROUTE_BY_TYPE = Object.freeze({
  period_start: '/cycle/log',
  period_soon: '/cycle',
  period_late: '/cycle',
  ovulation: '/cycle/log',
  fertile: '/cycle',
  pms: '/cycle',
  opk: '/cycle/log',
  bbt: '/cycle/log',
  log_nudge: '/cycle/log',
  late: '/cycle',
});

export const CYCLE_SUPPRESSION = Object.freeze({
  USER_DISABLED: 'USER_DISABLED',
  GLOBAL_DISABLED: 'GLOBAL_DISABLED',
  STALE_PREDICTION: 'STALE_PREDICTION',
  PERIOD_STARTED: 'PERIOD_STARTED',
  CONTRACEPTION_SUPPRESSED: 'CONTRACEPTION_SUPPRESSED',
  PREGNANCY_SUPPRESSED: 'PREGNANCY_SUPPRESSED',
  PERIMENOPAUSE_SUPPRESSED: 'PERIMENOPAUSE_SUPPRESSED',
  POSTPARTUM_SUPPRESSED: 'POSTPARTUM_SUPPRESSED',
  FORECAST_GATE_SUPPRESSED: 'FORECAST_GATE_SUPPRESSED',
  /** Fewer than 3 completed cycles: no fertile / ovulation reminder yet. */
  FERTILITY_LEARNING: 'FERTILITY_LEARNING',
  DUPLICATE: 'DUPLICATE',
  COOLDOWN: 'COOLDOWN',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
  QUIET_HOURS: 'QUIET_HOURS',
  FREQUENCY_CAP: 'FREQUENCY_CAP',
});

const BLEED = new Set(['light', 'medium', 'heavy']);

const MASK_LEAK = [
  'მენსტრუაც',
  'ოვულაც',
  'ნაყოფიერ',
  'ორსულ',
  'სიმპტომ',
  'pms',
  'period',
  'fertil',
  'ovulat',
  'pregnan',
  'menstru',
  'spotting',
  'bbt',
  'opk',
];

export function isBleedFlow(flow) {
  return BLEED.has(flow);
}

export function cycleCandidateId(type, eventDate) {
  return `cycle:${type}:${eventDate}`;
}

export function isCyclePushKey(key) {
  const k = String(key || '');
  return k.startsWith('cycle-') || k.startsWith('cycle:') || k.startsWith('pregnancy-care');
}

export function isFertilityCycleType(type) {
  return FERTILITY_CYCLE_TYPES.includes(type);
}

/**
 * privacyEnabled: CycleProfile broad privacy (synced).
 * maskNotifications: explicit Cycle lock-screen preference (device).
 * discreet: global Medi engage discreet preference (device).
 *
 * Stored fields are never rewritten. Effective mask is derived.
 */
export function getEffectiveCycleMask({
  privacyEnabled = false,
  maskNotifications = false,
  discreet = false,
} = {}) {
  if (maskNotifications) {
    return { masked: true, source: 'maskNotifications' };
  }
  if (privacyEnabled) {
    return { masked: true, source: 'privacyEnabled' };
  }
  if (discreet) {
    return { masked: true, source: 'discreet' };
  }
  return { masked: false, source: null };
}

export function maskedCopyIsSafe(title, body) {
  const hay = `${title ?? ''} ${body ?? ''}`.toLowerCase();
  return !MASK_LEAK.some((needle) => hay.includes(needle));
}

export function redactCyclePushLog({ key, title, body }) {
  if (!isCyclePushKey(key) && String(key || '') !== 'cycle_reminder') {
    return { key, title, body };
  }
  return {
    key,
    title: '[cycle-redacted]',
    body: '[cycle-redacted]',
  };
}

export function cyclePushPayload(candidate, { masked = false, rewrite = false } = {}) {
  return {
    type: 'cycle_reminder',
    family: 'cycleReminder',
    candidateId: candidate.candidateId,
    candidateType: candidate.type,
    eventDate: candidate.eventDate,
    templateKey: masked ? 'cycle-masked' : candidate.templateKey,
    route: candidate.route,
    estimated: Boolean(candidate.estimated),
    predicted: Boolean(candidate.predicted),
    masked: Boolean(masked),
    rewrite: Boolean(rewrite),
    revalidationKey: candidate.revalidationKey,
  };
}

export function resolveCycleDeliveryCopy({ masked, realCopy, maskedCopy }) {
  if (masked) {
    return {
      title: maskedCopy.title,
      body: maskedCopy.body,
      templateKey: 'cycle-masked',
      masked: true,
    };
  }
  return {
    title: realCopy.title,
    body: realCopy.body,
    templateKey: realCopy.templateKey,
    masked: false,
  };
}

function addDaysUtc(key, days) {
  const [y, m, d] = String(key).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function inLoggedBleed(logs, date) {
  return (logs || []).some((row) => row.date === date && isBleedFlow(row.flow));
}

function hasLogOn(logs, date) {
  return (logs || []).some((row) => row.date === date);
}

function bleedLoggedSince(logs, fromDate) {
  return (logs || []).some((row) => row.date >= fromDate && isBleedFlow(row.flow));
}

/**
 * Structured Cycle facts for Brain / local scheduler.
 * notifyEligible false means "represent, do not send".
 */
export function buildCycleCandidates({
  today,
  mode = 'TRACK_PERIOD',
  predictions = {},
  logs = [],
  prefs = {},
  showFertilityMarkers = true,
  lateStatus = null,
  forecastAllowed = true,
  /** `predictions.fertility.status` (or the mobile mirror): LEARNING skips fertile / ovulation reminders. */
  fertilityStatus = null,
} = {}) {
  const candidates = [];
  const estimated = predictions.estimated !== false;
  const push = (partial) => {
    const type = partial.type;
    const eventDate = partial.eventDate;
    if (!type || !eventDate) return;
    candidates.push({
      type,
      eventDate,
      candidateId: cycleCandidateId(type, eventDate),
      templateKey: CYCLE_TEMPLATE_BY_TYPE[type],
      route: CYCLE_ROUTE_BY_TYPE[type],
      priority: CYCLE_SAME_DAY_PRIORITY[type] ?? 0,
      estimated,
      predicted: PREDICTION_CYCLE_TYPES.includes(type),
      privacyClass: 'cycle',
      urgency: type === 'late' ? 'status' : 'reminder',
      notifyEligible: partial.notifyEligible !== false,
      revalidationKey: partial.revalidationKey,
      class: partial.class,
    });
  };

  if (mode !== 'PREGNANCY' && mode !== 'PERIMENOPAUSE' && mode !== 'POSTPARTUM' && forecastAllowed !== false && predictions.nextPeriodStart) {
    const start = predictions.nextPeriodStart;
    const anchors = periodReminderAnchors(start, predictions.nextPeriodRange);
    if ((prefs.periodDaysBefore ?? 0) > 0) {
      push({
        type: 'period_soon',
        eventDate: addDaysUtc(anchors.soonFrom, -prefs.periodDaysBefore),
        revalidationKey: 'nextPeriodStart',
        class: 'calendar',
      });
    }
    push({
      type: 'period_start',
      eventDate: start,
      revalidationKey: 'nextPeriodStart',
      class: 'calendar',
    });
    // Skipped once bleeding is logged on or after the estimated start — the period came, nothing is late.
    if (prefs.periodLate && !bleedLoggedSince(logs, anchors.bleedFrom)) {
      push({
        type: 'period_late',
        eventDate: addDaysUtc(anchors.lateFrom, PERIOD_LATE_AFTER_DAYS),
        revalidationKey: 'nextPeriodStart',
        class: 'calendar',
      });
    }
  }

  if (mode === 'PERIMENOPAUSE' && forecastAllowed !== false) {
    const soon = perimenopausePeriodSoonDate(predictions.nextPeriodRange, prefs.periodDaysBefore ?? 0);
    if (soon) {
      push({ type: 'period_soon', eventDate: soon, revalidationKey: 'nextPeriodRange.from', class: 'calendar' });
    }
  }

  const fertilityOk =
    showFertilityMarkers !== false &&
    mode !== 'PREGNANCY' &&
    mode !== 'PERIMENOPAUSE' &&
    mode !== 'POSTPARTUM' &&
    forecastAllowed !== false &&
    fertilityStatus !== 'LEARNING';
  if (mode === 'TRY_TO_CONCEIVE' && prefs.ovulation && fertilityOk) {
    if (predictions.ovulationDate) {
      push({
        type: 'ovulation',
        eventDate: predictions.ovulationDate,
        revalidationKey: 'ovulationDate',
        class: 'calendar',
      });
    }
    if (predictions.fertileWindow?.start) {
      push({
        type: 'fertile',
        eventDate: predictions.fertileWindow.start,
        revalidationKey: 'fertileWindow.start',
        class: 'calendar',
      });
    }
  }

  if (prefs.pms && fertilityOk && predictions.ovulationDate) {
    push({
      type: 'pms',
      eventDate: addDaysUtc(predictions.ovulationDate, 2),
      revalidationKey: 'ovulationDate',
      class: 'calendar',
    });
  }

  if (mode === 'TRY_TO_CONCEIVE' && prefs.opk && fertilityOk && predictions.fertileWindow?.start) {
    push({
      type: 'opk',
      eventDate: predictions.fertileWindow.start,
      revalidationKey: 'fertileWindow.start',
      class: 'calendar',
    });
  }

  if (mode === 'TRY_TO_CONCEIVE' && prefs.bbt && fertilityOk) {
    const hasBbtToday = (logs || []).some((row) => row.date === today && row.bbt != null);
    if (!hasBbtToday) {
      push({
        type: 'bbt',
        eventDate: today,
        revalidationKey: 'today',
        class: 'calendar',
      });
    }
  }

  if (prefs.dailyLog && !hasLogOn(logs, today)) {
    push({
      type: 'log_nudge',
      eventDate: today,
      revalidationKey: 'today',
      class: 'local_reminder',
    });
  }

  if (lateStatus?.status === 'late' && mode !== 'PERIMENOPAUSE' && mode !== 'POSTPARTUM' && forecastAllowed !== false) {
    push({
      type: 'late',
      eventDate: today,
      notifyEligible: LATE_NOTIFY_ELIGIBLE,
      revalidationKey: 'late',
      class: 'status',
    });
  }

  return candidates;
}

/** At most one Cycle lock-screen reminder per civil date. */
export function pickCycleScheduleSet(candidates, today) {
  const eligible = (candidates || []).filter(
    (row) => row.notifyEligible && row.eventDate >= today,
  );
  const byDay = new Map();
  for (const row of eligible) {
    const prev = byDay.get(row.eventDate);
    if (!prev || row.priority > prev.priority) byDay.set(row.eventDate, row);
  }
  return [...byDay.values()].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}

export function expectedEventDate(type, live = {}) {
  const start = live.nextPeriodStart;
  const anchors = periodReminderAnchors(start, live.nextPeriodRange);
  if (type === 'period_start') return start || null;
  if (type === 'period_soon') {
    if (live.mode === 'PERIMENOPAUSE') return perimenopausePeriodSoonDate(live.nextPeriodRange, live.periodDaysBefore);
    if (!start || !(live.periodDaysBefore > 0)) return null;
    return addDaysUtc(anchors.soonFrom, -live.periodDaysBefore);
  }
  if (type === 'period_late') return start ? addDaysUtc(anchors.lateFrom, PERIOD_LATE_AFTER_DAYS) : null;
  if (type === 'ovulation' || type === 'pms') {
    if (!live.ovulationDate) return null;
    return type === 'pms' ? addDaysUtc(live.ovulationDate, 2) : live.ovulationDate;
  }
  if (type === 'fertile' || type === 'opk') return live.fertileWindowStart || null;
  if (type === 'bbt' || type === 'log_nudge' || type === 'late') return live.today || null;
  return null;
}

export function revalidateCycleCandidate(candidate, live = {}) {
  const type = candidate?.candidateType || candidate?.type;
  if (!type) return { ok: false, reason: CYCLE_SUPPRESSION.NOT_ELIGIBLE };
  if (type === 'late' || candidate.notifyEligible === false) {
    return { ok: false, reason: CYCLE_SUPPRESSION.NOT_ELIGIBLE };
  }
  if (live.prefsEnabled === false) {
    return { ok: false, reason: CYCLE_SUPPRESSION.USER_DISABLED };
  }
  if (live.globalEnabled === false) {
    return { ok: false, reason: CYCLE_SUPPRESSION.GLOBAL_DISABLED };
  }
  if (live.mode === 'PREGNANCY' && type !== 'log_nudge') {
    return { ok: false, reason: CYCLE_SUPPRESSION.PREGNANCY_SUPPRESSED };
  }
  if (live.mode === 'PERIMENOPAUSE' && type !== 'log_nudge' && type !== 'period_soon') {
    return { ok: false, reason: CYCLE_SUPPRESSION.PERIMENOPAUSE_SUPPRESSED };
  }
  if (live.mode === 'POSTPARTUM' && type !== 'log_nudge') {
    return { ok: false, reason: CYCLE_SUPPRESSION.POSTPARTUM_SUPPRESSED };
  }
  if (live.forecastAllowed === false && type !== 'log_nudge' && type !== 'bbt') {
    return { ok: false, reason: CYCLE_SUPPRESSION.FORECAST_GATE_SUPPRESSED };
  }
  if (isFertilityCycleType(type) && live.showFertilityMarkers === false) {
    return { ok: false, reason: CYCLE_SUPPRESSION.CONTRACEPTION_SUPPRESSED };
  }
  if (FERTILITY_LEARNING_SKIPS.includes(type) && live.fertilityStatus === 'LEARNING') {
    return { ok: false, reason: CYCLE_SUPPRESSION.FERTILITY_LEARNING };
  }
  if (live.typeEnabled && live.typeEnabled[type] === false) {
    return { ok: false, reason: CYCLE_SUPPRESSION.USER_DISABLED };
  }
  if (inLoggedBleed(live.logs, live.today) && PREDICTION_CYCLE_TYPES.includes(type)) {
    return { ok: false, reason: CYCLE_SUPPRESSION.PERIOD_STARTED };
  }
  if (type === 'period_late' && live.nextPeriodStart && bleedLoggedSince(live.logs, periodReminderAnchors(live.nextPeriodStart, live.nextPeriodRange).bleedFrom)) {
    return { ok: false, reason: CYCLE_SUPPRESSION.PERIOD_STARTED };
  }
  const expected = expectedEventDate(type, live);
  if (expected && candidate.eventDate && expected !== candidate.eventDate) {
    return { ok: false, reason: CYCLE_SUPPRESSION.STALE_PREDICTION };
  }
  if (candidate.candidateId && live.sentCandidateIds?.includes(candidate.candidateId)) {
    return { ok: false, reason: CYCLE_SUPPRESSION.DUPLICATE };
  }
  return { ok: true, reason: null };
}

export function cycleDeliveryDecision(candidate, live, mask) {
  const reval = revalidateCycleCandidate(candidate, live);
  if (!reval.ok) {
    return { ...reval, deliver: false, rewriteMasked: false };
  }
  const effective = mask || getEffectiveCycleMask(live);
  const scheduledMasked = Boolean(candidate.masked);
  if (effective.masked && !scheduledMasked) {
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
