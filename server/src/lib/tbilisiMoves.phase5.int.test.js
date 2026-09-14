import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';
import { env } from '../config/env.js';
import { tbilisiMovesRouter } from '../routes/tbilisiMoves.routes.js';
import { adminTbilisiMovesRouter } from '../routes/adminTbilisiMoves.routes.js';
import { healthMetricsRouter } from '../routes/health-metrics.routes.js';
import { errorHandler } from '../middleware/error.js';
import { signToken } from '../middleware/auth.js';
import { TBILISI_MOVES_DISTRICTS } from './tbilisiMoves/catalog.js';
import { enrollUser, leaveCompetition, requestDistrictChange } from './tbilisiMoves/membership.js';
import { putObservation } from './tbilisiMoves/ingest.js';
import { finalizeDueRounds, finalizeRound, previewFinalize } from './tbilisiMoves/finalize.js';
import { setCreditExclusion } from './tbilisiMoves/moderate.js';
import { addDaysYmd, tbilisiMidnight, tbilisiYmd } from './tbilisiMoves/time.js';
import {
  assertDisposableTbilisiMovesDatabase,
  resetTbilisiMovesRound,
  skipUnlessIsolatedTbilisiMovesDb,
} from './tbilisiMoves/testEnv.js';

function listen(app) {
  const server = createServer(app);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((done, fail) => server.close((err) => (err ? fail(err) : done()))),
      });
    });
  });
}

function observation({ date, steps, now, provider = 'APPLE_HEALTH', source = 'install-1', id = randomUUID(), seq = 1 }) {
  const start = tbilisiMidnight(date);
  const dayEnd = tbilisiMidnight(addDaysYmd(date, 1));
  const endMs = Math.min(now.getTime(), dayEnd.getTime() - 1000);
  const end = new Date(Math.max(endMs, start.getTime() + 1000));
  return {
    clientObservationId: id,
    provider,
    sourceInstallationId: source,
    tbilisiDate: date,
    intervalStart: start.toISOString(),
    intervalEnd: end.toISOString(),
    cumulativeSteps: steps,
    recordedAt: new Date(Math.min(now.getTime(), end.getTime())).toISOString(),
    clientSequence: seq,
  };
}

async function waitForAdvisoryWaiter(timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const rows = await prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM pg_locks WHERE locktype = 'advisory' AND NOT granted) AS waiting,
        (SELECT COUNT(*)::int FROM pg_stat_activity WHERE wait_event = 'advisory' OR wait_event_type = 'Lock') AS locked
    `;
    if (rows[0].waiting > 0 || rows[0].locked > 0) return rows[0];
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('advisory lock waiter did not appear');
}

function holdAdvisory(key) {
  let settle;
  let settled = false;
  const released = new Promise((resolve) => {
    settle = resolve;
  });
  let markReady;
  const ready = new Promise((resolve) => {
    markReady = resolve;
  });
  const done = prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      markReady();
      await released;
    },
    { timeout: 30_000, maxWait: 15_000 },
  );
  return {
    ready,
    release() {
      if (!settled) {
        settled = true;
        settle();
      }
    },
    done,
  };
}

describe('tbilisi moves Phase 5 isolated integration', { timeout: 180_000 }, () => {
  it('enforces membership, ingest, ranking, races, RBAC, and health isolation', async (t) => {
    if (skipUnlessIsolatedTbilisiMovesDb(t)) return;
    await assertDisposableTbilisiMovesDatabase(prisma);

    const stamp = `${Date.now()}`;
    const nowOpen = new Date('2026-07-20T12:00:00.000Z');
    const today = tbilisiYmd(nowOpen);
    await resetTbilisiMovesRound(prisma, today);
    const d1 = TBILISI_MOVES_DISTRICTS[0];
    const d2 = TBILISI_MOVES_DISTRICTS[1];
    const d3 = TBILISI_MOVES_DISTRICTS[2];
    const created = [];
    const admins = [];
    let http = null;
    const passwordHash = await bcrypt.hash('TmPass!234', 4);

    async function user(label) {
      const row = await prisma.user.create({
        data: {
          email: `tm.p5.${label}.${stamp}@medicard.test`,
          fullName: `Secret ${label}`,
          passwordHash,
        },
      });
      created.push(row.id);
      return row;
    }
    async function admin(label, capabilities) {
      const row = await prisma.admin.create({
        data: {
          email: `tm.p5.${label}.${stamp}@medicard.test`,
          fullName: `TM ${label}`,
          passwordHash,
          capabilities,
        },
      });
      admins.push(row.id);
      return row;
    }

    async function json(method, path, { user, admin, body } = {}) {
      const headers = { Accept: 'application/json' };
      if (body) headers['Content-Type'] = 'application/json';
      if (user) headers.Authorization = `Bearer ${signToken(user)}`;
      if (admin) headers.Authorization = `Bearer ${jwt.sign({ sub: admin.id, role: 'admin' }, env.JWT_SECRET)}`;
      const res = await fetch(`${http.origin}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text };
      }
      return { status: res.status, data };
    }

    try {
      const [alice, bob, cara, dana, erin, viewer, manager, reviewer, corrector] = await Promise.all([
        user('a'),
        user('b'),
        user('c'),
        user('d'),
        user('e'),
        admin('view', ['TBILISI_MOVES_VIEW']),
        admin('manage', ['TBILISI_MOVES_VIEW', 'TBILISI_MOVES_MANAGE']),
        admin('review', ['TBILISI_MOVES_VIEW', 'TBILISI_MOVES_REVIEW']),
        admin('correct', ['TBILISI_MOVES_VIEW', 'TBILISI_MOVES_CORRECT']),
      ]);

      const app = express();
      app.use(express.json());
      app.use('/api/tbilisi-moves', tbilisiMovesRouter);
      app.use('/api/admin/tbilisi-moves', adminTbilisiMovesRouter);
      app.use('/api/health-metrics', healthMetricsRouter);
      app.use(errorHandler);
      http = await listen(app);

      await prisma.tbilisiMovesConfig.update({
        where: { id: 'default' },
        data: {
          featureEnabled: true,
          enrollmentOpen: true,
          ingestionPaused: false,
          competitionPaused: false,
          competitiveCap: 10000,
          defaultDailyTarget: 20000,
          minParticipantsForRank: 2,
          cooldownDays: 7,
          lateSyncGraceHours: 8,
          leaderRecognitionEnabled: true,
          leaderRewardedRanks: 3,
          districtGoalBadgeEnabled: true,
          pilotMode: true,
          revision: { increment: 1 },
        },
      });

      const racer = await user('racer');
      const [raceEnroll1, raceEnroll2] = await Promise.all([
        enrollUser({
          userId: racer.id,
          districtId: d1.id,
          publicHandle: 'რბოლა',
          publicAvatarId: 'avatar-1',
          now: nowOpen,
        }).catch((error) => error),
        enrollUser({
          userId: racer.id,
          districtId: d2.id,
          publicHandle: 'რბოლა',
          publicAvatarId: 'avatar-1',
          now: nowOpen,
        }).catch((error) => error),
      ]);
      const enrollOk = [raceEnroll1, raceEnroll2].filter((row) => row.enrolled);
      const enrollDenied = [raceEnroll1, raceEnroll2].filter((row) => row.code === 'ALREADY_ENROLLED');
      assert.equal(enrollOk.length, 1, JSON.stringify([raceEnroll1, raceEnroll2]));
      assert.equal(enrollDenied.length, 1);

      await enrollUser({
        userId: alice.id,
        districtId: d1.id,
        publicHandle: 'ანა',
        publicAvatarId: 'avatar-1',
        now: nowOpen,
      });
      const aliceMembership = await prisma.tbilisiMovesMembership.findUnique({ where: { userId: alice.id } });
      assert.equal(aliceMembership.status, 'ACTIVE');
      assert.equal(aliceMembership.districtId, d1.id);

      await enrollUser({
        userId: bob.id,
        districtId: d1.id,
        publicHandle: 'ბექა',
        publicAvatarId: 'avatar-2',
        now: nowOpen,
      });
      await enrollUser({
        userId: cara.id,
        districtId: d2.id,
        publicHandle: 'გიო',
        publicAvatarId: 'avatar-3',
        now: nowOpen,
      });

      await prisma.tbilisiMovesMembership.update({
        where: { userId: alice.id },
        data: { lockUntilDate: today },
      });
      const currentDistrictId = aliceMembership.districtId;
      const changeTargets = [d1, d2, d3].filter((district) => district.id !== currentDistrictId);
      const [chg1, chg2] = await Promise.all([
        requestDistrictChange({ userId: alice.id, districtId: changeTargets[0].id, now: nowOpen }).catch((error) => error),
        requestDistrictChange({ userId: alice.id, districtId: changeTargets[1].id, now: nowOpen }).catch((error) => error),
      ]);
      const chgOk = [chg1, chg2].filter((row) => row.pendingDistrictId);
      const chgDenied = [chg1, chg2].filter((row) => row.code === 'CHANGE_PENDING');
      assert.equal(chgOk.length, 1);
      assert.equal(chgDenied.length, 1);
      const pending = await prisma.tbilisiMovesMembership.findUnique({ where: { userId: alice.id } });
      assert.equal(pending.districtId, currentDistrictId);
      assert.equal(pending.pendingEffectiveDate, addDaysYmd(today, 1));

      const leaveBob = await leaveCompetition({ userId: bob.id, now: nowOpen });
      assert.equal(leaveBob.status, 'LEFT');
      const lockAfterLeave = leaveBob.lockUntilDate;
      const rejoinOther = await enrollUser({
        userId: bob.id,
        districtId: d2.id,
        publicHandle: 'ბექა',
        now: nowOpen,
      }).catch((error) => error);
      assert.equal(rejoinOther.code, 'DISTRICT_LOCKED');
      const rejoinSame = await enrollUser({
        userId: bob.id,
        districtId: d1.id,
        publicHandle: 'ბექა',
        now: nowOpen,
      });
      assert.equal(rejoinSame.lockUntilDate, lockAfterLeave);

      const firstId = randomUUID();
      const put1 = await putObservation({
        userId: alice.id,
        body: observation({ date: today, steps: 4000, now: nowOpen, id: firstId, seq: 1 }),
        now: nowOpen,
      });
      assert.equal(put1.credit.eligibleSteps, 4000);
      const retry = await putObservation({
        userId: alice.id,
        body: observation({ date: today, steps: 4000, now: nowOpen, id: firstId, seq: 1 }),
        now: nowOpen,
      });
      assert.equal(retry.idempotent, true);
      const conflict = await putObservation({
        userId: alice.id,
        body: observation({ date: today, steps: 5000, now: nowOpen, id: firstId, seq: 2 }),
        now: nowOpen,
      }).catch((error) => error);
      assert.equal(conflict.code, 'OBSERVATION_CONFLICT');

      const later = new Date(nowOpen.getTime() + 2000);
      const up = await putObservation({
        userId: alice.id,
        body: observation({ date: today, steps: 6200, now: later, seq: 2 }),
        now: later,
      });
      assert.equal(up.credit.eligibleSteps, 6200);
      const stale = await putObservation({
        userId: alice.id,
        body: observation({ date: today, steps: 9000, now: new Date(nowOpen.getTime() - 5000), seq: 0 }),
        now: later,
      });
      assert.equal(stale.reason, 'STALE');
      assert.equal(stale.credit.eligibleSteps, 6200);
      const down = await putObservation({
        userId: alice.id,
        body: observation({ date: today, steps: 3000, now: new Date(later.getTime() + 1000), seq: 3 }),
        now: new Date(later.getTime() + 1000),
      });
      assert.equal(down.credit.eligibleSteps, 3000);

      const otherSource = await putObservation({
        userId: alice.id,
        body: observation({
          date: today,
          steps: 8000,
          now: new Date(later.getTime() + 2000),
          provider: 'HEALTH_CONNECT',
          source: 'watch-9',
          seq: 4,
        }),
        now: new Date(later.getTime() + 2000),
      });
      assert.equal(otherSource.reason, 'SOURCE_CONFLICT');
      const credits = await prisma.tbilisiMovesCredit.findMany({ where: { userId: alice.id, date: today } });
      assert.equal(credits.length, 1);

      const capHit = await putObservation({
        userId: alice.id,
        body: observation({ date: today, steps: 15000, now: new Date(later.getTime() + 3000), seq: 5 }),
        now: new Date(later.getTime() + 3000),
      });
      assert.equal(capHit.credit.rawObservedSteps, 15000);
      assert.equal(capHit.credit.eligibleSteps, 10000);

      const healthBefore = await prisma.healthMetricDaily.findMany({ where: { userId: alice.id } });
      const health = await json('POST', '/api/health-metrics/sync', {
        user: alice,
        body: { daily: [{ date: today, steps: 22222 }] },
      });
      assert.ok(health.status === 200 || health.status === 201, JSON.stringify(health.data));
      const extra = await prisma.tbilisiMovesCredit.findMany({
        where: { userId: alice.id, rawObservedSteps: 22222 },
      });
      assert.equal(extra.length, 0);
      const healthDaily = await prisma.healthMetricDaily.findUnique({
        where: { userId_date: { userId: alice.id, date: today } },
      });
      assert.equal(healthDaily.steps, 22222);

      await putObservation({
        userId: bob.id,
        body: observation({ date: today, steps: 8000, now: new Date(later.getTime() + 4000) }),
        now: new Date(later.getTime() + 4000),
      });
      await putObservation({
        userId: cara.id,
        body: observation({ date: today, steps: 10000, now: new Date(later.getTime() + 4000) }),
        now: new Date(later.getTime() + 4000),
      });

      const creditRow = await prisma.tbilisiMovesCredit.findUnique({
        where: { userId_date: { userId: alice.id, date: today } },
      });
      const excluded = await setCreditExclusion({
        admin: reviewer,
        creditId: creditRow.id,
        excluded: true,
        reason: 'pilot exclusion survives later sync',
        now: new Date(later.getTime() + 5000),
      });
      assert.equal(excluded.credit.excluded, true);
      const afterExclude = await putObservation({
        userId: alice.id,
        body: observation({ date: today, steps: 16000, now: new Date(later.getTime() + 6000), seq: 8 }),
        now: new Date(later.getTime() + 6000),
      });
      assert.equal(afterExclude.credit.excluded, true);
      assert.equal(afterExclude.credit.rawObservedSteps, 16000);

      await prisma.tbilisiMovesConfig.update({
        where: { id: 'default' },
        data: { defaultDailyTarget: 50000, revision: { increment: 1 } },
      });
      const round = await prisma.tbilisiMovesRound.findUnique({ where: { date: today } });
      assert.equal(round.rulesSnapshot.defaultDailyTarget, 20000);
      assert.equal(round.rulesSnapshot.competitiveCap, 10000);
      assert.equal(round.rulesSnapshot.rewards.leaderRewardedRanks, 3);

      await enrollUser({
        userId: dana.id,
        districtId: d1.id,
        publicHandle: 'დანა',
        now: nowOpen,
      });
      await enrollUser({
        userId: erin.id,
        districtId: d1.id,
        publicHandle: 'ერინ',
        now: nowOpen,
      });
      const t2 = new Date(later.getTime() + 8000);
      await putObservation({
        userId: dana.id,
        body: observation({ date: today, steps: 7000, now: t2 }),
        now: t2,
      });
      await putObservation({
        userId: erin.id,
        body: observation({ date: today, steps: 7000, now: t2 }),
        now: t2,
      });

      const people = await json(
        'GET',
        `/api/tbilisi-moves/rounds/${today}/districts/${d1.id}/people?limit=1&offset=0`,
        { user: dana },
      );
      assert.equal(people.status, 200, JSON.stringify(people.data));
      assert.equal(people.data.people.length, 1);
      assert.ok(people.data.you);
      assert.equal(people.data.you.rank, 2);
      assert.equal(people.data.you.onPage, false);
      assert.equal(JSON.stringify(people.data).includes('Secret'), false);

      const districts = await json('GET', `/api/tbilisi-moves/rounds/${today}/districts`, { user: cara });
      const gldani = districts.data.districts.find((item) => item.id === d1.id);
      const didube = districts.data.districts.find((item) => item.id === d2.id);
      assert.equal(typeof gldani.goalRatio, 'number');
      assert.equal(typeof didube.goalRatio, 'number');
      assert.equal(didube.participantCount, 1);
      assert.equal(didube.unranked, true);

      const deniedCfg = await json('PATCH', '/api/admin/tbilisi-moves/config', {
        admin: viewer,
        body: { revision: 1, featureEnabled: false, reason: 'nope' },
      });
      assert.equal(deniedCfg.status, 403);
      const deniedDistrict = await json('PATCH', `/api/admin/tbilisi-moves/districts/${d1.id}`, {
        admin: viewer,
        body: { revision: 1, dailyTargetOverride: 9000, reason: 'nope' },
      });
      assert.equal(deniedDistrict.status, 403);
      const deniedArchive = await json('POST', `/api/admin/tbilisi-moves/districts/${d1.id}/archive`, {
        admin: viewer,
        body: { revision: 1, reason: 'nope' },
      });
      assert.equal(deniedArchive.status, 403);
      const deniedExclude = await json('POST', `/api/admin/tbilisi-moves/credits/${creditRow.id}/exclude`, {
        admin: viewer,
        body: { reason: 'viewer cannot exclude' },
      });
      assert.equal(deniedExclude.status, 403);
      const deniedFinalize = await json('POST', `/api/admin/tbilisi-moves/rounds/${today}/finalize`, {
        admin: viewer,
        body: { previewHash: 'a'.repeat(64), revision: 0 },
      });
      assert.equal(deniedFinalize.status, 403);
      const deniedCorrect = await json('POST', `/api/admin/tbilisi-moves/rounds/${today}/correct`, {
        admin: manager,
        body: { previewHash: 'a'.repeat(64), fromRevision: 1, reason: 'should deny' },
      });
      assert.equal(deniedCorrect.status, 403);

      const graceNow = new Date(new Date(round.graceEndsAt).getTime() + 1000);
      const ingestKey = `tbilisi-moves:round:${today}`;
      const holder = holdAdvisory(ingestKey);
      try {
        await holder.ready;
        const ingestRace = putObservation({
          userId: cara.id,
          body: observation({ date: today, steps: 11000, now: nowOpen, seq: 20 }),
          now: nowOpen,
        }).catch((error) => error);
        await waitForAdvisoryWaiter();
        const finalizeRace = finalizeRound({ date: today, now: graceNow, kind: 'INITIAL', actor: 'admin' }).catch(
          (error) => error,
        );
        holder.release();
        const [ingestResult, finalizeResult] = await Promise.all([ingestRace, finalizeRace, holder.done]);
        assert.ok(ingestResult.credit || ingestResult.code);
        assert.ok(finalizeResult.resultRevision || finalizeResult.code);
      } finally {
        holder.release();
        await holder.done.catch(() => {});
      }
      const afterRace = await prisma.tbilisiMovesRound.findUnique({ where: { date: today } });
      if (afterRace.status !== 'FINALIZED') {
        const published = await finalizeRound({ date: today, now: graceNow, kind: 'INITIAL', actor: 'runner' });
        assert.equal(published.status, 'FINALIZED');
      }

      const readyRound = await prisma.tbilisiMovesRound.findUnique({ where: { date: today } });
      if (readyRound.status !== 'FINALIZED') {
        await finalizeRound({ date: today, now: graceNow, kind: 'INITIAL', actor: 'admin' });
      }

      const holder2 = holdAdvisory(ingestKey);
      try {
        await holder2.ready;
        const moderateRace = setCreditExclusion({
          admin: reviewer,
          creditId: creditRow.id,
          excluded: false,
          reason: 'race reinstate',
          now: graceNow,
        }).catch((error) => error);
        await waitForAdvisoryWaiter();
        const adminFinalize = finalizeRound({ date: today, now: graceNow, kind: 'INITIAL', actor: 'admin' }).catch(
          (error) => error,
        );
        const runnerRace = finalizeDueRounds({ now: graceNow, date: today, dryRun: false }).catch((error) => error);
        holder2.release();
        await Promise.all([moderateRace, adminFinalize, runnerRace, holder2.done]);
      } finally {
        holder2.release();
        await holder2.done.catch(() => {});
      }

      const firstFinal = await prisma.tbilisiMovesRound.findUnique({ where: { date: today } });
      assert.equal(firstFinal.status, 'FINALIZED');
      const awardsBefore = await prisma.tbilisiMovesAward.count({ where: { date: today } });
      let retryFinalize;
      try {
        retryFinalize = await finalizeRound({ date: today, now: graceNow, kind: 'INITIAL', actor: 'runner' });
        assert.equal(retryFinalize.idempotent, true);
      } catch (error) {
        assert.equal(error.code, 'ROUND_FINALIZED');
      }
      const awardsAfterRetry = await prisma.tbilisiMovesAward.count({ where: { date: today } });
      assert.equal(awardsAfterRetry, awardsBefore);

      const dryCounts = {
        rounds: await prisma.tbilisiMovesRound.count({ where: { date: today, status: 'FINALIZED' } }),
        results: await prisma.tbilisiMovesResultRevision.count({ where: { date: today } }),
        awards: await prisma.tbilisiMovesAward.count({ where: { date: today } }),
        audits: await prisma.adminAuditLog.count({ where: { action: { startsWith: 'tbilisi_moves.round' } } }),
      };
      const dry = await finalizeDueRounds({ now: graceNow, date: today, dryRun: true });
      assert.equal(dry.dryRun, true);
      assert.equal(await prisma.tbilisiMovesRound.count({ where: { date: today, status: 'FINALIZED' } }), dryCounts.rounds);
      assert.equal(await prisma.tbilisiMovesResultRevision.count({ where: { date: today } }), dryCounts.results);
      assert.equal(await prisma.tbilisiMovesAward.count({ where: { date: today } }), dryCounts.awards);
      assert.equal(
        await prisma.adminAuditLog.count({ where: { action: { startsWith: 'tbilisi_moves.round' } } }),
        dryCounts.audits,
      );

      const missing = await finalizeDueRounds({ now: new Date('2026-07-25T12:00:00.000Z') });
      assert.equal(
        missing.processed.some((item) => item.date === '2026-07-19'),
        false,
      );

      const liveCredit = await prisma.tbilisiMovesCredit.findUnique({
        where: { userId_date: { userId: cara.id, date: today } },
      });
      const preview = await previewFinalize({ date: today, now: graceNow });
      assert.equal(preview.round.status, 'FINALIZED');
      const stalePreview = await json('POST', `/api/admin/tbilisi-moves/rounds/${today}/correct`, {
        admin: corrector,
        body: { previewHash: 'b'.repeat(64), fromRevision: preview.round.resultRevision, reason: 'stale hash' },
      });
      assert.equal(stalePreview.status, 409);
      assert.equal(stalePreview.data.code, 'PREVIEW_STALE');

      if (liveCredit && !liveCredit.excludedAt) {
        await setCreditExclusion({
          admin: reviewer,
          creditId: liveCredit.id,
          excluded: true,
          reason: 'correct after publish',
          now: graceNow,
        });
      }
      const fresh = await previewFinalize({ date: today, now: graceNow });
      const corrected = await finalizeRound({
        date: today,
        now: graceNow,
        kind: 'CORRECTION',
        previewHash: fresh.previewHash,
        fromRevision: fresh.round.resultRevision,
        reason: 'exclude contributor after review',
        admin: corrector,
      });
      assert.equal(corrected.kind, 'CORRECTION');
      assert.ok(corrected.resultRevision >= 2);
      const latest = await prisma.tbilisiMovesResultRevision.findFirst({
        where: { date: today },
        orderBy: { revision: 'desc' },
      });
      assert.equal(latest.kind, 'CORRECTION');

      const healthAfter = await prisma.healthMetricDaily.findMany({ where: { userId: alice.id } });
      assert.ok(healthAfter.some((row) => row.steps === 22222));
      assert.equal(healthDaily.steps, 22222);
      const cfg = await prisma.tbilisiMovesConfig.findUnique({ where: { id: 'default' } });
      assert.equal(cfg.pilotMode, true);
    } finally {
      if (http) await http.close();
      if (created.length) {
        await prisma.tbilisiMovesAward.deleteMany({ where: { userId: { in: created } } }).catch(() => {});
        await prisma.tbilisiMovesObservation.deleteMany({ where: { userId: { in: created } } }).catch(() => {});
        await prisma.tbilisiMovesCredit.deleteMany({ where: { userId: { in: created } } }).catch(() => {});
        await prisma.tbilisiMovesMembershipPeriod.deleteMany({ where: { userId: { in: created } } }).catch(() => {});
        await prisma.tbilisiMovesMembership.deleteMany({ where: { userId: { in: created } } }).catch(() => {});
        await prisma.healthMetricDaily.deleteMany({ where: { userId: { in: created } } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: { in: created } } }).catch(() => {});
      }
      if (admins.length) {
        await prisma.admin.deleteMany({ where: { id: { in: admins } } }).catch(() => {});
      }
    }
  });
});
