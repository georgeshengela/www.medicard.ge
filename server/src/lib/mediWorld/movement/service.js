import { randomUUID } from 'node:crypto';
import { prisma as defaultPrisma } from '../../prisma.js';
import {
  isPrismaMissing,
  isUniqueViolation,
  resolveWorldDailyPeriodKey,
  worldSchemaUnavailableError,
} from '../engine.js';
import { assertWorldPayloadSafe } from '../privacy.js';
import {
  isMediWorldEnabled,
  isMediWorldMovementEnabled,
  mediWorldDisabledError,
  movementDisabledError,
} from '../flags.js';
import { getEffectiveQuestTimezone } from '../../questTime.js';
import { awardMovementSessionInTx } from './adapter.js';
import { logMovementSafe } from './privacy.js';
import { getPedometerAdapter } from './pedometer.js';
import {
  ACCURACY_MAX_M,
  ACTIVE_MOVEMENT_MODES,
  FRESHNESS_MS,
  MOVEMENT_RULESET_ID,
  OPEN_SESSION_STATUSES,
  allowedTargetsForMode,
  completionRatioBps,
  defaultTargetMinutes,
  distanceBandFromMeters,
  evaluateMovementSegment,
  isActiveMovementMode,
  isAllowedTargetMinutes,
  mergeAccuracyQuality,
  parseSampleTimestamp,
  sampleFreshnessReason,
  sessionExpired,
  targetDurationSec,
} from './rules.js';
import { issueMovementToken, readMovementToken } from './token.js';

function dbOf(options = {}) {
  return options.db || defaultPrisma;
}

function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function tokenOpts(options = {}) {
  return { secret: options.tokenSecret };
}

function tablesReady(db) {
  return Boolean(db?.worldMovementPreference?.upsert && db?.worldMovementSession?.create);
}

async function requireMovement(options = {}) {
  if (!isMediWorldEnabled(options.flags)) throw mediWorldDisabledError();
  if (!isMediWorldMovementEnabled(options.flags)) throw movementDisabledError();
}

function iso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function publicSession(row, extras = {}) {
  if (!row) return null;
  const payload = assertWorldPayloadSafe({
    id: row.id,
    movementMode: row.movementMode,
    targetDurationSec: row.targetDurationSec,
    status: row.status,
    acceptedDurationSec: row.acceptedDurationSec,
    activeWallDurationSec: row.activeWallDurationSec,
    pausedDurationSec: row.pausedDurationSec,
    acceptedSegmentCount: row.acceptedSegmentCount,
    rejectedSegmentCount: row.rejectedSegmentCount,
    lastSequence: row.lastSequence,
    distanceBand: row.distanceBand,
    accuracyQuality: row.accuracyQuality,
    mockLocationRisk: Boolean(row.mockLocationRisk),
    motorizedRisk: Boolean(row.motorizedRisk),
    completionRatioBps: row.completionRatioBps,
    verificationStatus: row.verificationStatus,
    periodKey: row.periodKey,
    rulesetVersion: row.rulesetVersion,
    lastSegmentReason: row.lastSegmentReason,
    startedAt: iso(row.startedAt),
    lastEventAt: iso(row.lastEventAt),
    pausedAt: iso(row.pausedAt),
    completedAt: iso(row.completedAt),
    expiredAt: iso(row.expiredAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    reward: extras.reward || null,
    pedometer: getPedometerAdapter(),
    ...(extras.outcome ? { outcome: extras.outcome } : {}),
    ...(extras.mediKey ? { mediKey: extras.mediKey } : {}),
  });
  if (extras.continuationToken) payload.continuationToken = extras.continuationToken;
  return payload;
}

function movementResult(payload) {
  const token = payload?.session?.continuationToken;
  if (payload?.session && 'continuationToken' in payload.session) {
    delete payload.session.continuationToken;
  }
  const safe = assertWorldPayloadSafe(payload);
  if (token && safe.session) safe.session.continuationToken = token;
  return safe;
}

async function withWorldSnapshot(userId, options, payload) {
  try {
    const { getMediWorldProfileSnapshot } = await import('../service.js');
    payload.world = await getMediWorldProfileSnapshot(userId, options);
  } catch {
    payload.world = null;
  }
  return movementResult(payload);
}

function historyItem(row) {
  const session = publicSession(row);
  if (session) delete session.continuationToken;
  return session;
}

function sampleFromBody(body = {}) {
  return {
    latitude: body.latitude,
    longitude: body.longitude,
    horizontalAccuracy: body.horizontalAccuracy,
    locationTimestamp: body.locationTimestamp,
    mockLocation: Boolean(body.mockLocation),
    speedMps: body.speedMps,
    appState: body.appState || 'active',
    idempotencyKey: String(body.idempotencyKey || '').trim(),
  };
}

async function expireIfNeeded(db, session, now) {
  if (!session || !sessionExpired(session, now)) return session;
  if (!OPEN_SESSION_STATUSES.includes(session.status)) return session;
  return db.worldMovementSession.update({
    where: { id: session.id },
    data: {
      status: 'expired',
      verificationStatus: 'rejected',
      expiredAt: now,
      lastEventAt: now,
      lastSegmentReason: 'SESSION_EXPIRED',
    },
  });
}

async function findOpen(db, userId) {
  return db.worldMovementSession.findFirst({
    where: { userId, status: { in: [...OPEN_SESSION_STATUSES] } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

function invalidTransition(from, to) {
  return httpError(`Cannot move session from ${from} to ${to}.`, 409, 'MOVEMENT_INVALID_TRANSITION');
}

function requireIdempotency(key) {
  if (!key || key.length > 180) {
    throw httpError('idempotencyKey აუცილებელია.', 400, 'WORLD_IDEMPOTENCY_CONFLICT');
  }
  return key;
}

export async function getMovementConfig(userId, options = {}) {
  await requireMovement(options);
  return movementResult({
    enabled: true,
    rulesetId: MOVEMENT_RULESET_ID,
    foregroundOnly: true,
    backgroundLocation: false,
    lastKnownAllowed: false,
    modes: ACTIVE_MOVEMENT_MODES,
    targets: {
      gentle_move: [...allowedTargetsForMode('gentle_move')],
      walk: [...allowedTargetsForMode('walk')],
      run: [...allowedTargetsForMode('run')],
    },
    defaults: {
      gentle_move: defaultTargetMinutes('gentle_move'),
      walk: defaultTargetMinutes('walk'),
      run: defaultTargetMinutes('run'),
    },
    freshnessMs: FRESHNESS_MS,
    accuracyMaxM: ACCURACY_MAX_M,
    pedometer: getPedometerAdapter(),
  });
}

export async function getMovementPreferences(userId, options = {}) {
  await requireMovement(options);
  const db = dbOf(options);
  if (!tablesReady(db)) throw worldSchemaUnavailableError();
  try {
    const row = await db.worldMovementPreference.findUnique({ where: { userId } });
    const movementMode = isActiveMovementMode(row?.movementMode) ? row.movementMode : 'walk';
    const targetMinutes = isAllowedTargetMinutes(movementMode, row?.targetMinutes)
      ? row.targetMinutes
      : defaultTargetMinutes(movementMode);
    return movementResult({
      enabled: true,
      rulesetId: MOVEMENT_RULESET_ID,
      movementMode,
      targetMinutes,
      targetDurationSec: targetDurationSec(targetMinutes),
    });
  } catch (error) {
    if (isPrismaMissing(error)) throw worldSchemaUnavailableError();
    throw error;
  }
}

export async function updateMovementPreferences(userId, body, options = {}) {
  await requireMovement(options);
  const db = dbOf(options);
  if (!tablesReady(db)) throw worldSchemaUnavailableError();
  const movementMode = body.movementMode || 'walk';
  if (!isActiveMovementMode(movementMode)) {
    throw httpError('ეს მოძრაობის რეჟიმი ჯერ არ არის გახსნილი.', 400, 'MOVEMENT_MODE_INVALID');
  }
  const targetMinutes = body.targetMinutes ?? defaultTargetMinutes(movementMode);
  if (!isAllowedTargetMinutes(movementMode, targetMinutes)) {
    throw httpError('ეს ხანგრძლივობა ამ რეჟიმისთვის არ არის დაშვებული.', 400, 'MOVEMENT_TARGET_INVALID');
  }
  try {
    const row = await db.worldMovementPreference.upsert({
      where: { userId },
      create: { userId, movementMode, targetMinutes },
      update: { movementMode, targetMinutes },
    });
    return movementResult({
      enabled: true,
      rulesetId: MOVEMENT_RULESET_ID,
      movementMode: row.movementMode,
      targetMinutes: row.targetMinutes,
      targetDurationSec: targetDurationSec(row.targetMinutes),
    });
  } catch (error) {
    if (isPrismaMissing(error)) throw worldSchemaUnavailableError();
    throw error;
  }
}

async function currentOpen(db, userId, now) {
  const open = await findOpen(db, userId);
  return expireIfNeeded(db, open, now);
}

export async function getCurrentMovementSession(userId, options = {}) {
  await requireMovement(options);
  const db = dbOf(options);
  if (!tablesReady(db)) throw worldSchemaUnavailableError();
  const now = options.now || new Date();
  try {
    const session = await currentOpen(db, userId, now);
    return movementResult({
      enabled: true,
      rulesetId: MOVEMENT_RULESET_ID,
      session: session ? publicSession(session) : null,
    });
  } catch (error) {
    if (isPrismaMissing(error)) throw worldSchemaUnavailableError();
    throw error;
  }
}

export async function startMovementSession(userId, body, options = {}) {
  await requireMovement(options);
  const db = dbOf(options);
  if (!tablesReady(db)) throw worldSchemaUnavailableError();
  const now = options.now || new Date();
  const idempotencyKey = requireIdempotency(String(body.idempotencyKey || '').trim());
  const movementMode = body.movementMode || 'walk';
  if (!isActiveMovementMode(movementMode)) {
    throw httpError('ეს მოძრაობის რეჟიმი ჯერ არ არის გახსნილი.', 400, 'MOVEMENT_MODE_INVALID');
  }
  const targetMinutes = body.targetMinutes ?? defaultTargetMinutes(movementMode);
  if (!isAllowedTargetMinutes(movementMode, targetMinutes)) {
    throw httpError('ეს ხანგრძლივობა ამ რეჟიმისთვის არ არის დაშვებული.', 400, 'MOVEMENT_TARGET_INVALID');
  }
  const sample = sampleFromBody(body);
  const freshness = sampleFreshnessReason(sample, now);
  if (freshness) {
    return movementResult({
      enabled: true,
      rulesetId: MOVEMENT_RULESET_ID,
      outcome: freshness,
      session: null,
    });
  }

  const timezone = getEffectiveQuestTimezone(options.user || {}, {
    timezone: options.timezone,
    deviceTimezone: options.deviceTimezone,
  });

  const run = async (tx) => {
    const existingKey = await tx.worldMovementSession.findFirst({
      where: { userId, startIdempotencyKey: idempotencyKey },
    });
    if (existingKey) {
      if (existingKey.movementMode !== movementMode || existingKey.targetDurationSec !== targetDurationSec(targetMinutes)) {
        throw httpError('ეს მოთხოვნა უკვე სხვა სესიას ეკუთვნის.', 409, 'WORLD_IDEMPOTENCY_CONFLICT');
      }
      const live = await expireIfNeeded(tx, existingKey, now);
      const token = OPEN_SESSION_STATUSES.includes(live.status)
        ? issueMovementToken({
            session: live,
            userId,
            sample,
            sequence: live.lastSequence,
            accM: 0,
            now,
          }, tokenOpts(options))
        : undefined;
      return { session: live, continuationToken: token, outcome: 'SESSION_ALREADY' };
    }

    const open = await currentOpen(tx, userId, now);
    if (open && OPEN_SESSION_STATUSES.includes(open.status)) {
      throw httpError('უკვე გაქვს აქტიური მოძრაობის სესია.', 409, 'MOVEMENT_OPEN_SESSION');
    }

    const periodKey = await resolveWorldDailyPeriodKey(tx, userId, now, timezone);
    const created = await tx.worldMovementSession.create({
      data: {
        id: randomUUID(),
        userId,
        movementMode,
        targetDurationSec: targetDurationSec(targetMinutes),
        status: 'active',
        acceptedDurationSec: 0,
        activeWallDurationSec: 0,
        pausedDurationSec: 0,
        acceptedSegmentCount: 0,
        rejectedSegmentCount: 0,
        lastSequence: 0,
        distanceBand: 'none',
        accuracyQuality: mergeAccuracyQuality('unknown', sample.horizontalAccuracy, true),
        mockLocationRisk: Boolean(sample.mockLocation),
        motorizedRisk: false,
        completionRatioBps: 0,
        verificationStatus: 'pending',
        periodKey,
        rulesetVersion: MOVEMENT_RULESET_ID,
        startIdempotencyKey: idempotencyKey,
        lastSegmentReason: 'SEGMENT_ANCHORED',
        startedAt: now,
        lastEventAt: now,
      },
    });
    const continuationToken = issueMovementToken({
      session: created,
      userId,
      sample,
      sequence: 0,
      accM: 0,
      now,
    }, tokenOpts(options));
    return { session: created, continuationToken, outcome: 'SESSION_STARTED' };
  };

  try {
    const result = typeof db.$transaction === 'function' ? await db.$transaction((tx) => run(tx)) : await run(db);
    return movementResult({
      enabled: true,
      rulesetId: MOVEMENT_RULESET_ID,
      outcome: result.outcome,
      mediKey: 'start',
      session: publicSession(result.session, {
        continuationToken: result.continuationToken,
        outcome: result.outcome,
        mediKey: 'start',
      }),
    });
  } catch (error) {
    if (error?.code === 'MOVEMENT_OPEN_SESSION' || error?.code === 'WORLD_IDEMPOTENCY_CONFLICT') throw error;
    if (isUniqueViolation(error)) {
      const raced = await db.worldMovementSession.findFirst({
        where: { userId, startIdempotencyKey: idempotencyKey },
      });
      if (raced) {
        return startMovementSession(userId, body, options);
      }
      const open = await findOpen(db, userId);
      if (open) throw httpError('უკვე გაქვს აქტიური მოძრაობის სესია.', 409, 'MOVEMENT_OPEN_SESSION');
    }
    if (isPrismaMissing(error)) throw worldSchemaUnavailableError();
    logMovementSafe('[medi-world] movement start failed', { code: error?.code, message: error?.message });
    throw error;
  }
}

async function loadOwnedSession(db, userId, sessionId, now) {
  const session = await db.worldMovementSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw httpError('სესია ვერ მოიძებნა.', 404, 'MOVEMENT_SESSION_NOT_FOUND');
  return expireIfNeeded(db, session, now);
}

export async function submitMovementSegment(userId, sessionId, body, options = {}) {
  await requireMovement(options);
  const db = dbOf(options);
  if (!tablesReady(db)) throw worldSchemaUnavailableError();
  const now = options.now || new Date();
  const sample = sampleFromBody(body);
  const idempotencyKey = requireIdempotency(sample.idempotencyKey);
  const token = String(body.continuationToken || body.previousToken || '').trim();

  try {
    const session = await loadOwnedSession(db, userId, sessionId, now);
    if (session.status === 'expired') {
      return movementResult({
        enabled: true,
        rulesetId: MOVEMENT_RULESET_ID,
        outcome: 'SESSION_EXPIRED',
        session: publicSession(session, { outcome: 'SESSION_EXPIRED', mediKey: 'expired' }),
      });
    }
    if (!OPEN_SESSION_STATUSES.includes(session.status)) {
      throw invalidTransition(session.status, 'segment');
    }
    if (session.lastSegmentIdempotencyKey === idempotencyKey) {
      return movementResult({
        enabled: true,
        rulesetId: MOVEMENT_RULESET_ID,
        outcome: session.lastSegmentReason || 'SEGMENT_DUPLICATE',
        session: publicSession(session, {
          outcome: session.lastSegmentReason || 'SEGMENT_DUPLICATE',
        }),
      });
    }

    const opened = readMovementToken(token, { userId, sessionId, now }, tokenOpts(options));
    if (!opened.ok) {
      const freshness = sampleFreshnessReason(sample, now);
      if (opened.reason === 'SEGMENT_TOKEN_EXPIRED' && session.status === 'active' && !freshness) {
        const nextSeq = session.lastSequence + 1;
        const updated = await db.worldMovementSession.update({
          where: { id: session.id },
          data: {
            lastSequence: nextSeq,
            lastSegmentIdempotencyKey: idempotencyKey,
            lastSegmentReason: 'SEGMENT_REANCHORED',
            lastEventAt: now,
            accuracyQuality: mergeAccuracyQuality(session.accuracyQuality, sample.horizontalAccuracy, false),
          },
        });
        const continuationToken = issueMovementToken({
          session: updated,
          userId,
          sample,
          sequence: nextSeq,
          accM: 0,
          now,
        }, tokenOpts(options));
        return movementResult({
          enabled: true,
          rulesetId: MOVEMENT_RULESET_ID,
          outcome: 'SEGMENT_REANCHORED',
          session: publicSession(updated, {
            continuationToken,
            outcome: 'SEGMENT_REANCHORED',
            mediKey: 'reanchor',
          }),
        });
      }
      const next = await db.worldMovementSession.update({
        where: { id: session.id },
        data: {
          rejectedSegmentCount: { increment: 1 },
          lastSegmentIdempotencyKey: idempotencyKey,
          lastSegmentReason: opened.reason,
          lastEventAt: now,
          accuracyQuality: mergeAccuracyQuality(session.accuracyQuality, sample.horizontalAccuracy, false),
        },
      });
      return movementResult({
        enabled: true,
        rulesetId: MOVEMENT_RULESET_ID,
        outcome: opened.reason,
        session: publicSession(next, { outcome: opened.reason, mediKey: 'low_gps' }),
      });
    }

    if (opened.payload.seq !== session.lastSequence) {
      const next = await db.worldMovementSession.update({
        where: { id: session.id },
        data: {
          rejectedSegmentCount: { increment: 1 },
          lastSegmentIdempotencyKey: idempotencyKey,
          lastSegmentReason: 'SEGMENT_OUT_OF_ORDER',
          lastEventAt: now,
        },
      });
      return movementResult({
        enabled: true,
        rulesetId: MOVEMENT_RULESET_ID,
        outcome: 'SEGMENT_OUT_OF_ORDER',
        session: publicSession(next, { outcome: 'SEGMENT_OUT_OF_ORDER' }),
      });
    }

    const verdict = evaluateMovementSegment({
      mode: session.movementMode,
      status: session.status,
      appState: sample.appState,
      prev: {
        lat: opened.payload.lat,
        lng: opened.payload.lng,
        ts: opened.payload.ts,
        acc: opened.payload.acc,
        seq: opened.payload.seq,
      },
      next: sample,
      now,
    });

    const accepted = Boolean(verdict.accept && verdict.reason === 'SEGMENT_ACCEPTED');
    const reanchor = Boolean(verdict.reanchor);
    const advanceSeq = accepted || reanchor;
    const nextSeq = advanceSeq ? session.lastSequence + 1 : session.lastSequence;
    const accM = (Number(opened.payload.accM) || 0) + (accepted ? verdict.meters : 0);
    const acceptedDurationSec = session.acceptedDurationSec + (accepted ? verdict.creditSec : 0);
    const nextStatus = verdict.motorized && session.status === 'active' ? 'paused' : session.status;
    const data = {
      lastSequence: nextSeq,
      acceptedDurationSec,
      activeWallDurationSec: session.status === 'active'
        ? session.activeWallDurationSec + (accepted ? verdict.creditSec : 0)
        : session.activeWallDurationSec,
      acceptedSegmentCount: session.acceptedSegmentCount + (accepted ? 1 : 0),
      rejectedSegmentCount: session.rejectedSegmentCount + (accepted ? 0 : 1),
      distanceBand: distanceBandFromMeters(accM),
      accuracyQuality: mergeAccuracyQuality(session.accuracyQuality, sample.horizontalAccuracy, accepted),
      mockLocationRisk: session.mockLocationRisk || Boolean(sample.mockLocation),
      motorizedRisk: session.motorizedRisk || Boolean(verdict.motorized),
      completionRatioBps: completionRatioBps(acceptedDurationSec, session.targetDurationSec),
      lastSegmentIdempotencyKey: idempotencyKey,
      lastSegmentReason: verdict.reason,
      lastEventAt: now,
      status: nextStatus,
      pausedAt: nextStatus === 'paused' && session.status !== 'paused' ? now : session.pausedAt,
    };

    const updated = await db.worldMovementSession.update({
      where: { id: session.id },
      data,
    });

    let continuationToken;
    if (nextStatus === 'active' && (accepted || reanchor)) {
      continuationToken = issueMovementToken({
        session: updated,
        userId,
        sample,
        sequence: nextSeq,
        accM,
        now,
      }, tokenOpts(options));
    } else if (nextStatus === 'active' && !verdict.motorized) {
      continuationToken = token;
    }

    const mediKey = verdict.motorized
      ? 'motorized'
      : verdict.reason === 'SEGMENT_INACCURATE' || verdict.reason === 'SEGMENT_STALE'
        ? 'low_gps'
        : verdict.reason === 'SEGMENT_GAP'
          ? 'reanchor'
        : accepted && updated.completionRatioBps >= 5000 && session.completionRatioBps < 5000
          ? 'halfway'
          : accepted && updated.completionRatioBps >= 10_000
            ? 'complete'
            : accepted
              ? 'moving'
              : 'low_gps';

    return movementResult({
      enabled: true,
      rulesetId: MOVEMENT_RULESET_ID,
      outcome: verdict.reason,
      session: publicSession(updated, { continuationToken, outcome: verdict.reason, mediKey }),
    });
  } catch (error) {
    if (error?.code === 'MOVEMENT_SESSION_NOT_FOUND' || error?.code === 'MOVEMENT_INVALID_TRANSITION' || error?.code === 'WORLD_IDEMPOTENCY_CONFLICT') {
      throw error;
    }
    if (isPrismaMissing(error)) throw worldSchemaUnavailableError();
    logMovementSafe('[medi-world] movement segment failed', { code: error?.code, message: error?.message });
    throw error;
  }
}

export async function pauseMovementSession(userId, sessionId, body, options = {}) {
  await requireMovement(options);
  const db = dbOf(options);
  const now = options.now || new Date();
  const idempotencyKey = requireIdempotency(String(body?.idempotencyKey || `pause:${sessionId}`).trim());
  try {
    const session = await loadOwnedSession(db, userId, sessionId, now);
    if (session.status === 'paused') {
      return movementResult({
        enabled: true,
        rulesetId: MOVEMENT_RULESET_ID,
        outcome: 'SESSION_PAUSED',
        session: publicSession(session, { outcome: 'SESSION_PAUSED', mediKey: 'pause' }),
      });
    }
    if (session.status !== 'active') throw invalidTransition(session.status, 'paused');
    const updated = await db.worldMovementSession.update({
      where: { id: session.id },
      data: {
        status: 'paused',
        pausedAt: now,
        lastEventAt: now,
        lastSegmentIdempotencyKey: idempotencyKey,
        lastSegmentReason: 'SESSION_PAUSED',
      },
    });
    return movementResult({
      enabled: true,
      rulesetId: MOVEMENT_RULESET_ID,
      outcome: 'SESSION_PAUSED',
      session: publicSession(updated, { outcome: 'SESSION_PAUSED', mediKey: 'pause' }),
    });
  } catch (error) {
    if (error?.code === 'MOVEMENT_SESSION_NOT_FOUND' || error?.code === 'MOVEMENT_INVALID_TRANSITION') throw error;
    if (isPrismaMissing(error)) throw worldSchemaUnavailableError();
    throw error;
  }
}

export async function resumeMovementSession(userId, sessionId, body, options = {}) {
  await requireMovement(options);
  const db = dbOf(options);
  const now = options.now || new Date();
  const sample = sampleFromBody(body);
  const idempotencyKey = requireIdempotency(String(body?.idempotencyKey || '').trim());
  const freshness = sampleFreshnessReason(sample, now);
  try {
    const session = await loadOwnedSession(db, userId, sessionId, now);
    if (session.status === 'active') {
      const continuationToken = freshness
        ? undefined
        : issueMovementToken({ session, userId, sample, sequence: session.lastSequence, accM: 0, now }, tokenOpts(options));
      return movementResult({
        enabled: true,
        rulesetId: MOVEMENT_RULESET_ID,
        outcome: 'SESSION_ACTIVE',
        session: publicSession(session, { continuationToken, outcome: 'SESSION_ACTIVE', mediKey: 'start' }),
      });
    }
    if (session.status !== 'paused') throw invalidTransition(session.status, 'active');
    if (freshness) {
      return movementResult({
        enabled: true,
        rulesetId: MOVEMENT_RULESET_ID,
        outcome: freshness,
        session: publicSession(session, { outcome: freshness, mediKey: 'background_return' }),
      });
    }
    const pausedSec = session.pausedAt
      ? Math.max(0, Math.floor((now.getTime() - new Date(session.pausedAt).getTime()) / 1000))
      : 0;
    const updated = await db.worldMovementSession.update({
      where: { id: session.id },
      data: {
        status: 'active',
        pausedAt: null,
        pausedDurationSec: session.pausedDurationSec + pausedSec,
        lastSequence: session.lastSequence + 1,
        lastEventAt: now,
        lastSegmentIdempotencyKey: idempotencyKey,
        lastSegmentReason: 'SEGMENT_ANCHORED',
        mockLocationRisk: session.mockLocationRisk || Boolean(sample.mockLocation),
      },
    });
    const continuationToken = issueMovementToken({
      session: updated,
      userId,
      sample,
      sequence: updated.lastSequence,
      accM: 0,
      now,
    }, tokenOpts(options));
    return movementResult({
      enabled: true,
      rulesetId: MOVEMENT_RULESET_ID,
      outcome: 'SESSION_RESUMED',
      session: publicSession(updated, { continuationToken, outcome: 'SESSION_RESUMED', mediKey: 'background_return' }),
    });
  } catch (error) {
    if (error?.code === 'MOVEMENT_SESSION_NOT_FOUND' || error?.code === 'MOVEMENT_INVALID_TRANSITION') throw error;
    if (isPrismaMissing(error)) throw worldSchemaUnavailableError();
    throw error;
  }
}

async function finalizeSession(tx, userId, session, { status, now, options }) {
  const accepted = session.acceptedDurationSec > 0 && session.acceptedSegmentCount > 0;
  const verificationStatus = accepted ? 'verified' : 'rejected';
  const nextStatus = status === 'completed' && !accepted ? 'verification_failed' : status;
  const completionRatio = completionRatioBps(session.acceptedDurationSec, session.targetDurationSec);
  let reward = null;
  if (nextStatus === 'completed' && verificationStatus === 'verified') {
    reward = await awardMovementSessionInTx(tx, userId, {
      ...session,
      verificationStatus,
      completionRatioBps: completionRatio,
    }, options);
  }
  const updated = await tx.worldMovementSession.update({
    where: { id: session.id },
    data: {
      status: nextStatus,
      verificationStatus,
      completionRatioBps: completionRatio,
      completedAt: now,
      lastEventAt: now,
      lastSegmentReason: nextStatus === 'abandoned' ? 'SESSION_ABANDONED' : nextStatus === 'completed' ? 'SESSION_COMPLETED' : 'SESSION_VERIFICATION_FAILED',
      rewardLedgerId: reward?.ledger?.id || session.rewardLedgerId,
    },
  });
  return { session: updated, reward };
}

export async function finishMovementSession(userId, sessionId, body, options = {}) {
  await requireMovement(options);
  const db = dbOf(options);
  const now = options.now || new Date();
  requireIdempotency(String(body?.idempotencyKey || `finish:${sessionId}`).trim());
  try {
    const run = async (tx) => {
      const session = await loadOwnedSession(tx, userId, sessionId, now);
      if (session.status === 'completed' || session.status === 'verification_failed') {
        let reward = null;
        if (session.rewardLedgerId && typeof tx.mediWorldLedger?.findUnique === 'function') {
          const ledger = await tx.mediWorldLedger.findUnique({ where: { id: session.rewardLedgerId } });
          if (ledger) {
            reward = {
              applied: false,
              duplicate: true,
              reasonCode: ledger.reasonCode,
              reward: { energyAmount: ledger.energyAmount || 0, worldXp: ledger.foundationXp || 0 },
              ledger,
            };
          }
        }
        return {
          session,
          reward,
          outcome: session.status === 'completed' ? 'SESSION_COMPLETED' : 'SESSION_VERIFICATION_FAILED',
        };
      }
      if (session.status === 'expired') {
        return { session, reward: null, outcome: 'SESSION_EXPIRED' };
      }
      if (!OPEN_SESSION_STATUSES.includes(session.status)) throw invalidTransition(session.status, 'completed');
      const result = await finalizeSession(tx, userId, session, { status: 'completed', now, options });
      return {
        ...result,
        outcome: result.session.status === 'completed' ? 'SESSION_COMPLETED' : 'SESSION_VERIFICATION_FAILED',
      };
    };
    const result = typeof db.$transaction === 'function' ? await db.$transaction((tx) => run(tx)) : await run(db);
    const mediKey = result.session.status === 'completed'
      ? (result.session.completionRatioBps >= 10_000 ? 'complete' : result.session.acceptedDurationSec > 0 ? 'partial' : 'none')
      : 'none';
    const reward = result.reward
      ? {
          applied: result.reward.applied,
          duplicate: result.reward.duplicate,
          reasonCode: result.reward.reasonCode,
          energyAmount: result.reward.reward?.energyAmount || 0,
          worldXp: result.reward.reward?.worldXp || 0,
        }
      : null;
    return withWorldSnapshot(userId, options, {
      enabled: true,
      rulesetId: MOVEMENT_RULESET_ID,
      outcome: result.outcome,
      reward,
      session: publicSession(result.session, {
        outcome: result.outcome,
        mediKey,
        reward,
      }),
    });
  } catch (error) {
    if (error?.code === 'MOVEMENT_SESSION_NOT_FOUND' || error?.code === 'MOVEMENT_INVALID_TRANSITION') throw error;
    if (isPrismaMissing(error)) throw worldSchemaUnavailableError();
    logMovementSafe('[medi-world] movement finish failed', { code: error?.code, message: error?.message });
    throw error;
  }
}

export async function abandonMovementSession(userId, sessionId, body, options = {}) {
  await requireMovement(options);
  const db = dbOf(options);
  const now = options.now || new Date();
  requireIdempotency(String(body?.idempotencyKey || `abandon:${sessionId}`).trim());
  try {
    const session = await loadOwnedSession(db, userId, sessionId, now);
    if (session.status === 'abandoned') {
      return movementResult({
        enabled: true,
        rulesetId: MOVEMENT_RULESET_ID,
        outcome: 'SESSION_ABANDONED',
        session: publicSession(session, { outcome: 'SESSION_ABANDONED', mediKey: 'none' }),
      });
    }
    if (!OPEN_SESSION_STATUSES.includes(session.status)) throw invalidTransition(session.status, 'abandoned');
    const updated = await db.worldMovementSession.update({
      where: { id: session.id },
      data: {
        status: 'abandoned',
        verificationStatus: 'rejected',
        completedAt: now,
        lastEventAt: now,
        lastSegmentReason: 'SESSION_ABANDONED',
      },
    });
    return movementResult({
      enabled: true,
      rulesetId: MOVEMENT_RULESET_ID,
      outcome: 'SESSION_ABANDONED',
      session: publicSession(updated, { outcome: 'SESSION_ABANDONED', mediKey: 'none' }),
    });
  } catch (error) {
    if (error?.code === 'MOVEMENT_SESSION_NOT_FOUND' || error?.code === 'MOVEMENT_INVALID_TRANSITION') throw error;
    if (isPrismaMissing(error)) throw worldSchemaUnavailableError();
    throw error;
  }
}

export async function getMovementHistory(userId, options = {}) {
  await requireMovement(options);
  const db = dbOf(options);
  if (!tablesReady(db)) throw worldSchemaUnavailableError();
  const take = Math.min(50, Math.max(1, Number(options.take) || 20));
  try {
    const rows = await db.worldMovementSession.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    const slice = (rows || []).slice(0, take);
    const next = (rows || []).length > take ? rows[take].id : null;
    return movementResult({
      enabled: true,
      rulesetId: MOVEMENT_RULESET_ID,
      nextCursor: next,
      items: slice.map((row) => historyItem(row)),
    });
  } catch (error) {
    if (isPrismaMissing(error)) throw worldSchemaUnavailableError();
    throw error;
  }
}
