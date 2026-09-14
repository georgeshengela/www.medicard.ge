import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { petsRouter } from '../routes/pets.routes.js';
import { errorHandler } from '../middleware/error.js';
import { signToken } from '../middleware/auth.js';
import { skipUnlessIsolatedPetsDb } from './petsTestEnv.js';
import { setAskOpenRouterPreparedForTests } from './aiEngine.js';
import { getUsage, resetAiStartWindowForTests } from './usage.js';
import { setVetSettleBeforeCommitForTests } from '../routes/petsChat.routes.js';

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
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
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
    update: {},
  });
}

describe('pets Medi Vet COMPLETE settlement', { timeout: 60_000 }, () => {
  it('does not persist COMPLETE when quota commit fails inside the same transaction', async (t) => {
    if (skipUnlessIsolatedPetsDb(t)) return;
    resetAiStartWindowForTests();
    const stamp = Date.now();
    let owner = null;
    let http = null;
    setAskOpenRouterPreparedForTests(async () => ({
      content: 'ზოგადი პასუხი. ეს არ არის დიაგნოზი.',
      model: 'mock/pets-settle',
      engine: 'openrouter',
    }));
    setVetSettleBeforeCommitForTests(async () => {
      throw new Error('injected settle failure');
    });
    try {
      const pkg = await ensureFreePackage();
      owner = await prisma.user.create({
        data: {
          email: `pets.p71.settle.${stamp}@medicard.test`,
          fullName: 'Phase71 Settle',
          passwordHash: await bcrypt.hash('PetsPhase71Settle!', 12),
          packageId: pkg.id,
        },
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
      app.use(errorHandler);
      http = await listen(app);
      const headers = { 'Content-Type': 'application/json', ...authHeader(owner) };
      const failed = await json(
        await fetch(`${http.origin}/api/pets/${pet.id}/chat/query`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: 'რუტინული მოვლა?', clientRequestId: `settle-fail-${stamp}` }),
        }),
      );
      assert.equal(failed.status >= 400, true, JSON.stringify(failed.body));
      const assistant = await prisma.petChatMessage.findFirst({
        where: { petId: pet.id, role: 'assistant' },
        orderBy: { createdAt: 'desc' },
      });
      assert.notEqual(assistant?.status, 'COMPLETE');
      const usage = await getUsage(owner.id);
      assert.equal(usage.used, 0);
    } finally {
      setVetSettleBeforeCommitForTests(null);
      setAskOpenRouterPreparedForTests(null);
      if (http) await http.close();
      if (owner) await prisma.user.delete({ where: { id: owner.id } }).catch(() => {});
    }
  });

  it('replays a COMPLETE turn without a second consume after a successful settle', async (t) => {
    if (skipUnlessIsolatedPetsDb(t)) return;
    resetAiStartWindowForTests();
    const stamp = Date.now();
    let owner = null;
    let http = null;
    setAskOpenRouterPreparedForTests(async () => ({
      content: 'ზოგადი პასუხი. ეს არ არის დიაგნოზი.',
      model: 'mock/pets-settle',
      engine: 'openrouter',
    }));
    try {
      const pkg = await ensureFreePackage();
      owner = await prisma.user.create({
        data: {
          email: `pets.p71.replay.${stamp}@medicard.test`,
          fullName: 'Phase71 Replay',
          passwordHash: await bcrypt.hash('PetsPhase71Replay!', 12),
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
      const first = await json(
        await fetch(`${http.origin}/api/pets/${pet.id}/chat/query`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: 'რუტინული მოვლა?', clientRequestId: `settle-ok-${stamp}` }),
        }),
      );
      assert.equal(first.status, 200, JSON.stringify(first.body));
      assert.equal(first.body.status, 'COMPLETE');
      const afterFirst = await getUsage(owner.id);
      assert.equal(afterFirst.used, 1);
      const replay = await json(
        await fetch(`${http.origin}/api/pets/${pet.id}/chat/query`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: 'რუტინული მოვლა?', clientRequestId: `settle-ok-${stamp}` }),
        }),
      );
      assert.equal(replay.status, 200);
      assert.equal(replay.body.replayed, true);
      const afterReplay = await getUsage(owner.id);
      assert.equal(afterReplay.used, 1);
    } finally {
      setAskOpenRouterPreparedForTests(null);
      if (http) await http.close();
      if (owner) await prisma.user.delete({ where: { id: owner.id } }).catch(() => {});
    }
  });
});
