import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { petsRouter } from '../routes/pets.routes.js';
import { errorHandler } from '../middleware/error.js';
import { isPetsCareSchemaMissing, isPetsSchemaMissing } from './petsOwnership.js';
import { deleteUserAccount } from './deleteUser.js';
import { signToken } from '../middleware/auth.js';
import { skipUnlessIsolatedPetsDb } from './petsTestEnv.js';

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

async function json(res) {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
}

describe('pets reminder HTTP', { timeout: 90_000 }, () => {
  it('patches reminder prefs without bumping revision when local care tables exist', async (t) => {
    if (skipUnlessIsolatedPetsDb(t)) return;

    let owner = null;
    let http = null;
    const stamp = Date.now();
    try {
      try {
        await prisma.pet.findMany({ take: 1 });
        await prisma.petCareSchedule.findMany({ take: 1 });
      } catch (error) {
        if (isPetsCareSchemaMissing(error) || isPetsSchemaMissing(error)) {
          t.skip('Pet care tables are not applied on the local database');
          return;
        }
        throw error;
      }

      owner = await prisma.user.create({
        data: {
          email: `pets.remind.owner.${stamp}@medicard.test`,
          fullName: 'Pets Remind Owner',
          passwordHash: await bcrypt.hash('PetsRemindOwner!', 12),
        },
      });

      const app = express();
      app.use(express.json());
      app.use('/api/pets', petsRouter);
      app.use(errorHandler);
      http = await listen(app);

      const headers = { ...authHeader(owner), 'Content-Type': 'application/json' };
      const createdPet = await json(
        await fetch(`${http.origin}/api/pets`, {
          method: 'POST',
          headers,
      body: JSON.stringify({ name: 'ნუკრი', speciesId: 'dog', ageKind: 'UNKNOWN' }),
        }),
      );
      assert.equal(createdPet.status, 201);
      const petId = createdPet.body.pet.id;
      const created = await json(
        await fetch(`${http.origin}/api/pets/${petId}/schedules`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            kind: 'MEDICATION',
            title: 'ტაბლეტი',
            startOn: '2026-09-20',
            recurrenceKind: 'ONCE',
            source: 'USER_ENTERED',
            dose: '1',
            doseUnit: 'ტაბლეტი',
          }),
        }),
      );
      assert.equal(created.status, 201);
      assert.equal(created.body.schedule.reminderEnabled, false);
      const revision = created.body.schedule.revision;
      const nextDueOn = created.body.schedule.nextDueOn;
      const patched = await json(
        await fetch(`${http.origin}/api/pets/${petId}/schedules/${created.body.schedule.id}/reminders`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ reminderEnabled: true, reminderOffsetsDays: [1, 0] }),
        }),
      );
      assert.equal(patched.status, 200);
      assert.equal(patched.body.schedule.reminderEnabled, true);
      assert.equal(patched.body.schedule.revision, revision);
      assert.equal(patched.body.schedule.nextDueOn, nextDueOn);
    } finally {
      if (http) await http.close();
      if (owner) await deleteUserAccount(owner.id).catch(() => undefined);
    }
  });
});
