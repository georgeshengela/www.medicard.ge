import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import express from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { petsRouter } from '../routes/pets.routes.js';
import { aiRouter } from '../routes/ai.routes.js';
import { errorHandler } from '../middleware/error.js';
import { signToken } from '../middleware/auth.js';
import { skipUnlessIsolatedPetsDb } from './petsTestEnv.js';
import { setAskOpenRouterPreparedForTests } from './aiEngine.js';
import { AiEngineError } from './evidencemd.js';
import { getUsage, resetAiStartWindowForTests, ROLLING_DAILY_KEY } from './usage.js';

function listen(app) {
  const server = createServer(app);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((done, fail) => {
            if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
            server.close((err) => (err ? fail(err) : done()));
          }),
      });
    });
  });
}

function authHeader(user) {
  return { Authorization: `Bearer ${signToken(user)}` };
}

async function json(res) {
  const resolved = await res;
  const text = await resolved.text();
  try {
    return { status: resolved.status, body: JSON.parse(text) };
  } catch {
    return { status: resolved.status, body: text };
  }
}

async function ensureFreePackage() {
  return prisma.package.upsert({
    where: { code: 'FREE' },
    create: {
      code: 'FREE',
      nameKa: 'უფასო',
      nameEn: 'Free',
      descriptionKa: '3 AI',
      monthlyAiLimit: 90,
      dailyAiLimit: 3,
      priceGel: 0,
      features: {},
      sortOrder: 1,
    },
    update: { dailyAiLimit: 3 },
  });
}

describe('pets Phase 7 concurrency and AI quota', { timeout: 120_000 }, () => {
  it('completes one occurrence under concurrent request IDs and quota-reserves COMPLETE once', async (t) => {
    if (skipUnlessIsolatedPetsDb(t)) return;
    resetAiStartWindowForTests();
    const stamp = Date.now();
    let owner = null;
    let http = null;
    setAskOpenRouterPreparedForTests(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { content: 'მოვლის პასუხი. ეს არ არის დიაგნოზი.', model: 'mock/pets-quota', engine: 'openrouter' };
    });
    try {
      const pkg = await ensureFreePackage();
      owner = await prisma.user.create({
        data: {
          email: `pets.p7.quota.${stamp}@medicard.test`,
          fullName: 'Phase7 Quota',
          passwordHash: await bcrypt.hash('PetsPhase7Quota!', 12),
          packageId: pkg.id,
        },
      });
      const quotaResetAt = new Date(Date.now() + 86_400_000);
      await prisma.periodUsage.upsert({
        where: { userId_periodKey: { userId: owner.id, periodKey: ROLLING_DAILY_KEY } },
        create: { userId: owner.id, periodKey: ROLLING_DAILY_KEY, count: 2, resetAt: quotaResetAt },
        update: { count: 2, resetAt: quotaResetAt },
      });

      const pet = await prisma.pet.create({
        data: {
          userId: owner.id,
          name: 'ნუკრი',
          speciesId: 'dog',
          breedId: 'labrador-retriever',
          ageKind: 'UNKNOWN',
        },
      });

      const app = express();
      app.use(express.json());
      app.use('/api/pets', petsRouter);
      app.use('/api/ai', aiRouter);
      app.use(errorHandler);
      http = await listen(app);
      const headers = { 'Content-Type': 'application/json', ...authHeader(owner) };

      const product = await json(
        await fetch(`${http.origin}/api/pets/${pet.id}/products`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ kind: 'FLEA_TICK', name: 'ბრავექტო', clientRequestId: `prod-${stamp}` }),
        }),
      );
      assert.equal(product.status, 201, JSON.stringify(product.body));
      const plan = await json(
        await fetch(`${http.origin}/api/pets/${pet.id}/schedules`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            kind: 'FLEA_TICK',
            title: 'ბრავექტო',
            productId: product.body.product.id,
            startOn: '2026-09-01',
            recurrenceKind: 'EVERY_N_MONTHS',
            intervalCount: 1,
            recurrenceBasis: 'FIXED_CALENDAR',
            source: 'PRODUCT_INSTRUCTIONS',
            clientRequestId: `sched-${stamp}`,
          }),
        }),
      );
      assert.equal(plan.status, 201, JSON.stringify(plan.body));
      const scheduleId = plan.body.schedule.id;
      const occurrenceKey = `r1|2026-09-01|date|0`;

      const concurrent = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          fetch(`${http.origin}/api/pets/${pet.id}/schedules/${scheduleId}/complete`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              occurrenceKey,
              revision: 1,
              administeredOn: '2026-09-01',
              clientRequestId: `complete-${stamp}-${i}`,
            }),
          }).then((res) => json(res)),
        ),
      );
      const created = concurrent.filter((row) => row.status === 201);
      const conflicts = concurrent.filter((row) => row.status === 409);
      assert.equal(created.length, 1, JSON.stringify(concurrent.map((row) => row.status)));
      assert.equal(conflicts.length, 5);
      assert.equal(created[0].body.schedule.nextDueOn, '2026-10-01');
      const eventCount = await prisma.petCareEvent.count({
        where: { petId: pet.id, scheduleId, status: 'RECORDED' },
      });
      assert.equal(eventCount, 1);

      const plan2 = await json(
        await fetch(`${http.origin}/api/pets/${pet.id}/schedules`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            kind: 'FLEA_TICK',
            title: 'ბრავექტო 2',
            productId: product.body.product.id,
            startOn: '2026-09-01',
            recurrenceKind: 'EVERY_N_MONTHS',
            intervalCount: 1,
            recurrenceBasis: 'FIXED_CALENDAR',
            source: 'USER_ENTERED',
            clientRequestId: `sched2-${stamp}`,
          }),
        }),
      );
      assert.equal(plan2.status, 201, JSON.stringify(plan2.body));
      const scheduleId2 = plan2.body.schedule.id;
      const onceKey = `r1|${plan2.body.schedule.nextDueOn}|date|0`;
      const sameId = `same-${stamp}`;
      const replayBody = {
        occurrenceKey: onceKey,
        revision: 1,
        administeredOn: '2026-09-01',
        clientRequestId: sameId,
      };
      const identical = await Promise.all([
        fetch(`${http.origin}/api/pets/${pet.id}/schedules/${scheduleId2}/complete`, {
          method: 'POST',
          headers,
          body: JSON.stringify(replayBody),
        }).then((res) => json(res)),
        fetch(`${http.origin}/api/pets/${pet.id}/schedules/${scheduleId2}/complete`, {
          method: 'POST',
          headers,
          body: JSON.stringify(replayBody),
        }).then((res) => json(res)),
      ]);
      assert.ok(
        identical.some((row) => row.status === 201 || row.status === 200),
        JSON.stringify(identical.map((row) => ({ status: row.status, error: row.body?.error, code: row.body?.code }))),
      );
      const onceEvents = await prisma.petCareEvent.count({
        where: { petId: pet.id, scheduleId: scheduleId2, status: 'RECORDED' },
      });
      assert.equal(onceEvents, 1);

      const conflictPayload = await json(
        await fetch(`${http.origin}/api/pets/${pet.id}/schedules/${scheduleId2}/complete`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...replayBody,
            administeredOn: '2026-09-02',
          }),
        }),
      );
      assert.equal(conflictPayload.status, 409, JSON.stringify(conflictPayload.body));
      assert.equal(conflictPayload.body.code, 'PET_CARE_IDEMPOTENCY_CONFLICT');

      const plan3 = await json(
        await fetch(`${http.origin}/api/pets/${pet.id}/schedules`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            kind: 'DEWORMING',
            title: 'დეჰელმინთი',
            startOn: '2026-09-01',
            recurrenceKind: 'ONCE',
            recurrenceBasis: 'NONE',
            source: 'USER_ENTERED',
            clientRequestId: `sched3-${stamp}`,
          }),
        }),
      );
      assert.equal(plan3.status, 201, JSON.stringify(plan3.body));
      const scheduleId3 = plan3.body.schedule.id;
      const raceKey = `r1|${plan3.body.schedule.nextDueOn}|date|0`;
      const raced = await Promise.all([
        fetch(`${http.origin}/api/pets/${pet.id}/schedules/${scheduleId3}/complete`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            occurrenceKey: raceKey,
            revision: 1,
            administeredOn: '2026-09-01',
            clientRequestId: `race-complete-${stamp}`,
          }),
        }).then((res) => json(res)),
        fetch(`${http.origin}/api/pets/${pet.id}/schedules/${scheduleId3}/cancel`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ clientRequestId: `race-cancel-${stamp}` }),
        }).then((res) => json(res)),
      ]);
      const raceEvents = await prisma.petCareEvent.count({
        where: { petId: pet.id, scheduleId: scheduleId3, status: 'RECORDED' },
      });
      assert.ok(raceEvents === 0 || raceEvents === 1, JSON.stringify(raced.map((row) => ({ status: row.status, code: row.body?.code }))));
      const racedSchedule = await prisma.petCareSchedule.findUnique({ where: { id: scheduleId3 } });
      if (raceEvents === 1) {
        assert.ok(raced.some((row) => row.status === 201 || row.status === 200));
      } else {
        assert.equal(racedSchedule.status, 'CANCELLED');
      }

      const beforeAi = await getUsage(owner.id);
      assert.equal(beforeAi.used, 2);
      const vetCalls = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          fetch(`${http.origin}/api/pets/${pet.id}/chat/query`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ message: 'რუტინული მოვლა რა არის?', clientRequestId: `vet-${stamp}-${i}` }),
          }).then((res) => json(res)),
        ),
      );
      const completeVet = vetCalls.filter((row) => row.status === 200 && row.body.status === 'COMPLETE' && !row.body.replayed);
      const limited = vetCalls.filter((row) => row.status === 429);
      assert.equal(
        completeVet.length,
        1,
        JSON.stringify(vetCalls.map((row) => ({ status: row.status, code: row.body?.code, used: row.body?.usage?.used }))),
      );
      assert.equal(limited.length, 5);
      const afterVet = await getUsage(owner.id);
      assert.equal(afterVet.used, 3);

      const human = await json(
        await fetch(`${http.origin}/api/ai/query`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: 'რა არის თავის ტკივილი?', mode: 'DOCTOR' }),
        }),
      );
      assert.equal(human.status, 429);
      assert.equal(human.body.code, 'DAILY_LIMIT_REACHED');
    } finally {
      setAskOpenRouterPreparedForTests(null);
      if (http) await http.close();
      if (owner) await prisma.user.delete({ where: { id: owner.id } }).catch(() => {});
    }
  });

  it('does not consume on provider failure and does not fall back to EvidenceMD', async (t) => {
    if (skipUnlessIsolatedPetsDb(t)) return;
    resetAiStartWindowForTests();
    const stamp = Date.now();
    let owner = null;
    let http = null;
    setAskOpenRouterPreparedForTests(async () => {
      throw new AiEngineError('mock provider down', { status: 502 });
    });
    try {
      const pkg = await ensureFreePackage();
      owner = await prisma.user.create({
        data: {
          email: `pets.p7.fail.${stamp}@medicard.test`,
          fullName: 'Phase7 Fail',
          passwordHash: await bcrypt.hash('PetsPhase7Fail!', 12),
          packageId: pkg.id,
        },
      });
      const pet = await prisma.pet.create({
        data: {
          userId: owner.id,
          name: 'მილა',
          speciesId: 'cat',
          breedId: 'unknown',
          ageKind: 'UNKNOWN',
        },
      });
      const app = express();
      app.use(express.json());
      app.use('/api/pets', petsRouter);
      app.use(errorHandler);
      http = await listen(app);
      const headers = { 'Content-Type': 'application/json', ...authHeader(owner) };
      const failed = await json(
        await fetch(`${http.origin}/api/pets/${pet.id}/chat/query`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: 'რა მოვუვლო?', clientRequestId: `fail-${stamp}` }),
        }),
      );
      assert.equal(failed.status, 502, JSON.stringify(failed.body));
      assert.notEqual(failed.body.code, 'EVIDENCEMD');
      const usage = await getUsage(owner.id);
      assert.equal(usage.used, 0);
      const assistant = await prisma.petChatMessage.findFirst({
        where: { petId: pet.id, role: 'assistant' },
        orderBy: { createdAt: 'desc' },
      });
      assert.equal(assistant?.status, 'FAILED');
    } finally {
      setAskOpenRouterPreparedForTests(null);
      if (http) await http.close();
      if (owner) await prisma.user.delete({ where: { id: owner.id } }).catch(() => {});
    }
  });

  it('shares one remaining daily credit between concurrent human Medi and Medi Vet', async (t) => {
    if (skipUnlessIsolatedPetsDb(t)) return;
    resetAiStartWindowForTests();
    const stamp = Date.now();
    let owner = null;
    let http = null;
    setAskOpenRouterPreparedForTests(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
      return { content: 'ეს ზოგადი ინფორმაციაა და არ არის დიაგნოზი.', model: 'mock/pets-shared', engine: 'openrouter' };
    });
    try {
      const pkg = await ensureFreePackage();
      owner = await prisma.user.create({
        data: {
          email: `pets.p7.share.${stamp}@medicard.test`,
          fullName: 'Phase7 Share',
          passwordHash: await bcrypt.hash('PetsPhase7Share!', 12),
          packageId: pkg.id,
        },
      });
      const quotaResetAt = new Date(Date.now() + 86_400_000);
      await prisma.periodUsage.upsert({
        where: { userId_periodKey: { userId: owner.id, periodKey: ROLLING_DAILY_KEY } },
        create: { userId: owner.id, periodKey: ROLLING_DAILY_KEY, count: 2, resetAt: quotaResetAt },
        update: { count: 2, resetAt: quotaResetAt },
      });
      const pet = await prisma.pet.create({
        data: {
          userId: owner.id,
          name: 'ნუკრი',
          speciesId: 'dog',
          breedId: 'unknown',
          ageKind: 'UNKNOWN',
        },
      });
      const app = express();
      app.use(express.json());
      app.use('/api/pets', petsRouter);
      app.use('/api/ai', aiRouter);
      app.use(errorHandler);
      http = await listen(app);
      const headers = { 'Content-Type': 'application/json', ...authHeader(owner) };
      const mixed = await Promise.all([
        fetch(`${http.origin}/api/pets/${pet.id}/chat/query`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: 'რუტინული მოვლა?', clientRequestId: `share-vet-${stamp}` }),
        }).then((res) => json(res)),
        fetch(`${http.origin}/api/ai/query`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: 'რა არის თავის ტკივილი?', mode: 'DOCTOR' }),
        }).then((res) => json(res)),
      ]);
      const vetOk = mixed.filter((row) => row.status === 200 && row.body.status === 'COMPLETE');
      const humanOk = mixed.filter((row) => row.status === 200 && typeof row.body.answer === 'string' && !row.body.status);
      const limited = mixed.filter((row) => row.status === 429);
      assert.equal(
        vetOk.length + humanOk.length,
        1,
        JSON.stringify(mixed.map((row) => ({ status: row.status, code: row.body?.code, engine: row.body?.engine }))),
      );
      assert.equal(limited.length, 1);
      const usage = await getUsage(owner.id);
      assert.equal(usage.used, 3);
    } finally {
      setAskOpenRouterPreparedForTests(null);
      if (http) await http.close();
      if (owner) await prisma.user.delete({ where: { id: owner.id } }).catch(() => {});
    }
  });

  it('does not consume when the client disconnects a streaming Medi Vet request', async (t) => {
    if (skipUnlessIsolatedPetsDb(t)) return;
    resetAiStartWindowForTests();
    const stamp = Date.now();
    let owner = null;
    let http = null;
    setAskOpenRouterPreparedForTests(async ({ signal }) => {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 1500);
        signal?.addEventListener?.('abort', () => {
          clearTimeout(timer);
          const error = new Error('cancelled');
          error.status = 499;
          reject(error);
        });
      });
      return { content: 'ნაწილობრივი', model: 'mock/pets-cancel', engine: 'openrouter' };
    });
    try {
      const pkg = await ensureFreePackage();
      owner = await prisma.user.create({
        data: {
          email: `pets.p7.cancel.${stamp}@medicard.test`,
          fullName: 'Phase7 Cancel',
          passwordHash: await bcrypt.hash('PetsPhase7Cancel!', 12),
          packageId: pkg.id,
        },
      });
      const pet = await prisma.pet.create({
        data: {
          userId: owner.id,
          name: 'მილა',
          speciesId: 'cat',
          breedId: 'unknown',
          ageKind: 'UNKNOWN',
        },
      });
      const app = express();
      app.use(express.json());
      app.use('/api/pets', petsRouter);
      app.use(errorHandler);
      http = await listen(app);
      const origin = new URL(http.origin);
      const token = authHeader(owner).Authorization;
      const payload = JSON.stringify({ message: 'რუტინული მოვლა?', clientRequestId: `cancel-${stamp}`, stream: true });
      await Promise.race([
        new Promise((resolve) => {
          const req = httpRequest(
            {
              hostname: origin.hostname,
              port: origin.port,
              path: `/api/pets/${pet.id}/chat/query`,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
                Authorization: token,
                'Content-Length': Buffer.byteLength(payload),
              },
            },
            (res) => {
              res.resume();
              res.on('end', resolve);
            },
          );
          req.on('error', () => resolve());
          req.write(payload);
          req.end();
          setTimeout(() => req.destroy(), 200);
        }),
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);
      await new Promise((resolve) => setTimeout(resolve, 400));
      const usage = await getUsage(owner.id);
      assert.equal(usage.used, 0);
      const assistant = await prisma.petChatMessage.findFirst({
        where: { petId: pet.id, role: 'assistant' },
        orderBy: { createdAt: 'desc' },
      });
      if (assistant) {
        assert.notEqual(assistant.status, 'COMPLETE');
      }
    } finally {
      setAskOpenRouterPreparedForTests(null);
      if (http) await http.close();
      if (owner) await prisma.user.delete({ where: { id: owner.id } }).catch(() => {});
    }
  });
});
