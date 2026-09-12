import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQuestFakeDb } from '../../questFakeDb.js';
import { mediWorldRouter } from '../../../routes/mediWorld.routes.js';
import { destinationPoint, geodesicMeters } from '../explore/geo.js';
import { logMovementSafe, redactMovementValue } from './privacy.js';
import { getPedometerAdapter } from './pedometer.js';
import { issueMovementToken, openMovementToken, readMovementToken, resolveMovementTokenMaterial, sealMovementToken } from './token.js';
import {
  ACTIVE_MOVEMENT_MODES,
  INACTIVE_MOVEMENT_MODES,
  MOVEMENT_RULESET_ID,
  SESSION_TTL_MS,
  evaluateMovementSegment,
  isAllowedTargetMinutes,
} from './rules.js';
import {
  abandonMovementSession,
  finishMovementSession,
  getCurrentMovementSession,
  getMovementConfig,
  getMovementHistory,
  getMovementPreferences,
  pauseMovementSession,
  resumeMovementSession,
  startMovementSession,
  submitMovementSegment,
  updateMovementPreferences,
} from './service.js';
import { getMediWorldProfileSnapshot } from '../service.js';
import { ensureMediWorldProfile } from '../engine.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SECRET = 'phase43-movement-test-secret';
const NOW = new Date('2026-09-13T12:00:00.000Z');
const USER = 'user-move-1';
const OTHER = 'user-move-2';
const ORIGIN = { latitude: 37.422, longitude: -122.084 };

function flags(extra = {}) {
  return { nodeEnv: extra.nodeEnv || 'test', flag: extra.flag || '1', movementFlag: extra.movementFlag ?? '1' };
}

function opts(db, extra = {}) {
  return {
    db,
    now: extra.now || NOW,
    timezone: extra.timezone || 'UTC',
    flags: flags(extra),
    user: extra.user || { timezone: 'UTC' },
    tokenSecret: SECRET,
  };
}

function sample(extra = {}) {
  const at = extra.now || NOW;
  const point = extra.meters != null ? destinationPoint(ORIGIN, extra.bearing ?? 0, extra.meters) : ORIGIN;
  return {
    latitude: extra.latitude ?? point.latitude,
    longitude: extra.longitude ?? point.longitude,
    horizontalAccuracy: extra.horizontalAccuracy ?? 12,
    locationTimestamp: extra.locationTimestamp || at,
    mockLocation: Boolean(extra.mockLocation),
    appState: extra.appState || 'active',
    idempotencyKey: extra.idempotencyKey || 'start-1',
  };
}

async function startWalk(db, extra = {}) {
  return startMovementSession(
    extra.userId || USER,
    {
      ...sample(extra),
      movementMode: extra.movementMode || 'walk',
      targetMinutes: extra.targetMinutes ?? 5,
      idempotencyKey: extra.idempotencyKey || 'start-walk',
    },
    opts(db, extra),
  );
}

async function creditSeconds(db, started, needSec, extra = {}) {
  let token = started.session.continuationToken;
  let accepted = started.session.acceptedDurationSec;
  let meters = 0;
  let i = 0;
  let last = started;
  while (accepted < needSec) {
    i += 1;
    meters += 28;
    const at = new Date(NOW.getTime() + i * 20_000);
    const res = await submitMovementSegment(
      extra.userId || USER,
      started.session.id,
      {
        ...sample({ meters, now: at, idempotencyKey: `seg-${extra.prefix || 'c'}-${i}` }),
        continuationToken: token,
      },
      opts(db, { ...extra, now: at }),
    );
    last = res;
    token = res.session.continuationToken;
    accepted = res.session.acceptedDurationSec;
    if (i > 40) break;
  }
  return last;
}

describe('Medi World Phase 43 movement rules', () => {
  it('exposes active duration modes only', () => {
    assert.deepEqual([...ACTIVE_MOVEMENT_MODES], ['walk', 'run', 'gentle_move']);
    assert.ok(INACTIVE_MOVEMENT_MODES.includes('wheelchair'));
    assert.equal(isAllowedTargetMinutes('gentle_move', 20), false);
    assert.equal(isAllowedTargetMinutes('walk', 10), true);
    assert.equal(getPedometerAdapter().active, false);
    assert.equal(getPedometerAdapter().reason, 'inactive_expo_go');
  });

  it('credits plausible walk and run and rejects jitter, teleport, and motorized speeds', () => {
    const prev = { lat: ORIGIN.latitude, lng: ORIGIN.longitude, ts: NOW.getTime(), acc: 12, seq: 0 };
    const walkTo = destinationPoint(ORIGIN, 0, 28);
    const walk = evaluateMovementSegment({
      mode: 'walk',
      status: 'active',
      appState: 'active',
      prev,
      next: sample({ latitude: walkTo.latitude, longitude: walkTo.longitude, locationTimestamp: new Date(NOW.getTime() + 20_000) }),
      now: new Date(NOW.getTime() + 20_000),
    });
    assert.equal(walk.reason, 'SEGMENT_ACCEPTED');
    assert.equal(walk.creditSec, 20);

    const jitterTo = destinationPoint(ORIGIN, 0, 3);
    const jitter = evaluateMovementSegment({
      mode: 'walk',
      status: 'active',
      appState: 'active',
      prev,
      next: sample({ latitude: jitterTo.latitude, longitude: jitterTo.longitude, locationTimestamp: new Date(NOW.getTime() + 20_000) }),
      now: new Date(NOW.getTime() + 20_000),
    });
    assert.equal(jitter.reason, 'SEGMENT_STATIONARY');
    assert.equal(jitter.creditSec, 0);

    const runTo = destinationPoint(ORIGIN, 0, 80);
    const runOk = evaluateMovementSegment({
      mode: 'run',
      status: 'active',
      appState: 'active',
      prev,
      next: sample({ latitude: runTo.latitude, longitude: runTo.longitude, locationTimestamp: new Date(NOW.getTime() + 20_000) }),
      now: new Date(NOW.getTime() + 20_000),
    });
    assert.equal(runOk.reason, 'SEGMENT_ACCEPTED');

    const fastWalk = evaluateMovementSegment({
      mode: 'walk',
      status: 'active',
      appState: 'active',
      prev,
      next: sample({ latitude: runTo.latitude, longitude: runTo.longitude, locationTimestamp: new Date(NOW.getTime() + 20_000) }),
      now: new Date(NOW.getTime() + 20_000),
    });
    assert.equal(fastWalk.reason, 'SEGMENT_TOO_FAST');

    const far = destinationPoint(ORIGIN, 0, 800);
    const teleport = evaluateMovementSegment({
      mode: 'walk',
      status: 'active',
      appState: 'active',
      prev,
      next: sample({ latitude: far.latitude, longitude: far.longitude, locationTimestamp: new Date(NOW.getTime() + 20_000) }),
      now: new Date(NOW.getTime() + 20_000),
    });
    assert.equal(teleport.reason, 'SEGMENT_TELEPORT');

    const motor = destinationPoint(ORIGIN, 0, 280);
    const motorized = evaluateMovementSegment({
      mode: 'walk',
      status: 'active',
      appState: 'active',
      prev,
      next: sample({ latitude: motor.latitude, longitude: motor.longitude, locationTimestamp: new Date(NOW.getTime() + 20_000) }),
      now: new Date(NOW.getTime() + 20_000),
    });
    assert.equal(motorized.reason, 'SEGMENT_MOTORIZED');
    assert.equal(motorized.motorized, true);

    const paused = evaluateMovementSegment({
      mode: 'walk',
      status: 'paused',
      appState: 'active',
      prev,
      next: sample({ meters: 28, locationTimestamp: new Date(NOW.getTime() + 20_000) }),
      now: new Date(NOW.getTime() + 20_000),
    });
    assert.equal(paused.reason, 'SEGMENT_PAUSED');

    const bg = evaluateMovementSegment({
      mode: 'walk',
      status: 'active',
      appState: 'background',
      prev,
      next: sample({ meters: 28, locationTimestamp: new Date(NOW.getTime() + 20_000) }),
      now: new Date(NOW.getTime() + 20_000),
    });
    assert.equal(bg.reason, 'SEGMENT_BACKGROUND');
  });

  it('uses geodesic meters, not raw coordinate deltas', () => {
    const a = { latitude: 37.422, longitude: -122.084 };
    const b = destinationPoint(a, 90, 100);
    assert.ok(Math.abs(geodesicMeters(a, b) - 100) < 1);
  });
});

describe('continuation token', () => {
  function fromB64url(text) {
    const padded = String(text).replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    return Buffer.from(padded + pad, 'base64');
  }

  function partsOf(token) {
    return String(token).split('.');
  }

  function payload() {
    return {
      v: 1, sid: 'sess-1', uid: USER, seq: 0, ts: NOW.getTime(), lat: 1, lng: 2, acc: 12, accM: 0, exp: NOW.getTime() + 90_000, rs: MOVEMENT_RULESET_ID,
    };
  }

  it('uses a fresh 96-bit IV, AES-256-GCM tag, and domain-separated key', () => {
    const a = sealMovementToken(payload(), { secret: SECRET });
    const b = sealMovementToken(payload(), { secret: SECRET });
    assert.notEqual(a, b);
    const parts = partsOf(a);
    assert.equal(parts[0], 'mw1');
    assert.equal(parts.length, 4);
    assert.equal(fromB64url(parts[1]).length, 12);
    assert.equal(fromB64url(parts[2]).length, 16);
    assert.equal(resolveMovementTokenMaterial('caller-override-secret', 'production', 'production-jwt-secret'), 'production-jwt-secret');
    assert.equal(resolveMovementTokenMaterial('dev-override-secret', 'test', 'jwt-secret-value-ok'), 'dev-override-secret');
    assert.throws(
      () => resolveMovementTokenMaterial('x', 'production', 'short'),
      (error) => error.code === 'MOVEMENT_TOKEN_SECRET' && error.status === 503,
    );
  });

  it('rejects ciphertext, tag, IV, version, and Base64URL tampering without leaking details', () => {
    const token = sealMovementToken(payload(), { secret: SECRET });
    const [prefix, iv, tag, body] = partsOf(token);
    assert.equal(openMovementToken(`${prefix}.${iv}.${tag}.${body.slice(0, -2)}aa`, { secret: SECRET }), null);
    assert.equal(openMovementToken(`${prefix}.${iv}.${tag.slice(0, -2)}aa.${body}`, { secret: SECRET }), null);
    assert.equal(openMovementToken(`${prefix}.${iv.slice(0, -2)}aa.${tag}.${body}`, { secret: SECRET }), null);
    assert.equal(openMovementToken(`mw0.${iv}.${tag}.${body}`, { secret: SECRET }), null);
    assert.equal(openMovementToken('mw1.%%%.%%%.%%%', { secret: SECRET }), null);
    assert.equal(openMovementToken('mw1.only.three', { secret: SECRET }), null);
    assert.equal(openMovementToken('', { secret: SECRET }), null);
  });

  it('binds user, session, ruleset, expiry, and secret; replay uses a new sequence', () => {
    const token = issueMovementToken({
      session: { id: 'sess-1' },
      userId: USER,
      sample: sample(),
      sequence: 0,
      accM: 12,
      now: NOW,
    }, { secret: SECRET });
    const ok = readMovementToken(token, { userId: USER, sessionId: 'sess-1', now: NOW }, { secret: SECRET });
    assert.equal(ok.ok, true);
    assert.equal(readMovementToken(token, { userId: OTHER, sessionId: 'sess-1', now: NOW }, { secret: SECRET }).reason, 'SEGMENT_TOKEN_INVALID');
    assert.equal(readMovementToken(token, { userId: USER, sessionId: 'sess-other', now: NOW }, { secret: SECRET }).reason, 'SEGMENT_TOKEN_INVALID');
    const expired = sealMovementToken({ ...payload(), exp: NOW.getTime() - 1 }, { secret: SECRET });
    assert.ok(openMovementToken(expired, { secret: SECRET }));
    assert.equal(readMovementToken(expired, { userId: USER, sessionId: 'sess-1', now: NOW }, { secret: SECRET }).reason, 'SEGMENT_TOKEN_EXPIRED');
    const wrongRs = sealMovementToken({ ...payload(), rs: 'other-ruleset' }, { secret: SECRET });
    assert.equal(readMovementToken(wrongRs, { userId: USER, sessionId: 'sess-1', now: NOW }, { secret: SECRET }).reason, 'SEGMENT_TOKEN_INVALID');
    assert.equal(openMovementToken(token, { secret: 'other-secret-value' }), null);
  });
});

describe('privacy', () => {
  it('redacts coordinates and continuation tokens from logs', () => {
    const redacted = redactMovementValue({
      latitude: 37.422,
      longitude: -122.084,
      continuationToken: 'mw1.abc',
      nested: { token: 'mw1.xyz', outcome: 'SEGMENT_ACCEPTED' },
    });
    assert.equal(redacted.latitude, '[redacted]');
    assert.equal(redacted.longitude, '[redacted]');
    assert.equal(redacted.continuationToken, '[redacted]');
    assert.equal(redacted.nested.token, '[redacted]');
    const lines = [];
    const original = console.warn;
    console.warn = (...args) => lines.push(args.join(' '));
    try {
      logMovementSafe('[medi-world] movement segment failed', {
        latitude: 37.422,
        continuationToken: 'mw1.secret',
        code: 'X',
      });
    } finally {
      console.warn = original;
    }
    assert.equal(lines.join(' ').includes('37.422'), false);
    assert.equal(lines.join(' ').includes('mw1.secret'), false);
  });

  it('persists no coordinate or route columns in SQL or Prisma models', () => {
    const sql = readFileSync(join(HERE, '../../../../prisma/phase43-medi-world-movement.sql'), 'utf8');
    assert.equal(/\blatitude\b/i.test(sql), false);
    assert.equal(/\blongitude\b/i.test(sql), false);
    assert.equal(/\bpolyline\b/i.test(sql), false);
    assert.equal(/\broute\b/i.test(sql), false);
    const schema = readFileSync(join(HERE, '../../../../prisma/schema.prisma'), 'utf8');
    const movement = schema.split('model WorldMovementSession')[1].split('model ')[0];
    assert.equal(/latitude/i.test(movement), false);
    assert.equal(/longitude/i.test(movement), false);
    const appJson = JSON.parse(readFileSync(join(HERE, '../../../../../mobile/app.json'), 'utf8'));
    const perms = JSON.stringify(appJson);
    assert.equal(perms.includes('ACCESS_BACKGROUND_LOCATION'), false);
    assert.ok(perms.includes('ACCESS_FINE_LOCATION'));
  });
});

describe('Movement lifecycle', () => {
  it('starts, pauses, resumes, finishes, and will not resume a completed session', async () => {
    const db = createQuestFakeDb();
    const started = await startWalk(db);
    assert.equal(started.outcome, 'SESSION_STARTED');
    assert.equal(started.session.status, 'active');
    assert.ok(started.session.continuationToken.startsWith('mw1.'));
    assert.equal(started.session.latitude, undefined);

    const paused = await pauseMovementSession(USER, started.session.id, { idempotencyKey: 'pause-1' }, opts(db));
    assert.equal(paused.session.status, 'paused');
    const againPause = await pauseMovementSession(USER, started.session.id, { idempotencyKey: 'pause-2' }, opts(db));
    assert.equal(againPause.session.status, 'paused');

    const resumeAt = new Date(NOW.getTime() + 30_000);
    const resumed = await resumeMovementSession(
      USER,
      started.session.id,
      { ...sample({ now: resumeAt, idempotencyKey: 'resume-1', meters: 0 }), idempotencyKey: 'resume-1' },
      opts(db, { now: resumeAt }),
    );
    assert.equal(resumed.session.status, 'active');
    assert.ok(resumed.session.continuationToken);

    const credited = await creditSeconds(db, { session: { ...resumed.session, continuationToken: resumed.session.continuationToken } }, 40, { prefix: 'life' });
    const finished = await finishMovementSession(USER, started.session.id, { idempotencyKey: 'finish-1' }, opts(db, { now: new Date(NOW.getTime() + 80_000) }));
    assert.equal(finished.session.status, 'completed');
    await assert.rejects(
      () => resumeMovementSession(USER, started.session.id, { ...sample({ now: resumeAt, idempotencyKey: 'resume-dead' }) }, opts(db, { now: resumeAt })),
      (error) => error.code === 'MOVEMENT_INVALID_TRANSITION',
    );
    const retry = await finishMovementSession(USER, started.session.id, { idempotencyKey: 'finish-1' }, opts(db));
    assert.equal(retry.session.status, 'completed');
    assert.equal(credited.session.acceptedDurationSec > 0, true);
  });

  it('keeps one open session and retries start stably', async () => {
    const db = createQuestFakeDb();
    const first = await startWalk(db, { idempotencyKey: 'open-a' });
    const retry = await startWalk(db, { idempotencyKey: 'open-a' });
    assert.equal(retry.session.id, first.session.id);
    await assert.rejects(
      () => startWalk(db, { idempotencyKey: 'open-b' }),
      (error) => error.code === 'MOVEMENT_OPEN_SESSION',
    );
    await abandonMovementSession(USER, first.session.id, { idempotencyKey: 'abandon-a' }, opts(db));
    const second = await startWalk(db, { idempotencyKey: 'open-c' });
    assert.notEqual(second.session.id, first.session.id);
  });

  it('expires a stale session deterministically and awards nothing', async () => {
    const db = createQuestFakeDb();
    const started = await startWalk(db);
    const later = new Date(NOW.getTime() + SESSION_TTL_MS + 1000);
    const current = await getCurrentMovementSession(USER, opts(db, { now: later }));
    assert.equal(current.session.status, 'expired');
    const finished = await finishMovementSession(USER, started.session.id, { idempotencyKey: 'fin-exp' }, opts(db, { now: later }));
    assert.equal(finished.session.status, 'expired');
    assert.equal(await db.mediWorldLedger.count({ where: { userId: USER } }), 0);
  });

  it('abandons without a reward', async () => {
    const db = createQuestFakeDb();
    const started = await startWalk(db);
    await creditSeconds(db, started, 40);
    const abandoned = await abandonMovementSession(USER, started.session.id, { idempotencyKey: 'ab' }, opts(db));
    assert.equal(abandoned.session.status, 'abandoned');
    assert.equal(abandoned.session.verificationStatus, 'rejected');
    assert.equal(await db.mediWorldLedger.count({ where: { userId: USER, sourceType: 'MOVEMENT_SESSION' } }), 0);
  });
});

describe('segment chain', () => {
  it('accepts a valid chain and rejects altered, expired, replayed, and cross-session tokens', async () => {
    const db = createQuestFakeDb();
    const started = await startWalk(db);
    const t1 = new Date(NOW.getTime() + 20_000);
    const ok = await submitMovementSegment(
      USER,
      started.session.id,
      { ...sample({ meters: 28, now: t1, idempotencyKey: 's1' }), continuationToken: started.session.continuationToken },
      opts(db, { now: t1 }),
    );
    assert.equal(ok.outcome, 'SEGMENT_ACCEPTED');
    assert.notEqual(ok.session.continuationToken, started.session.continuationToken);

    const dup = await submitMovementSegment(
      USER,
      started.session.id,
      { ...sample({ meters: 28, now: t1, idempotencyKey: 's1' }), continuationToken: started.session.continuationToken },
      opts(db, { now: t1 }),
    );
    assert.equal(dup.outcome, 'SEGMENT_ACCEPTED');
    assert.equal(dup.session.acceptedSegmentCount, 1);

    const other = await startWalk(db, { userId: OTHER, idempotencyKey: 'other-start' });
    const stolen = await submitMovementSegment(
      OTHER,
      other.session.id,
      { ...sample({ meters: 28, now: t1, idempotencyKey: 'stolen' }), continuationToken: started.session.continuationToken },
      opts(db, { now: t1 }),
    );
    assert.equal(stolen.outcome, 'SEGMENT_TOKEN_INVALID');

    const altered = `${ok.session.continuationToken.slice(0, -3)}zzz`;
    const bad = await submitMovementSegment(
      USER,
      started.session.id,
      { ...sample({ meters: 56, now: new Date(NOW.getTime() + 40_000), idempotencyKey: 's2' }), continuationToken: altered },
      opts(db, { now: new Date(NOW.getTime() + 40_000) }),
    );
    assert.equal(bad.outcome, 'SEGMENT_TOKEN_INVALID');

    const staleNow = new Date(NOW.getTime() + 120_000);
    const expired = await submitMovementSegment(
      USER,
      started.session.id,
      { ...sample({ meters: 56, now: staleNow, idempotencyKey: 's3' }), continuationToken: ok.session.continuationToken },
      opts(db, { now: staleNow }),
    );
    assert.equal(expired.outcome, 'SEGMENT_REANCHORED');
    assert.equal(expired.session.acceptedDurationSec, ok.session.acceptedDurationSec);
    assert.equal(expired.session.mediKey, 'reanchor');
    assert.ok(expired.session.continuationToken);
    assert.notEqual(expired.session.continuationToken, ok.session.continuationToken);
  });
});

describe('Movement verification + rewards', () => {
  it('does not advance duration while paused, offline-gap, or backgrounded', async () => {
    const db = createQuestFakeDb();
    const started = await startWalk(db);
    await pauseMovementSession(USER, started.session.id, { idempotencyKey: 'p' }, opts(db));
    const t1 = new Date(NOW.getTime() + 20_000);
    const pausedSeg = await submitMovementSegment(
      USER,
      started.session.id,
      { ...sample({ meters: 28, now: t1, idempotencyKey: 'paused-seg' }), continuationToken: started.session.continuationToken },
      opts(db, { now: t1 }),
    );
    assert.equal(pausedSeg.outcome, 'SEGMENT_PAUSED');
    assert.equal(pausedSeg.session.acceptedDurationSec, 0);

    const resumeAt = new Date(NOW.getTime() + 30_000);
    const resumed = await resumeMovementSession(
      USER,
      started.session.id,
      { ...sample({ now: resumeAt, idempotencyKey: 'r1' }), idempotencyKey: 'r1' },
      opts(db, { now: resumeAt }),
    );
    const bg = await submitMovementSegment(
      USER,
      started.session.id,
      {
        ...sample({ meters: 28, now: new Date(NOW.getTime() + 50_000), idempotencyKey: 'bg', appState: 'background' }),
        continuationToken: resumed.session.continuationToken,
      },
      opts(db, { now: new Date(NOW.getTime() + 50_000) }),
    );
    assert.equal(bg.outcome, 'SEGMENT_BACKGROUND');
    assert.equal(bg.session.acceptedDurationSec, 0);
  });

  it('pays Phase 39 bands once, caps at 100%, and ignores Quest/Adventure duplication', async () => {
    const db = createQuestFakeDb();
    const cases = [
      [40, 'PERSONAL_GOAL_BELOW_HALF', 0, 0],
      [160, 'PERSONAL_GOAL_HALF_COMPLETE', 4, 4],
      [240, 'PERSONAL_GOAL_MOSTLY_COMPLETE', 7, 8],
      [300, 'PERSONAL_GOAL_COMPLETE', 10, 12],
      [360, 'PERSONAL_GOAL_COMPLETE', 10, 12],
    ];
    for (const [sec, reason, energy, xp] of cases) {
      const userId = `band-${sec}`;
      const started = await startWalk(db, { userId, idempotencyKey: `start-${sec}` });
      await creditSeconds(db, started, sec, { userId, prefix: String(sec) });
      const finished = await finishMovementSession(userId, started.session.id, { idempotencyKey: `fin-${sec}` }, opts(db, { now: new Date(NOW.getTime() + 400_000) }));
      assert.equal(finished.session.completionRatioBps <= 10_000, true);
      assert.equal(finished.reward.reasonCode, reason);
      assert.equal(finished.reward.energyAmount, energy);
      assert.equal(finished.reward.worldXp, xp);
      const again = await finishMovementSession(userId, started.session.id, { idempotencyKey: `fin-${sec}-b` }, opts(db));
      assert.equal(again.reward.duplicate, true);
      assert.equal(
        await db.mediWorldLedger.count({ where: { userId, sourceType: 'MOVEMENT_SESSION' } }),
        1,
      );
      assert.equal(await db.questCompletion.count({ where: {} }), 0);
      assert.equal(await db.mediWorldDailyAdventure.count({ where: { userId } }), 0);
    }
  });

  it('records mock-location as a risk flag without a permanent ban', async () => {
    const db = createQuestFakeDb();
    const started = await startWalk(db, { mockLocation: true, idempotencyKey: 'mock-start' });
    assert.equal(started.session.mockLocationRisk, true);
    const t1 = new Date(NOW.getTime() + 20_000);
    const ok = await submitMovementSegment(
      USER,
      started.session.id,
      { ...sample({ meters: 28, now: t1, idempotencyKey: 'mock-seg', mockLocation: true }), continuationToken: started.session.continuationToken },
      opts(db, { now: t1 }),
    );
    assert.equal(ok.outcome, 'SEGMENT_ACCEPTED');
    assert.equal(ok.session.mockLocationRisk, true);
  });

  it('rejects poor accuracy and stale samples without minting duration', async () => {
    const db = createQuestFakeDb();
    const stale = await startWalk(db, { locationTimestamp: new Date(NOW.getTime() - 40_000), idempotencyKey: 'stale' });
    assert.equal(stale.session, null);
    const started = await startWalk(db, { idempotencyKey: 'acc-start' });
    const t1 = new Date(NOW.getTime() + 20_000);
    const poor = await submitMovementSegment(
      USER,
      started.session.id,
      { ...sample({ meters: 28, now: t1, idempotencyKey: 'poor', horizontalAccuracy: 80 }), continuationToken: started.session.continuationToken },
      opts(db, { now: t1 }),
    );
    assert.equal(poor.outcome, 'SEGMENT_INACCURATE');
    assert.equal(poor.session.acceptedDurationSec, 0);
    assert.equal(poor.session.mediKey, 'low_gps');
    assert.notEqual(poor.session.mediKey, 'reanchor');
  });
});

describe('finish world snapshot', () => {
  it('attaches the canonical profile so cached Hub values update without remount', async () => {
    const db = createQuestFakeDb();
    const started = await startWalk(db, { targetMinutes: 5, idempotencyKey: 'world-start' });
    await creditSeconds(db, started, 300, { prefix: 'world' });
    const finished = await finishMovementSession(
      USER,
      started.session.id,
      { idempotencyKey: 'world-fin' },
      opts(db, { now: new Date(NOW.getTime() + 400_000) }),
    );
    const snap = await getMediWorldProfileSnapshot(USER, opts(db, { now: new Date(NOW.getTime() + 400_000) }));
    assert.equal(finished.world.profile.careEnergy.movement, snap.profile.careEnergy.movement);
    assert.equal(finished.world.today.worldXp.used, snap.today.worldXp.used);
    assert.equal(finished.world.profile.worldXp, snap.profile.worldXp);
    assert.equal(finished.world.profile.worldLevel, snap.profile.worldLevel);
    assert.equal(finished.world.latestReward.sourceType, 'MOVEMENT_SESSION');
    assert.equal(finished.world.profile.careEnergy.movement, 10);
    assert.equal(finished.world.today.worldXp.used, 12);
    const again = await finishMovementSession(USER, started.session.id, { idempotencyKey: 'world-fin-2' }, opts(db));
    assert.equal(again.reward.duplicate, true);
    assert.equal(again.world.profile.careEnergy.movement, finished.world.profile.careEnergy.movement);
    assert.equal(again.world.today.worldXp.used, finished.world.today.worldXp.used);
    assert.equal(again.world.profile.worldXp, finished.world.profile.worldXp);
  });

  it('agrees with GET on an exact level boundary and a daily World XP cap', async () => {
    const db = createQuestFakeDb();
    const levelUser = 'user-level-boundary';
    await ensureMediWorldProfile(levelUser, opts(db));
    await db.mediWorldProfile.update({ where: { userId: levelUser }, data: { foundationXp: 88, foundationLevel: 1 } });
    const started = await startWalk(db, { userId: levelUser, targetMinutes: 5, idempotencyKey: 'lvl-start' });
    await creditSeconds(db, started, 300, { userId: levelUser, prefix: 'lvl' });
    const finished = await finishMovementSession(
      levelUser,
      started.session.id,
      { idempotencyKey: 'lvl-fin' },
      opts(db, { now: new Date(NOW.getTime() + 400_000) }),
    );
    const snap = await getMediWorldProfileSnapshot(levelUser, opts(db, { now: new Date(NOW.getTime() + 400_000) }));
    assert.equal(finished.world.profile.worldXp, 100);
    assert.equal(finished.world.profile.worldLevel, 2);
    assert.equal(snap.profile.worldLevel, 2);
    assert.equal(finished.world.profile.worldXp, snap.profile.worldXp);

    const capUser = 'user-daily-cap';
    await ensureMediWorldProfile(capUser, opts(db));
    await db.mediWorldLedger.create({
      data: {
        userId: capUser,
        idempotencyKey: 'cap-seed',
        sourceType: 'FOUNDATION_TEST',
        sourceId: 'cap-seed',
        adapterId: 'activity.walking',
        energyType: 'movement',
        transactionType: 'CREDIT',
        energyAmount: 0,
        foundationXp: 48,
        progressState: 'verified',
        completionRatioBps: 10_000,
        periodKey: '2026-09-13',
        reasonCode: 'PERSONAL_GOAL_COMPLETE',
        createdAt: NOW,
      },
    });
    const capStart = await startWalk(db, { userId: capUser, targetMinutes: 5, idempotencyKey: 'cap-start' });
    await creditSeconds(db, capStart, 300, { userId: capUser, prefix: 'cap' });
    const capped = await finishMovementSession(
      capUser,
      capStart.session.id,
      { idempotencyKey: 'cap-fin' },
      opts(db, { now: new Date(NOW.getTime() + 400_000) }),
    );
    const capSnap = await getMediWorldProfileSnapshot(capUser, opts(db, { now: new Date(NOW.getTime() + 400_000) }));
    assert.equal(capped.world.today.worldXp.used, 60);
    assert.equal(capped.world.today.worldXp.remaining, 0);
    assert.equal(capSnap.today.worldXp.used, 60);
    assert.equal(capped.world.today.worldXp.used, capSnap.today.worldXp.used);
  });
});

describe('preferences, history, flags, routes', () => {
  it('stores allowlisted preferences and omits tokens from history', async () => {
    const db = createQuestFakeDb();
    const prefs = await updateMovementPreferences(USER, { movementMode: 'gentle_move', targetMinutes: 5 }, opts(db));
    assert.equal(prefs.movementMode, 'gentle_move');
    const loaded = await getMovementPreferences(USER, opts(db));
    assert.equal(loaded.targetMinutes, 5);
    await assert.rejects(
      () => updateMovementPreferences(USER, { movementMode: 'wheelchair', targetMinutes: 10 }, opts(db)),
      (error) => error.code === 'MOVEMENT_MODE_INVALID',
    );
    const started = await startWalk(db, { movementMode: 'gentle_move', targetMinutes: 5, idempotencyKey: 'hist' });
    await finishMovementSession(USER, started.session.id, { idempotencyKey: 'fin-h' }, opts(db));
    const history = await getMovementHistory(USER, opts(db));
    assert.equal(history.items[0].continuationToken, undefined);
    assert.equal(history.items[0].latitude, undefined);
    const config = await getMovementConfig(USER, opts(db));
    assert.equal(config.backgroundLocation, false);
    assert.equal(config.lastKnownAllowed, false);
    assert.deepEqual(config.modes, ['walk', 'run', 'gentle_move']);
  });

  it('disables outside the independent flag and has no QA production path', async () => {
    const db = createQuestFakeDb();
    await assert.rejects(
      () => startWalk(db, { movementFlag: '0' }),
      (error) => error.code === 'MOVEMENT_DISABLED',
    );
    await assert.rejects(
      () => startWalk(db, { nodeEnv: 'production', flag: '1', movementFlag: '0' }),
      (error) => error.code === 'MOVEMENT_DISABLED',
    );
    const paths = [];
    mediWorldRouter.stack.forEach((layer) => {
      if (layer.route) paths.push(`${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);
    });
    assert.ok(paths.some((row) => row.includes('/movement/sessions')));
    assert.equal(paths.some((row) => row.includes('/movement/qa')), false);
  });

  it('keeps the migration after Explore', () => {
    const folder = join(HERE, '../../../../prisma/migrations');
    const names = readdirSync(folder).filter((name) => /^\d{14}_/.test(name));
    assert.ok(names.includes('20260912230000_medi_world_explore'));
    assert.ok(names.includes('20260913010000_medi_world_movement'));
    assert.ok(names.indexOf('20260913010000_medi_world_movement') > names.indexOf('20260912230000_medi_world_explore'));
  });
});
