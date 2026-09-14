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
import { phase5ReminderIdentity } from './petsSchedule.js';

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

describe('pets partial schema HTTP', { timeout: 120_000 }, () => {
  it('missing PetReminderDelivery disables telemetry only', async (t) => {
    if (skipUnlessIsolatedPetsDb(t)) return;
    if (process.env.PETS_SCHEMA_MUTATION !== '1') {
      t.skip('set PETS_SCHEMA_MUTATION=1 and run this file serially; it renames PetReminderDelivery');
      return;
    }

    let owner = null;
    let http = null;
    let renamed = false;
    const stamp = Date.now();
    try {
      owner = await prisma.user.create({
        data: {
          email: `pets.p7.schema.${stamp}@medicard.test`,
          fullName: 'Phase7 Schema',
          passwordHash: await bcrypt.hash('PetsPhase7Schema!', 12),
        },
      });
      const pet = await prisma.pet.create({
        data: {
          userId: owner.id,
          name: 'ნია',
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

      const schedule = await json(
        await fetch(`${http.origin}/api/pets/${pet.id}/schedules`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            kind: 'FLEA_TICK',
            title: 'ბრავექტო',
            startOn: '2026-09-14',
            recurrenceKind: 'ONCE',
            source: 'USER_ENTERED',
            clientRequestId: `schema-sched-${stamp}`,
          }),
        }),
      );
      assert.equal(schedule.status, 201, JSON.stringify(schedule.body));
      const scheduleId = schedule.body.schedule.id;
      const occurrenceKey = `r${schedule.body.schedule.revision}|${schedule.body.schedule.nextDueOn}|date|0`;

      await prisma.$executeRawUnsafe(`ALTER TABLE "PetReminderDelivery" RENAME TO "PetReminderDelivery_p7_hidden"`);
      renamed = true;

      const reminder = await json(
        await fetch(`${http.origin}/api/pets/${pet.id}/schedules/${scheduleId}/reminders`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ reminderEnabled: true, reminderOffsetsDays: [0] }),
        }),
      );
      assert.equal(reminder.status, 200, JSON.stringify(reminder.body));
      assert.equal(reminder.body.schedule.reminderEnabled, true);

      const feed = await json(await fetch(`${http.origin}/api/pets/reminders/feed`, { headers }));
      assert.equal(feed.status, 200);
      assert.equal(feed.body.careSchemaReady, true);

      const identity = phase5ReminderIdentity({
        userId: owner.id,
        petId: pet.id,
        scheduleId,
        occurrenceKey,
      });
      const telemetry = await json(
        await fetch(`${http.origin}/api/pets/${pet.id}/schedules/${scheduleId}/reminder-delivery`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            occurrenceKey,
            alertKind: 'due',
            identity,
            installId: 'phase7-partial',
            status: 'SCHEDULED_LOCAL',
            fireAtMs: Date.now() + 60_000,
          }),
        }),
      );
      assert.equal(telemetry.status, 202, JSON.stringify(telemetry.body));
      assert.equal(telemetry.body.accepted, false);
      assert.equal(telemetry.body.reminderSchemaReady, false);

      const listed = await json(await fetch(`${http.origin}/api/pets`, { headers }));
      assert.equal(listed.status, 200);
      assert.equal(listed.body.pets.length, 1);
    } finally {
      if (renamed) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "PetReminderDelivery_p7_hidden" RENAME TO "PetReminderDelivery"`);
      }
      if (http) await http.close();
      if (owner) await prisma.user.delete({ where: { id: owner.id } }).catch(() => {});
    }
  });
});
