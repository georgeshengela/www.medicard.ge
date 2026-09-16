import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { enrollUser } from './tbilisiMoves/membership.js';
import { putObservation } from './tbilisiMoves/ingest.js';
import { getPeopleBoard, getTodayOverview } from './tbilisiMoves/read.js';
import { finalizeDueRounds, finalizeRound, previewFinalize } from './tbilisiMoves/finalize.js';
import { setCreditExclusion } from './tbilisiMoves/moderate.js';
import { addDaysYmd, tbilisiMidnight, tbilisiYmd } from './tbilisiMoves/time.js';
import {
  assertDisposableTbilisiMovesDatabase,
  resetTbilisiMovesRound,
  skipUnlessIsolatedTbilisiMovesDb,
} from './tbilisiMoves/testEnv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, '../../../qa/tbilisi-moves-phase5');

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

function observation({ date, steps, now, provider = 'APPLE_HEALTH', source = 'pilot-install', id = randomUUID(), seq = 1 }) {
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

describe('tbilisi moves isolated pilot scenario', { timeout: 180_000 }, () => {
  it('runs a synthetic end-to-end competition day through real APIs', async (t) => {
    if (skipUnlessIsolatedTbilisiMovesDb(t)) return;
    const identity = await assertDisposableTbilisiMovesDatabase(prisma);
    const nowOpen = new Date('2026-07-22T11:00:00.000Z');
    const today = tbilisiYmd(nowOpen);
    await resetTbilisiMovesRound(prisma, today);
    const gldani = TBILISI_MOVES_DISTRICTS[0];
    const didube = TBILISI_MOVES_DISTRICTS[1];
    const vake = TBILISI_MOVES_DISTRICTS[2];
    const stamp = `${Date.now()}`;
    const created = [];
    const admins = [];
    const evidence = {
      evidenceKind: 'synthetic_api_observations',
      notNativeSensorProof: true,
      database: { name: identity.database, user: identity.user, marker: identity.marker },
      steps: [],
    };
    const passwordHash = await bcrypt.hash('TmPass!234', 4);
    let http = null;

    async function addUser(label, fullName) {
      const row = await prisma.user.create({
        data: { email: `tm.pilot.${label}.${stamp}@medicard.test`, fullName, passwordHash },
      });
      created.push(row.id);
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
      evidence.steps.push({ method, path, status: res.status, code: data.code || null });
      return { status: res.status, data };
    }

    try {
      const users = {
        g1: await addUser('g1', 'Pilot Gldani One'),
        g2: await addUser('g2', 'Pilot Gldani Two'),
        g3: await addUser('g3', 'Pilot Gldani Three'),
        d1: await addUser('d1', 'Pilot Didube One'),
        v1: await addUser('v1', 'Pilot Vake One'),
      };
      const manager = await prisma.admin.create({
        data: {
          email: `tm.pilot.manage.${stamp}@medicard.test`,
          fullName: 'Pilot Manager',
          passwordHash,
          capabilities: ['TBILISI_MOVES_VIEW', 'TBILISI_MOVES_MANAGE', 'TBILISI_MOVES_REVIEW', 'TBILISI_MOVES_CORRECT'],
        },
      });
      admins.push(manager.id);

      const app = express();
      app.use(express.json());
      app.use('/api/tbilisi-moves', tbilisiMovesRouter);
      app.use('/api/admin/tbilisi-moves', adminTbilisiMovesRouter);
      app.use('/api/health-metrics', healthMetricsRouter);
      app.use(errorHandler);
      http = await listen(app);

      const closed = await json('GET', '/api/tbilisi-moves/status');
      assert.equal(closed.status, 200);
      assert.equal(closed.data.pilotMode, true);

      const cfg = await prisma.tbilisiMovesConfig.findUnique({ where: { id: 'default' } });
      await prisma.tbilisiMovesConfig.update({
        where: { id: 'default' },
        data: {
          featureEnabled: true,
          enrollmentOpen: true,
          ingestionPaused: false,
          competitionPaused: false,
          defaultDailyTarget: 20000,
          competitiveCap: 10000,
          minParticipantsForRank: 1,
          cooldownDays: 7,
          lateSyncGraceHours: 8,
          pilotMode: true,
          revision: { increment: 1 },
        },
      });
      evidence.steps.push({ action: 'enable_flags_test_db_only', featureEnabled: true, enrollmentOpen: true });

      await enrollUser({ userId: users.g1.id, districtId: gldani.id, publicHandle: 'გლდ1', now: nowOpen });
      await enrollUser({ userId: users.g2.id, districtId: gldani.id, publicHandle: 'გლდ2', now: nowOpen });
      await enrollUser({ userId: users.g3.id, districtId: gldani.id, publicHandle: 'გლდ3', now: nowOpen });
      await enrollUser({ userId: users.d1.id, districtId: didube.id, publicHandle: 'დიდ1', now: nowOpen });
      await enrollUser({ userId: users.v1.id, districtId: vake.id, publicHandle: 'ვაკ1', now: nowOpen });

      const t1 = new Date(nowOpen.getTime() + 1000);
      await putObservation({ userId: users.g1.id, body: observation({ date: today, steps: 9000, now: t1, source: 'g1' }), now: t1 });
      await putObservation({ userId: users.g2.id, body: observation({ date: today, steps: 9000, now: t1, source: 'g2' }), now: t1 });
      await putObservation({ userId: users.g3.id, body: observation({ date: today, steps: 1000, now: t1, source: 'g3' }), now: t1 });
      await putObservation({ userId: users.d1.id, body: observation({ date: today, steps: 8000, now: t1, source: 'd1' }), now: t1 });
      await putObservation({ userId: users.v1.id, body: observation({ date: today, steps: 8000, now: t1, source: 'v1' }), now: t1 });

      const overview = await getTodayOverview(users.g1.id, nowOpen);
      evidence.steps.push({
        action: 'overview_clock_injected',
        date: overview.date || today,
        credited: overview.credit?.eligibleSteps ?? overview.you?.eligibleSteps ?? null,
      });
      const meHttp = await json('GET', '/api/tbilisi-moves/me', { user: users.g1 });
      assert.equal(meHttp.status, 200);
      const board = await json('GET', `/api/tbilisi-moves/rounds/${today}/districts`, { user: users.g1 });
      const people = await getPeopleBoard(today, gldani.id, users.g3.id, { limit: 1, offset: 0 }, nowOpen);
      const peopleHttp = await json(
        'GET',
        `/api/tbilisi-moves/rounds/${today}/districts/${gldani.id}/people?limit=1&offset=0`,
        { user: users.g3 },
      );
      assert.equal(peopleHttp.status, 200);
      assert.equal(people.you.onPage, false);
      assert.equal(people.you.rank, 2);
      const dRow = board.data.districts.find((row) => itemId(row) === didube.id);
      const vRow = board.data.districts.find((row) => itemId(row) === vake.id);
      assert.equal(dRow.goalRatio, vRow.goalRatio);
      assert.equal(dRow.rank, vRow.rank);

      const live = await prisma.tbilisiMovesConfig.findUnique({ where: { id: 'default' } });
      const patch = await json('PATCH', '/api/admin/tbilisi-moves/config', {
        admin: manager,
        body: { revision: live.revision, reason: 'future target only', defaultDailyTarget: 40000 },
      });
      assert.equal(patch.status, 200, JSON.stringify(patch.data));
      const round = await prisma.tbilisiMovesRound.findUnique({ where: { date: today } });
      assert.equal(round.rulesSnapshot.defaultDailyTarget, 20000);

      const g3Credit = await prisma.tbilisiMovesCredit.findUnique({
        where: { userId_date: { userId: users.g3.id, date: today } },
      });
      const excluded = await setCreditExclusion({
        admin: manager,
        creditId: g3Credit.id,
        excluded: true,
        reason: 'pilot exclude low contribution',
        now: t1,
      });
      assert.equal(excluded.credit.excluded, true);
      const boardAfter = await json('GET', `/api/tbilisi-moves/rounds/${today}/districts`, { user: users.g1 });
      const gldaniAfter = boardAfter.data.districts.find((row) => itemId(row) === gldani.id);
      assert.ok(gldaniAfter.eligibleSteps < 19000);

      const health = await json('POST', '/api/health-metrics/sync', {
        user: users.g1,
        body: { daily: [{ date: today, steps: 33333 }] },
      });
      assert.ok(health.status === 200 || health.status === 201);
      const copied = await prisma.tbilisiMovesCredit.findMany({
        where: { userId: users.g1.id, rawObservedSteps: 33333 },
      });
      assert.equal(copied.length, 1);

      const graceNow = new Date(new Date(round.graceEndsAt).getTime() + 60_000);
      evidence.steps.push({ action: 'clock_injection', now: graceNow.toISOString(), note: 'not OS clock' });
      const preview = await previewFinalize({ date: today, now: graceNow });
      assert.equal(preview.canFinalize, true);
      const first = await finalizeRound({
        date: today,
        now: graceNow,
        kind: 'INITIAL',
        previewHash: preview.previewHash,
        admin: manager,
        actor: 'admin',
      });
      assert.equal(first.status, 'FINALIZED');
      const awards1 = await prisma.tbilisiMovesAward.count({ where: { date: today, status: 'ACTIVE' } });
      const second = await finalizeRound({ date: today, now: graceNow, kind: 'INITIAL', actor: 'runner' });
      assert.equal(second.idempotent, true);
      const awards2 = await prisma.tbilisiMovesAward.count({ where: { date: today } });
      assert.equal(awards2, await prisma.tbilisiMovesAward.count({ where: { date: today } }));
      assert.equal(await prisma.tbilisiMovesAward.count({ where: { date: today, status: 'ACTIVE' } }), awards1);

      const history = await json('GET', '/api/tbilisi-moves/history', { user: users.g1 });
      assert.equal(history.status, 200);
      assert.ok(history.data.items.some((item) => item.date === today));
      const awards = await json('GET', '/api/tbilisi-moves/awards', { user: users.g1 });
      assert.equal(awards.status, 200);

      const dry = await finalizeDueRounds({ now: graceNow, date: today, dryRun: true });
      assert.equal(dry.dryRun, true);

      await setCreditExclusion({
        admin: manager,
        creditId: g3Credit.id,
        excluded: false,
        reason: 'pilot reinstate for correction',
        now: graceNow,
      });
      const correctPreview = await previewFinalize({ date: today, now: graceNow });
      const corrected = await finalizeRound({
        date: today,
        now: graceNow,
        kind: 'CORRECTION',
        previewHash: correctPreview.previewHash,
        fromRevision: first.resultRevision,
        reason: 'pilot reinstate changes awards',
        admin: manager,
      });
      assert.equal(corrected.kind, 'CORRECTION');
      assert.ok(corrected.resultRevision >= 2);

      const healthRow = await prisma.healthMetricDaily.findUnique({
        where: { userId_date: { userId: users.g1.id, date: today } },
      });
      assert.equal(healthRow.steps, 33333);
      const cfgEnd = await prisma.tbilisiMovesConfig.findUnique({ where: { id: 'default' } });
      assert.equal(cfgEnd.pilotMode, true);

      evidence.outcome = {
        date: today,
        overviewStatus: meHttp.status,
        boardStatus: board.status,
        peopleOffPageRank: people.you.rank,
        tiedDistrictRank: dRow.rank,
        snapshotTarget: round.rulesSnapshot.defaultDailyTarget,
        liveTargetAfterPatch: patch.data.config.defaultDailyTarget,
        firstRevision: first.resultRevision,
        correctionRevision: corrected.resultRevision,
        activeAwardsAfterFirst: awards1,
        historyItems: history.data.items.length,
        awardRows: awards.data.awards?.length ?? awards.data.items?.length ?? null,
        dryRunScanned: dry.scanned,
        personalHealthSteps: healthRow.steps,
      };
    } finally {
      mkdirSync(evidenceDir, { recursive: true });
      writeFileSync(path.join(evidenceDir, 'evidence.json'), JSON.stringify(evidence, null, 2));
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

function itemId(row) {
  return row.id || row.districtId;
}
