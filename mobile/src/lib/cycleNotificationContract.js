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

export const CYCLE_CANDIDATE_TYPES = Object.freeze([
  'period_start',
  'period_soon',
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
export const PREDICTION_CYCLE_TYPES = Object.freeze(['period_start', 'period_soon', 'ovulation', 'fertile', 'pms']);

export const CYCLE_TEMPLATE_BY_TYPE = Object.freeze({
  period_start: 'cycle-period-start',
  period_soon: 'cycle-period-soon',
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
  return k.startsWith('cycle-') || k.startsWith('cycle:');
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

  if (mode !== 'PREGNANCY' && predictions.nextPeriodStart) {
    const start = predictions.nextPeriodStart;
    if ((prefs.periodDaysBefore ?? 0) > 0) {
      push({
        type: 'period_soon',
        eventDate: addDaysUtc(start, -prefs.periodDaysBefore),
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
  }

  const fertilityOk = showFertilityMarkers !== false && mode !== 'PREGNANCY';
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

  if (lateStatus?.status === 'late') {
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
  if (type === 'period_start') return start || null;
  if (type === 'period_soon') {
    if (!start || !(live.periodDaysBefore > 0)) return null;
    return addDaysUtc(start, -live.periodDaysBefore);
  }
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
  if (isFertilityCycleType(type) && live.showFertilityMarkers === false) {
    return { ok: false, reason: CYCLE_SUPPRESSION.CONTRACEPTION_SUPPRESSED };
  }
  if (live.typeEnabled && live.typeEnabled[type] === false) {
    return { ok: false, reason: CYCLE_SUPPRESSION.USER_DISABLED };
  }
  if (inLoggedBleed(live.logs, live.today) && PREDICTION_CYCLE_TYPES.includes(type)) {
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
