import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { petsRouter } from '../routes/pets.routes.js';
import { errorHandler } from '../middleware/error.js';
import { isPetsHealthSchemaMissing, isPetsSchemaMissing } from './petsOwnership.js';
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

describe('pets health HTTP isolation', { timeout: 90_000 }, () => {
  it('isolates weight/allergy/condition across accounts, pets, and archives', async (t) => {
    if (skipUnlessIsolatedPetsDb(t)) return;

    let owner = null;
    let other = null;
    let http = null;
    const stamp = Date.now();
    try {
      try {
        await prisma.pet.findMany({ take: 1 });
        await prisma.petWeightLog.findMany({ take: 1 });
      } catch (error) {
        if (isPetsHealthSchemaMissing(error) || isPetsSchemaMissing(error)) {
          t.skip('Pet health tables are not applied on the local database');
          return;
        }
        throw error;
      }

      owner = await prisma.user.create({
        data: {
          email: `pets.health.owner.${stamp}@medicard.test`,
          fullName: 'Pets Health Owner',
          passwordHash: await bcrypt.hash('PetsHealthOwner!', 12),
        },
      });
      other = await prisma.user.create({
        data: {
          email: `pets.health.other.${stamp}@medicard.test`,
          fullName: 'Pets Health Other',
          passwordHash: await bcrypt.hash('PetsHealthOther!', 12),
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

      const weight = await json(
        await fetch(`${http.origin}/api/pets/${petA}/weight`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({
            recordedOn: '2026-09-10',
            inputValue: 12,
            inputUnit: 'g',
            clientRequestId: `weight-${stamp}`,
          }),
        }),
      );
      assert.equal(weight.status, 201, JSON.stringify(weight.body));
      assert.equal(weight.body.log.weightKg, 0.012);
      const logId = weight.body.log.id;

      const replay = await json(
        await fetch(`${http.origin}/api/pets/${petA}/weight`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({
            recordedOn: '2026-09-10',
            inputValue: 99,
            inputUnit: 'kg',
            clientRequestId: `weight-${stamp}`,
          }),
        }),
      );
      assert.equal(replay.body.replayed, true);
      assert.equal(replay.body.log.id, logId);

      const older = await json(
        await fetch(`${http.origin}/api/pets/${petA}/weight`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({ recordedOn: '2026-08-01', inputValue: 10, inputUnit: 'g' }),
        }),
      );
      assert.equal(older.status, 201);
      const listed = await json(await fetch(`${http.origin}/api/pets/${petA}/weight`, { headers: ownerAuth }));
      assert.equal(listed.body.latest.id, logId);

      const otherWeight = await json(
        await fetch(`${http.origin}/api/pets/${petA}/weight`, {
          method: 'POST',
          headers: otherAuth,
          body: JSON.stringify({ recordedOn: '2026-09-10', inputValue: 4, inputUnit: 'kg' }),
        }),
      );
      assert.equal(otherWeight.status, 404);

      const wrongPet = await json(await fetch(`${http.origin}/api/pets/${petB}/weight/${logId}`, { headers: ownerAuth }));
      assert.equal(wrongPet.status, 404);

      const otherGet = await json(await fetch(`${http.origin}/api/pets/${petA}/weight/${logId}`, { headers: otherAuth }));
      assert.equal(otherGet.status, 404);

      const allergy = await json(
        await fetch(`${http.origin}/api/pets/${petA}/allergies`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({ name: 'Chicken', category: 'food', reportedStatus: 'suspected' }),
        }),
      );
      assert.equal(allergy.status, 201);
      const allergyId = allergy.body.allergy.id;
      const otherAllergy = await json(
        await fetch(`${http.origin}/api/pets/${petA}/allergies/${allergyId}`, { headers: otherAuth }),
      );
      assert.equal(otherAllergy.status, 404);
      const wrongPetAllergy = await json(
        await fetch(`${http.origin}/api/pets/${petB}/allergies/${allergyId}`, { headers: ownerAuth }),
      );
      assert.equal(wrongPetAllergy.status, 404);

      const condition = await json(
        await fetch(`${http.origin}/api/pets/${petA}/conditions`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({
            name: 'Arthritis',
            status: 'resolved',
            reportedBasis: 'owner_reported',
            onsetOn: '2026-01-01',
            resolvedOn: '2026-02-01',
          }),
        }),
      );
      assert.equal(condition.status, 201);
      const conditionId = condition.body.condition.id;

      const archive = await json(
        await fetch(`${http.origin}/api/pets/${petA}/archive`, { method: 'POST', headers: ownerAuth }),
      );
      assert.equal(archive.status, 200);
      const archivedWeight = await json(await fetch(`${http.origin}/api/pets/${petA}/weight`, { headers: ownerAuth }));
      assert.equal(archivedWeight.status, 404);
      const archivedPatch = await json(
        await fetch(`${http.origin}/api/pets/${petA}/conditions/${conditionId}`, {
          method: 'PATCH',
          headers: ownerAuth,
          body: JSON.stringify({ status: 'active' }),
        }),
      );
      assert.equal(archivedPatch.status, 404);
    } finally {
      if (http) await http.close();
      if (other?.id) await deleteUserAccount(other.id);
      if (owner?.id) await deleteUserAccount(owner.id);
    }
  });
});
