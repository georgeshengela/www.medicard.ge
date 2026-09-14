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

describe('pets care HTTP isolation', { timeout: 90_000 }, () => {
  it('isolates products/schedules/events and completion across accounts and pets', async (t) => {
    if (skipUnlessIsolatedPetsDb(t)) return;

    let owner = null;
    let other = null;
    let http = null;
    const stamp = Date.now();
    try {
      try {
        await prisma.pet.findMany({ take: 1 });
        await prisma.petCareEvent.findMany({ take: 1 });
        await prisma.petProduct.findMany({ take: 1 });
      } catch (error) {
        if (isPetsCareSchemaMissing(error) || isPetsSchemaMissing(error)) {
          t.skip('Pet care tables are not applied on the local database');
          return;
        }
        throw error;
      }

      owner = await prisma.user.create({
        data: {
          email: `pets.care.owner.${stamp}@medicard.test`,
          fullName: 'Pets Care Owner',
          passwordHash: await bcrypt.hash('PetsCareOwner!', 12),
        },
      });
      other = await prisma.user.create({
        data: {
          email: `pets.care.other.${stamp}@medicard.test`,
          fullName: 'Pets Care Other',
          passwordHash: await bcrypt.hash('PetsCareOther!', 12),
        },
      });

      const app = express();
      app.use(express.json());
      app.use('/api/pets', petsRouter);
      app.use(errorHandler);
      http = await listen(app);
      const ownerAuth = { 'Content-Type': 'application/json', ...authHeader(owner) };
      const otherAuth = { 'Content-Type': 'application/json', ...authHeader(other) };

      async function createPet(name) {
        const created = await fetch(`${http.origin}/api/pets`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({ name, speciesId: 'dog', ageKind: 'UNKNOWN' }),
        });
        assert.equal(created.status, 201, await created.clone().text());
        return (await created.json()).pet.id;
      }

      const petA = await createPet('ნუკრი');
      const petB = await createPet('მილა');

      const product = await json(
        await fetch(`${http.origin}/api/pets/${petA}/products`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({ kind: 'FLEA_TICK', name: 'ბრუვექტო', expiresOn: '2027-01-01', clientRequestId: `prod-${stamp}` }),
        }),
      );
      assert.equal(product.status, 201, JSON.stringify(product.body));
      const productId = product.body.product.id;

      const otherProduct = await json(
        await fetch(`${http.origin}/api/pets/${petA}/products`, {
          method: 'POST',
          headers: otherAuth,
          body: JSON.stringify({ kind: 'FLEA_TICK', name: 'სხვისი' }),
        }),
      );
      assert.equal(otherProduct.status, 404);

      const wrongPetProduct = await json(await fetch(`${http.origin}/api/pets/${petB}/products/${productId}`, { headers: ownerAuth }));
      assert.equal(wrongPetProduct.status, 404);

      const past = await json(
        await fetch(`${http.origin}/api/pets/${petA}/events`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({
            kind: 'FLEA_TICK',
            title: 'ბრუვექტო',
            productId,
            administeredOn: '2026-08-01',
            clientRequestId: `evt-${stamp}`,
          }),
        }),
      );
      assert.equal(past.status, 201, JSON.stringify(past.body));

      const plan = await json(
        await fetch(`${http.origin}/api/pets/${petA}/schedules`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({
            kind: 'FLEA_TICK',
            title: 'ბრუვექტო',
            productId,
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
      assert.equal(plan.body.schedule.nextDueOn, '2026-09-01');
      assert.notEqual(plan.body.schedule.nextDueOn, product.body.product.expiresOn);
      const scheduleId = plan.body.schedule.id;
      const occurrenceKey = `r1|2026-09-01|date|0`;

      const afterPast = await json(await fetch(`${http.origin}/api/pets/${petA}/schedules/${scheduleId}`, { headers: ownerAuth }));
      assert.equal(afterPast.body.schedule.nextDueOn, '2026-09-01');

      const completeA = await json(
        await fetch(`${http.origin}/api/pets/${petA}/schedules/${scheduleId}/complete`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({
            occurrenceKey,
            revision: 1,
            administeredOn: '2026-09-01',
            clientRequestId: `complete-${stamp}`,
          }),
        }),
      );
      assert.equal(completeA.status, 201, JSON.stringify(completeA.body));
      assert.equal(completeA.body.schedule.nextDueOn, '2026-10-01');

      const replay = await json(
        await fetch(`${http.origin}/api/pets/${petA}/schedules/${scheduleId}/complete`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({
            occurrenceKey,
            revision: 1,
            administeredOn: '2026-09-01',
            clientRequestId: `complete-${stamp}`,
          }),
        }),
      );
      assert.equal(replay.status, 200);
      assert.equal(replay.body.replayed, true);

      const payloadConflict = await json(
        await fetch(`${http.origin}/api/pets/${petA}/schedules/${scheduleId}/complete`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({
            occurrenceKey,
            revision: 1,
            administeredOn: '2026-09-02',
            clientRequestId: `complete-${stamp}`,
          }),
        }),
      );
      assert.equal(payloadConflict.status, 409);
      assert.equal(payloadConflict.body.code, 'PET_CARE_IDEMPOTENCY_CONFLICT');

      const otherDevice = await json(
        await fetch(`${http.origin}/api/pets/${petA}/schedules/${scheduleId}/complete`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({
            occurrenceKey,
            revision: 1,
            administeredOn: '2026-09-01',
            clientRequestId: `complete-other-${stamp}`,
          }),
        }),
      );
      assert.equal(otherDevice.status, 409);
      assert.equal(otherDevice.body.code, 'PET_CARE_OCCURRENCE_COMPLETED');

      const renamed = await json(
        await fetch(`${http.origin}/api/pets/${petA}/products/${productId}`, {
          method: 'PATCH',
          headers: ownerAuth,
          body: JSON.stringify({ name: 'ახალი სახელი' }),
        }),
      );
      assert.equal(renamed.status, 200);
      const history = await json(await fetch(`${http.origin}/api/pets/${petA}/events`, { headers: ownerAuth }));
      const given = history.body.items.find((row) => row.id === completeA.body.event.id);
      assert.equal(given.productNameSnapshot, 'ბრუვექტო');
      assert.equal(given.titleSnapshot, 'ბრუვექტო');

      const wrongPetSchedule = await json(
        await fetch(`${http.origin}/api/pets/${petB}/schedules/${scheduleId}`, { headers: ownerAuth }),
      );
      assert.equal(wrongPetSchedule.status, 404);

      const otherGet = await json(await fetch(`${http.origin}/api/pets/${petA}/schedules/${scheduleId}`, { headers: otherAuth }));
      assert.equal(otherGet.status, 404);

      const cancel = await json(
        await fetch(`${http.origin}/api/pets/${petA}/schedules/${scheduleId}/cancel`, {
          method: 'POST',
          headers: ownerAuth,
        }),
      );
      assert.equal(cancel.status, 200);
      assert.equal(cancel.body.schedule.status, 'CANCELLED');
      const staleComplete = await json(
        await fetch(`${http.origin}/api/pets/${petA}/schedules/${scheduleId}/complete`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({
            occurrenceKey: `r1|2026-10-01|date|1`,
            revision: 1,
            administeredOn: '2026-09-14',
            clientRequestId: `stale-${stamp}`,
          }),
        }),
      );
      assert.equal(staleComplete.status, 409);

      const stillHistory = await json(await fetch(`${http.origin}/api/pets/${petA}/events`, { headers: ownerAuth }));
      assert.ok(stillHistory.body.items.some((row) => row.id === completeA.body.event.id && row.status === 'RECORDED'));

      const archiveProduct = await json(
        await fetch(`${http.origin}/api/pets/${petA}/products/${productId}/archive`, { method: 'POST', headers: ownerAuth }),
      );
      assert.equal(archiveProduct.status, 200);
      const listed = await json(await fetch(`${http.origin}/api/pets/${petA}/products`, { headers: ownerAuth }));
      assert.equal(listed.body.items.some((row) => row.id === productId), false);
      assert.ok(stillHistory.body.items.some((row) => row.productId === productId));

      const identity = await json(await fetch(`${http.origin}/api/pets/${petA}`, { headers: ownerAuth }));
      assert.equal(identity.status, 200);

      const archivePet = await json(await fetch(`${http.origin}/api/pets/${petA}/archive`, { method: 'POST', headers: ownerAuth }));
      assert.equal(archivePet.status, 200);
      const archivedCare = await json(await fetch(`${http.origin}/api/pets/${petA}/events`, { headers: ownerAuth }));
      assert.equal(archivedCare.status, 404);
    } finally {
      if (http) await http.close();
      if (other?.id) await deleteUserAccount(other.id);
      if (owner?.id) await deleteUserAccount(owner.id);
    }
  });
});