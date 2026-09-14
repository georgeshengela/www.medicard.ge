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
import { isTbilisiMovesSchemaMissing } from './tbilisiMoves/errors.js';
import { TBILISI_MOVES_DISTRICTS } from './tbilisiMoves/catalog.js';
import { skipUnlessIsolatedTbilisiMovesDb, resetTbilisiMovesRound } from './tbilisiMoves/testEnv.js';
import { addDaysYmd, tbilisiMidnight, tbilisiYmd } from './tbilisiMoves/time.js';

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

function authHeader(user) {
  return { Authorization: `Bearer ${signToken(user)}` };
}

function adminHeader(admin) {
  return { Authorization: `Bearer ${jwt.sign({ sub: admin.id, role: 'admin' }, env.JWT_SECRET)}` };
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

describe('tbilisi moves HTTP isolation', { timeout: 120_000 }, () => {
  it('covers enrollment, ingest, ranking, admin ACL, and health-sync isolation', async (t) => {
    if (skipUnlessIsolatedTbilisiMovesDb(t)) return;

    try {
      await prisma.tbilisiMovesConfig.findUnique({ where: { id: 'default' } });
    } catch (error) {
      if (isTbilisiMovesSchemaMissing(error)) {
        t.skip('Tbilisi Moves tables are not applied on the local database');
        return;
      }
      throw error;
    }

    const stamp = Date.now();
    const today = tbilisiYmd();
    const now = new Date();
    await resetTbilisiMovesRound(prisma, today);
    await prisma.tbilisiMovesIngestHold.deleteMany({});
    const d1 = TBILISI_MOVES_DISTRICTS[0];
    const d2 = TBILISI_MOVES_DISTRICTS[1];
    const created = [];
    const admins = [];
    let http = null;
      const snapshot = await prisma.tbilisiMovesConfig.findUnique({ where: { id: 'default' } });
      await prisma.tbilisiMovesConfig.update({
        where: { id: 'default' },
        data: {
          featureEnabled: false,
          enrollmentOpen: false,
          ingestionPaused: false,
          competitionPaused: false,
          revision: { increment: 1 },
        },
      });

    async function json(method, path, { user, admin, body } = {}) {
      const headers = { Accept: 'application/json' };
      if (body) headers['Content-Type'] = 'application/json';
      if (user) Object.assign(headers, authHeader(user));
      if (admin) Object.assign(headers, adminHeader(admin));
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
      const passwordHash = await bcrypt.hash('TmPass!234', 4);
      const userA = await prisma.user.create({
        data: { email: `tm.a.${stamp}@medicard.test`, fullName: 'Secret Name A', passwordHash },
      });
      const userB = await prisma.user.create({
        data: { email: `tm.b.${stamp}@medicard.test`, fullName: 'Secret Name B', passwordHash },
      });
      const userC = await prisma.user.create({
        data: { email: `tm.c.${stamp}@medicard.test`, fullName: 'Secret Name C', passwordHash },
      });
      created.push(userA.id, userB.id, userC.id);

      const viewer = await prisma.admin.create({
        data: {
          email: `tm.view.${stamp}@medicard.test`,
          fullName: 'TM Viewer',
          passwordHash,
          capabilities: ['TBILISI_MOVES_VIEW'],
        },
      });
      const manager = await prisma.admin.create({
        data: {
          email: `tm.manage.${stamp}@medicard.test`,
          fullName: 'TM Manager',
          passwordHash,
          capabilities: ['TBILISI_MOVES_VIEW', 'TBILISI_MOVES_MANAGE'],
        },
      });
      const reviewer = await prisma.admin.create({
        data: {
          email: `tm.review.${stamp}@medicard.test`,
          fullName: 'TM Reviewer',
          passwordHash,
          capabilities: ['TBILISI_MOVES_VIEW', 'TBILISI_MOVES_REVIEW'],
        },
      });
      const corrector = await prisma.admin.create({
        data: {
          email: `tm.correct.${stamp}@medicard.test`,
          fullName: 'TM Corrector',
          passwordHash,
          capabilities: ['TBILISI_MOVES_VIEW', 'TBILISI_MOVES_CORRECT'],
        },
      });
      admins.push(viewer.id, manager.id, reviewer.id, corrector.id);

      const app = express();
      app.use(express.json());
      app.use('/api/tbilisi-moves', tbilisiMovesRouter);
      app.use('/api/admin/tbilisi-moves', adminTbilisiMovesRouter);
      app.use('/api/health-metrics', healthMetricsRouter);
      app.use(errorHandler);
      http = await listen(app);

      const statusClosed = await json('GET', '/api/tbilisi-moves/status');
      assert.equal(statusClosed.status, 200);
      assert.equal(statusClosed.data.clock.timezone, 'Asia/Tbilisi');
      assert.equal(statusClosed.data.date, today);
      assert.ok(statusClosed.data.dayStart);
      assert.ok(statusClosed.data.nextMidnight);

      const closed = await json('POST', '/api/tbilisi-moves/enroll', {
        user: userA,
        body: {
          districtId: d1.id,
          publicHandle: 'ანა',
          acceptLock: true,
          acceptPublicBoard: true,
        },
      });
      assert.equal(closed.status === 404 || closed.status === 409, true);

      await prisma.tbilisiMovesConfig.update({
        where: { id: 'default' },
        data: {
          featureEnabled: true,
          enrollmentOpen: true,
          ingestionPaused: false,
          competitionPaused: false,
          competitiveCap: 10000,
          defaultDailyTarget: 100000,
          minParticipantsForRank: 2,
          cooldownDays: 30,
          revision: { increment: 1 },
        },
      });

      const unauth = await json('PUT', '/api/tbilisi-moves/observations', {
        body: observation({ date: today, steps: 10, now }),
      });
      assert.equal(unauth.status, 401);

      const adminOnUser = await json('GET', '/api/tbilisi-moves/catalog', { admin: manager });
      assert.equal(adminOnUser.status, 403);

      const enrollA = await json('POST', '/api/tbilisi-moves/enroll', {
        user: userA,
        body: {
          districtId: d1.id,
          publicHandle: 'ანა',
          publicAvatarId: 'avatar-1',
          acceptLock: true,
          acceptPublicBoard: true,
        },
      });
      assert.equal(enrollA.status, 201, JSON.stringify(enrollA.data));
      assert.equal(enrollA.data.membership.districtId, d1.id);
      assert.equal(enrollA.data.membership.lockUntilDate, addDaysYmd(today, 30));
      assert.equal(JSON.stringify(enrollA.data).includes('Secret Name'), false);

      const enrollAgain = await json('POST', '/api/tbilisi-moves/enroll', {
        user: userA,
        body: {
          districtId: d2.id,
          publicHandle: 'ანა',
          acceptLock: true,
          acceptPublicBoard: true,
        },
      });
      assert.equal(enrollAgain.status, 409);
      assert.equal(enrollAgain.data.code, 'ALREADY_ENROLLED');

      const [change1, change2] = await Promise.all([
        json('POST', '/api/tbilisi-moves/district-change', {
          user: userA,
          body: { districtId: d2.id, acceptLock: true },
        }),
        json('POST', '/api/tbilisi-moves/district-change', {
          user: userA,
          body: { districtId: d2.id, acceptLock: true },
        }),
      ]);
      const changeStatuses = [change1.status, change2.status].sort();
      assert.deepEqual(changeStatuses, [409, 409]);
      assert.ok([change1.data.code, change2.data.code].includes('DISTRICT_LOCKED'));

      await prisma.tbilisiMovesMembership.update({
        where: { userId: userA.id },
        data: { lockUntilDate: today },
      });
      const pending = await json('POST', '/api/tbilisi-moves/district-change', {
        user: userA,
        body: { districtId: d2.id, acceptLock: true },
      });
      assert.equal(pending.status, 200, JSON.stringify(pending.data));
      assert.equal(pending.data.membership.pendingDistrictId, d2.id);
      assert.equal(pending.data.membership.pendingEffectiveDate, addDaysYmd(today, 1));
      assert.equal(pending.data.membership.districtId, d1.id);

      const cancel = await json('POST', '/api/tbilisi-moves/district-change/cancel', { user: userA });
      assert.equal(cancel.status, 200);
      assert.equal(cancel.data.membership.pendingDistrictId, null);
      assert.equal(cancel.data.membership.lockUntilDate, today);

      const d3 = TBILISI_MOVES_DISTRICTS[2];
      const [race1, race2] = await Promise.all([
        json('POST', '/api/tbilisi-moves/district-change', {
          user: userA,
          body: { districtId: d2.id, acceptLock: true },
        }),
        json('POST', '/api/tbilisi-moves/district-change', {
          user: userA,
          body: { districtId: d3.id, acceptLock: true },
        }),
      ]);
      const raceOk = [race1, race2].filter((row) => row.status === 200);
      const raceDenied = [race1, race2].filter((row) => row.status === 409);
      assert.equal(raceOk.length, 1, JSON.stringify([race1.data, race2.data]));
      assert.equal(raceDenied.length, 1);
      assert.equal(raceDenied[0].data.code, 'CHANGE_PENDING');
      await json('POST', '/api/tbilisi-moves/district-change/cancel', { user: userA });

      await prisma.tbilisiMovesConfig.update({
        where: { id: 'default' },
        data: { cooldownDays: 7, revision: { increment: 1 } },
      });
      const me = await json('GET', '/api/tbilisi-moves/me', { user: userA });
      assert.equal(me.data.membership.lockUntilDate, today);

      const firstId = randomUUID();
      const put4000 = await json('PUT', '/api/tbilisi-moves/observations', {
        user: userA,
        body: observation({ date: today, steps: 4000, now, id: firstId, seq: 1 }),
      });
      assert.equal(put4000.status, 200, JSON.stringify(put4000.data));
      assert.equal(put4000.data.credit.eligibleSteps, 4000);

      const retry = await json('PUT', '/api/tbilisi-moves/observations', {
        user: userA,
        body: observation({ date: today, steps: 4000, now, id: firstId, seq: 1 }),
      });
      assert.equal(retry.data.idempotent, true);
      assert.equal(retry.data.credit.eligibleSteps, 4000);

      const conflict = await json('PUT', '/api/tbilisi-moves/observations', {
        user: userA,
        body: observation({ date: today, steps: 5000, now, id: firstId, seq: 2 }),
      });
      assert.equal(conflict.status, 409);
      assert.equal(conflict.data.code, 'OBSERVATION_CONFLICT');

      const later = new Date(now.getTime() + 1000);
      const put6200 = await json('PUT', '/api/tbilisi-moves/observations', {
        user: userA,
        body: observation({ date: today, steps: 6200, now: later, seq: 2 }),
      });
      assert.equal(put6200.data.credit.eligibleSteps, 6200);

      const stale = await json('PUT', '/api/tbilisi-moves/observations', {
        user: userA,
        body: observation({ date: today, steps: 9000, now: new Date(now.getTime() - 5000), seq: 0 }),
      });
      assert.equal(stale.data.accepted, false);
      assert.equal(stale.data.reason, 'STALE');
      assert.equal(stale.data.credit.eligibleSteps, 6200);

      const down = await json('PUT', '/api/tbilisi-moves/observations', {
        user: userA,
        body: observation({ date: today, steps: 3000, now: new Date(later.getTime() + 1000), seq: 3 }),
      });
      assert.equal(down.data.credit.eligibleSteps, 3000);

      const otherSource = await json('PUT', '/api/tbilisi-moves/observations', {
        user: userA,
        body: observation({
          date: today,
          steps: 8000,
          now: new Date(later.getTime() + 2000),
          provider: 'HEALTH_CONNECT',
          source: 'watch-9',
          seq: 4,
        }),
      });
      assert.equal(otherSource.status, 409);
      assert.equal(otherSource.data.code, 'SOURCE_CONFLICT');

      const capHit = await json('PUT', '/api/tbilisi-moves/observations', {
        user: userA,
        body: observation({ date: today, steps: 15000, now: new Date(later.getTime() + 3000), seq: 5 }),
      });
      assert.equal(capHit.data.credit.rawObservedSteps, 15000);
      assert.equal(capHit.data.credit.eligibleSteps, 10000);

      const enrollB = await json('POST', '/api/tbilisi-moves/enroll', {
        user: userB,
        body: {
          districtId: d1.id,
          publicHandle: 'ბექა',
          acceptLock: true,
          acceptPublicBoard: true,
        },
      });
      assert.equal(enrollB.status, 201, JSON.stringify(enrollB.data));
      const putB = await json('PUT', '/api/tbilisi-moves/observations', {
        user: userB,
        body: observation({ date: today, steps: 10000, now: new Date(later.getTime() + 4000) }),
      });
      assert.equal(putB.status, 200, JSON.stringify(putB.data));

      const people = await json('GET', `/api/tbilisi-moves/rounds/${today}/districts/${d1.id}/people?limit=1&offset=0`, {
        user: userA,
      });
      assert.equal(people.status, 200, JSON.stringify(people.data));
      assert.equal(people.data.people.length, 1);
      assert.ok(people.data.you);
      assert.equal(people.data.you.rank, 1);
      assert.equal(JSON.stringify(people.data).includes('Secret Name'), false);

      const districts = await json('GET', `/api/tbilisi-moves/rounds/${today}/districts`, { user: userA });
      const row = people.data.you;
      assert.ok(row.eligibleSteps <= 10000);
      const listed = districts.data.districts.find((item) => item.id === d1.id);
      assert.equal(listed.participantCount, 2);
      assert.equal(listed.rank, 1);

      const health = await json('POST', '/api/health-metrics/sync', {
        user: userA,
        body: { daily: [{ date: today, steps: 22222 }] },
      });
      assert.ok(health.status === 200 || health.status === 201, JSON.stringify(health.data));
      const extraCredits = await prisma.tbilisiMovesCredit.findMany({
        where: { userId: userA.id, rawObservedSteps: 22222 },
      });
      assert.equal(extraCredits.length, 0);
      const healthDaily = await prisma.healthMetricDaily.findUnique({
        where: { userId_date: { userId: userA.id, date: today } },
      });
      assert.equal(healthDaily?.steps, 22222);

      const enrollC = await json('POST', '/api/tbilisi-moves/enroll', {
        user: userC,
        body: {
          districtId: d1.id,
          publicHandle: 'გიო',
          acceptLock: true,
          acceptPublicBoard: true,
        },
      });
      assert.equal(enrollC.status, 201, JSON.stringify(enrollC.data));
      const lockC = enrollC.data.membership.lockUntilDate;
      const leaveC = await json('POST', '/api/tbilisi-moves/leave', { user: userC });
      assert.equal(leaveC.status, 200);
      assert.equal(leaveC.data.membership.status, 'LEFT');
      assert.equal(leaveC.data.membership.lockUntilDate, lockC);

      const ingestLeft = await json('PUT', '/api/tbilisi-moves/observations', {
        user: userC,
        body: observation({ date: today, steps: 50, now: new Date(), seq: 1 }),
      });
      assert.equal(ingestLeft.status, 409);
      assert.equal(ingestLeft.data.code, 'NOT_ENROLLED');

      const rejoinOther = await json('POST', '/api/tbilisi-moves/enroll', {
        user: userC,
        body: {
          districtId: d2.id,
          publicHandle: 'გიო',
          acceptLock: true,
          acceptPublicBoard: true,
        },
      });
      assert.equal(rejoinOther.status, 409);
      assert.equal(rejoinOther.data.code, 'DISTRICT_LOCKED');

      const rejoinSame = await json('POST', '/api/tbilisi-moves/enroll', {
        user: userC,
        body: {
          districtId: d1.id,
          publicHandle: 'გიო',
          acceptLock: true,
          acceptPublicBoard: true,
        },
      });
      assert.equal(rejoinSame.status, 201, JSON.stringify(rejoinSame.data));
      assert.equal(rejoinSame.data.membership.districtId, d1.id);
      assert.equal(rejoinSame.data.membership.lockUntilDate, lockC);

      await json('POST', '/api/tbilisi-moves/leave', { user: userC });
      await prisma.tbilisiMovesMembership.update({
        where: { userId: userC.id },
        data: { lockUntilDate: today },
      });
      const sameDaySwitch = await json('POST', '/api/tbilisi-moves/enroll', {
        user: userC,
        body: {
          districtId: d2.id,
          publicHandle: 'გიო',
          acceptLock: true,
          acceptPublicBoard: true,
        },
      });
      assert.equal(sameDaySwitch.status, 409);
      assert.equal(sameDaySwitch.data.code, 'SAME_DAY_DISTRICT_CHANGE');

      const creditBeforePending = await prisma.tbilisiMovesCredit.findUnique({
        where: { userId_date: { userId: userA.id, date: today } },
      });
      await prisma.tbilisiMovesMembershipPeriod.updateMany({
        where: { userId: userA.id, endDate: null },
        data: { startDate: addDaysYmd(today, -1) },
      });
      await prisma.tbilisiMovesMembership.update({
        where: { userId: userA.id },
        data: {
          pendingDistrictId: d2.id,
          pendingEffectiveDate: today,
          pendingRequestedAt: now,
          lockUntilDate: today,
        },
      });
      const meApply = await json('GET', '/api/tbilisi-moves/me', { user: userA });
      assert.equal(meApply.status, 200, JSON.stringify(meApply.data));
      assert.equal(meApply.data.membership.districtId, d2.id);
      assert.equal(meApply.data.membership.pendingDistrictId, null);
      assert.ok(meApply.data.clock?.timezone === 'Asia/Tbilisi');
      assert.equal(meApply.data.sync?.ingestEligible, true);
      const creditAfterPending = await prisma.tbilisiMovesCredit.findUnique({
        where: { userId_date: { userId: userA.id, date: today } },
      });
      assert.equal(creditAfterPending.districtId, creditBeforePending.districtId);

      const denied = await json('PATCH', '/api/admin/tbilisi-moves/config', {
        admin: viewer,
        body: { revision: 1, featureEnabled: false, reason: 'nope' },
      });
      assert.equal(denied.status, 403);
      assert.equal(denied.data.code, 'ADMIN_CAPABILITY_DENIED');

      const live = await prisma.tbilisiMovesConfig.findUnique({ where: { id: 'default' } });
      const staleCfg = await json('PATCH', '/api/admin/tbilisi-moves/config', {
        admin: manager,
        body: { revision: live.revision - 1, reason: 'stale save', featureEnabled: true },
      });
      assert.equal(staleCfg.status, 409);
      assert.equal(staleCfg.data.code, 'CONFIG_STALE');

      const okCfg = await json('PATCH', '/api/admin/tbilisi-moves/config', {
        admin: manager,
        body: { revision: live.revision, reason: 'raise target', defaultDailyTarget: 120000 },
      });
      assert.equal(okCfg.status, 200, JSON.stringify(okCfg.data));
      const round = await prisma.tbilisiMovesRound.findUnique({ where: { date: today } });
      assert.equal(round.rulesSnapshot.defaultDailyTarget, 100000);

      const audit = await prisma.adminAuditLog.findFirst({
        where: { action: 'tbilisi_moves.config.patch' },
        orderBy: { createdAt: 'desc' },
      });
      assert.ok(audit);
      assert.equal(audit.newValue?.reason, 'raise target');

      const pause = await json('PATCH', '/api/admin/tbilisi-moves/config', {
        admin: manager,
        body: {
          revision: okCfg.data.config.revision,
          reason: 'pause ingest',
          ingestionEnabled: false,
        },
      });
      assert.equal(pause.status, 200, JSON.stringify(pause.data));
      const pausedPut = await json('PUT', '/api/tbilisi-moves/observations', {
        user: userA,
        body: observation({ date: today, steps: 16000, now: new Date(), seq: 9 }),
      });
      assert.equal(pausedPut.status, 409);
      assert.equal(pausedPut.data.code, 'INGESTION_PAUSED');

      await prisma.tbilisiMovesConfig.update({
        where: { id: 'default' },
        data: { ingestionPaused: false, revision: { increment: 1 } },
      });
      await prisma.tbilisiMovesIngestHold.updateMany({
        where: { endedAt: null },
        data: { endedAt: new Date() },
      });
      const afterHold = await json('PUT', '/api/tbilisi-moves/observations', {
        user: userA,
        body: observation({ date: today, steps: 17000, now: new Date(), seq: 10 }),
      });
      assert.equal(afterHold.status, 409);
      assert.equal(afterHold.data.code, 'INGESTION_HOLD_OVERLAP');

      await prisma.tbilisiMovesRound.update({
        where: { date: today },
        data: { graceEndsAt: new Date(Date.now() - 1000) },
      });
      const closedRound = await json('PUT', '/api/tbilisi-moves/observations', {
        user: userA,
        body: observation({ date: today, steps: 18000, now: new Date(), seq: 11 }),
      });
      assert.equal(closedRound.status, 409);
      assert.ok(['ROUND_CLOSED', 'DATE_OUT_OF_WINDOW'].includes(closedRound.data.code));

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

      const creditRow = await prisma.tbilisiMovesCredit.findUnique({
        where: { userId_date: { userId: userA.id, date: today } },
      });
      if (creditRow) {
        const deniedExclude = await json('POST', `/api/admin/tbilisi-moves/credits/${creditRow.id}/exclude`, {
          admin: viewer,
          body: { reason: 'viewer cannot exclude' },
        });
        assert.equal(deniedExclude.status, 403);

        let resultsReady = true;
        try {
          await prisma.tbilisiMovesResultRevision.findFirst({ take: 1, select: { id: true } });
        } catch {
          resultsReady = false;
        }
        if (resultsReady) {
          const excluded = await json('POST', `/api/admin/tbilisi-moves/credits/${creditRow.id}/exclude`, {
            admin: reviewer,
            body: { reason: 'test exclusion survives sync' },
          });
          assert.equal(excluded.status, 200, JSON.stringify(excluded.data));
          assert.equal(excluded.data.credit.excluded, true);

          const healthBefore = await prisma.healthMetricDaily.findMany({ where: { userId: userA.id } });
          const earlyFinalize = await json('POST', `/api/admin/tbilisi-moves/rounds/${today}/finalize/preview`, {
            admin: manager,
          });
          assert.equal(earlyFinalize.status === 200 || earlyFinalize.status === 409 || earlyFinalize.status === 503, true);
          if (earlyFinalize.status === 200) {
            assert.equal(earlyFinalize.data.canFinalize, false);
            const execute = await json('POST', `/api/admin/tbilisi-moves/rounds/${today}/finalize`, {
              admin: manager,
              body: { previewHash: earlyFinalize.data.previewHash, revision: earlyFinalize.data.round.resultRevision },
            });
            assert.equal(execute.status, 409);
            assert.ok(['DAY_STILL_OPEN', 'GRACE_ACTIVE', 'FINALIZE_BLOCKED'].includes(execute.data.code));
          }
          const history = await json('GET', '/api/tbilisi-moves/history', { user: userA });
          assert.ok(history.status === 200 || history.status === 404);
          if (history.status === 200) {
            assert.ok(Array.isArray(history.data.items));
          }
          const healthAfter = await prisma.healthMetricDaily.findMany({ where: { userId: userA.id } });
          assert.equal(healthAfter.length, healthBefore.length);
        }
      }
    } finally {
      if (http) await http.close();
      if (snapshot) {
        const { id, updatedAt, ...rest } = snapshot;
        await prisma.tbilisiMovesConfig.update({ where: { id: 'default' }, data: rest }).catch(() => {});
      }
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
