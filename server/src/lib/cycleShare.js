import { createHash, randomBytes } from 'node:crypto';
import {
  buildPredictions,
  detectCyclePhase,
  inferCycleStats,
  isPeriodFlow,
  resolveForecastAverages,
  todayInTimeZone,
  toDateKey,
} from './cycle.js';

/** 32 bytes → 64 hex chars. 12-hex legacy codes are rejected. */
export const SHARE_TOKEN_BYTES = 32;
export const SHARE_TOKEN_HEX_RE = /^[a-f0-9]{64}$/;
export const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const DEFAULT_SHARE_PERMISSIONS = Object.freeze({
  period: true,
  cyclePhase: true,
  fertileWindow: false,
  symptoms: false,
});

export const SHARE_AUTH_ERROR = 'ავტორიზაცია საჭიროა. გთხოვთ, შეხვიდეთ სისტემაში.';
export const SHARE_DENY_ERROR = 'ბმული ვერ მოიძებნა';

const PERM_KEYS = ['period', 'cyclePhase', 'fertileWindow', 'symptoms'];

export function generateShareToken() {
  return randomBytes(SHARE_TOKEN_BYTES).toString('hex');
}

export function hashShareToken(token) {
  return createHash('sha256').update(String(token), 'utf8').digest('hex');
}

export function isShareTokenFormat(token) {
  return SHARE_TOKEN_HEX_RE.test(String(token || '').trim());
}

export function normalizeSharePermissions(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    period: src.period === true,
    cyclePhase: src.cyclePhase === true,
    fertileWindow: src.fertileWindow === true,
    symptoms: src.symptoms === true,
  };
}

export function mergeSharePermissions(raw) {
  return normalizeSharePermissions({ ...DEFAULT_SHARE_PERMISSIONS, ...(raw || {}) });
}

export function shareExpiresAt(from = new Date(), ttlMs = SHARE_TTL_MS) {
  return new Date(from.getTime() + ttlMs);
}

export function evaluateShareAccess(share, viewerUserId, now = new Date()) {
  if (!share) return { ok: false, reason: 'missing' };
  if (share.revokedAt) return { ok: false, reason: 'revoked' };
  if (!share.expiresAt || new Date(share.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: 'expired' };
  }
  if (!share.partnerUserId || share.partnerUserId !== viewerUserId) {
    return { ok: false, reason: 'not_partner' };
  }
  if (share.ownerUserId === viewerUserId) {
    return { ok: false, reason: 'not_partner' };
  }
  return { ok: true };
}

export function canAcceptShare(share, viewerUserId, now = new Date()) {
  if (!share) return { ok: false, reason: 'missing' };
  if (share.revokedAt) return { ok: false, reason: 'revoked' };
  if (!share.expiresAt || new Date(share.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: 'expired' };
  }
  if (share.ownerUserId === viewerUserId) return { ok: false, reason: 'owner' };
  if (share.partnerUserId && share.partnerUserId !== viewerUserId) {
    return { ok: false, reason: 'bound' };
  }
  return { ok: true, alreadyBound: share.partnerUserId === viewerUserId };
}

export function assertShareOwner(share, ownerUserId, now = new Date()) {
  if (!share || share.ownerUserId !== ownerUserId || share.revokedAt) return false;
  if (!share.expiresAt || new Date(share.expiresAt).getTime() <= now.getTime()) return false;
  return true;
}

/** All partner-peek gates. Reasons are for logs only — HTTP body stays generic. */
export function decidePartnerPeek({ viewerUserId, share, owner, now = new Date() }) {
  if (!viewerUserId) {
    return { ok: false, http: 401, error: SHARE_AUTH_ERROR, reason: 'unauthenticated' };
  }
  const access = evaluateShareAccess(share, viewerUserId, now);
  if (!access.ok) {
    return { ok: false, http: 404, error: SHARE_DENY_ERROR, reason: access.reason };
  }
  if (!owner || owner.status === 'BLOCKED') {
    return { ok: false, http: 404, error: SHARE_DENY_ERROR, reason: 'owner_unavailable' };
  }
  return { ok: true };
}

export function decideShareManage({ share, viewerUserId, now = new Date() }) {
  if (!assertShareOwner(share, viewerUserId, now)) {
    return { ok: false, http: 404, error: SHARE_DENY_ERROR, reason: 'forbidden' };
  }
  return { ok: true };
}

export function decideShareAccept({ share, viewerUserId, now = new Date() }) {
  const verdict = canAcceptShare(share, viewerUserId, now);
  if (!verdict.ok) {
    return { ok: false, http: 404, error: SHARE_DENY_ERROR, reason: verdict.reason };
  }
  return { ok: true, alreadyBound: verdict.alreadyBound };
}

export function privateCacheHeaders() {
  return {
    'Cache-Control': 'private, no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  };
}

export function applyPrivateCache(res) {
  const headers = privateCacheHeaders();
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  return res;
}

/** Same body for every post-auth denial. Do not vary by reason. */
export function denyShare(res, status = 404) {
  applyPrivateCache(res);
  return res.status(status).json({ error: SHARE_DENY_ERROR });
}

export function denyShareAuth(res) {
  applyPrivateCache(res);
  return res.status(401).json({ error: SHARE_AUTH_ERROR });
}

export function securityShareLog(event, meta = {}) {
  const safe = {
    event,
    reason: meta.reason || undefined,
    owner: Boolean(meta.owner),
    partner: Boolean(meta.partner),
  };
  console.info('[cycle-share]', JSON.stringify(safe));
}

export function ownerShareView(share, plaintextToken = null) {
  if (!share || share.revokedAt) {
    return {
      active: false,
      code: null,
      expiresAt: null,
      partnerBound: false,
      permissions: mergeSharePermissions(null),
    };
  }
  return {
    active: true,
    code: plaintextToken,
    expiresAt: share.expiresAt ? new Date(share.expiresAt).toISOString() : null,
    partnerBound: Boolean(share.partnerUserId),
    permissions: mergeSharePermissions(share.permissions),
  };
}

export function buildPartnerPayload({ profile, logs, permissions, today = todayInTimeZone() }) {
  const allowed = normalizeSharePermissions(permissions);
  const inferred = inferCycleStats(logs, profile.avgCycleLength, profile.avgPeriodLength);
  const averages = resolveForecastAverages(profile, inferred);
  const lastPeriodStart = toDateKey(profile.lastPeriodStart) || inferred.lastPeriodStart;
  const predictions = buildPredictions({
    lastPeriodStart,
    avgCycleLength: averages.usedCycleLength,
    avgPeriodLength: averages.usedPeriodLength,
    cycleCount: averages.cycleCount,
    isIrregular: profile.isIrregular,
    logs,
  });
  const phase = detectCyclePhase({
    lastPeriodStart,
    avgCycleLength: averages.usedCycleLength,
    avgPeriodLength: averages.usedPeriodLength,
    today,
  });

  const payload = {
    estimated: true,
    permissions: allowed,
  };

  const todayLog = (logs || []).find((l) => l.date === today);
  const loggedBleed = isPeriodFlow(todayLog?.flow);

  if (allowed.period) {
    payload.period = {
      inPeriod: phase.phase === 'period',
      inPeriodEstimated: phase.phase === 'period' ? !loggedBleed : true,
      nextPeriodStart: predictions.nextPeriodStart,
      nextPeriodEstimated: true,
    };
  }
  if (allowed.cyclePhase) {
    payload.phase = {
      phase: phase.phase,
      phaseKa: phase.phaseKa,
      cycleDay: phase.day,
      estimated: true,
    };
  }
  if (allowed.fertileWindow) {
    payload.fertileWindow = {
      start: predictions.fertileWindow?.start ?? null,
      end: predictions.fertileWindow?.end ?? null,
      ovulationDate: predictions.ovulationDate,
      estimated: true,
    };
  }
  if (allowed.symptoms) {
    const dayLog = (logs || []).find((l) => l.date === today);
    const keys = Array.isArray(dayLog?.symptoms) ? dayLog.symptoms.map(String) : [];
    payload.symptoms = { keys };
  }

  return payload;
}

export function partnerPayloadHasLeak(payload) {
  const text = JSON.stringify(payload);
  const forbidden = [
    'passwordHash',
    'partnerShareCode',
    'aiInsights',
    'notes',
    'conditions',
    'pregnancy',
    'dueDate',
    'userId',
    'ownerUserId',
    'tokenHash',
    'email',
    'Authorization',
    'ovulationTest',
    'pregnancyTest',
    'bbt',
    'cervicalMucus',
    'sexualActivity',
    'libido',
    'intercourse',
    'contraceptionMethod',
    'contraceptionStartedAt',
    'contraception',
  ];
  return forbidden.some((key) => Object.hasOwn(payload, key) || new RegExp(`"${key}"`).test(text));
}

export { PERM_KEYS };
