import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { denyLegacyPublicUploads } from './privateUploads.js';
import { deleteUserAccount } from './deleteUser.js';
import { filesRouter } from '../routes/files.routes.js';
import { petsRouter } from '../routes/pets.routes.js';
import { errorHandler } from '../middleware/error.js';
import { isPetsSchemaMissing } from './petsOwnership.js';
import { signToken } from '../middleware/auth.js';
import { skipUnlessIsolatedPetsDb } from './petsTestEnv.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

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

describe('pets HTTP isolation', { timeout: 90_000 }, () => {
  it('isolates list/detail/edit/archive/photo across accounts and archives', async (t) => {
    if (skipUnlessIsolatedPetsDb(t)) return;
    let owner = null;
    let other = null;
    let http = null;
    const stamp = Date.now();
    try {
      try {
        await prisma.pet.findMany({ take: 1 });
      } catch (error) {
        if (isPetsSchemaMissing(error)) {
          t.skip('Pet table is not applied on the local database');
          return;
        }
        throw error;
      }

      owner = await prisma.user.create({
        data: {
          email: `pets.owner.${stamp}@medicard.test`,
          fullName: 'Pets Owner',
          passwordHash: await bcrypt.hash('PetsOwnerPass!', 12),
        },
      });
      other = await prisma.user.create({
        data: {
          email: `pets.other.${stamp}@medicard.test`,
          fullName: 'Pets Other',
          passwordHash: await bcrypt.hash('PetsOtherPass!', 12),
        },
      });

      const app = express();
      app.use(express.json());
      app.use('/uploads', denyLegacyPublicUploads);
      app.use('/api/files', filesRouter);
      app.use('/api/pets', petsRouter);
      app.use(errorHandler);
      http = await listen(app);

      const created = await fetch(`${http.origin}/api/pets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader(owner) },
        body: JSON.stringify({
          name: 'ნუკრი',
          speciesId: 'dog',
          breedId: 'labrador-retriever',
          sex: 'MALE',
          ageKind: 'EXACT',
          birthDate: '2020-03-15',
        }),
      });
      assert.equal(created.status, 201, await created.clone().text());
      const createdJson = await created.json();
      const petId = createdJson.pet.id;
      assert.equal(createdJson.pet.ageKind, 'EXACT');
      assert.equal(createdJson.pet.birthDate, '2020-03-15');
      assert.equal(createdJson.pet.approxAgeYears, null);

      const otherList = await fetch(`${http.origin}/api/pets`, { headers: authHeader(other) });
      assert.equal(otherList.status, 200);
      const otherListJson = await otherList.json();
      assert.equal(otherListJson.pets.some((row) => row.id === petId), false);

      const otherGet = await fetch(`${http.origin}/api/pets/${petId}`, { headers: authHeader(other) });
      assert.equal(otherGet.status, 404);

      const otherPatch = await fetch(`${http.origin}/api/pets/${petId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader(other) },
        body: JSON.stringify({ name: 'Hacked' }),
      });
      assert.equal(otherPatch.status, 404);

      const form = new FormData();
      form.append('file', new Blob([JPEG], { type: 'image/jpeg' }), `${randomUUID()}.jpg`);
      const photo = await fetch(`${http.origin}/api/pets/${petId}/photo`, {
        method: 'POST',
        headers: authHeader(owner),
        body: form,
      });
      assert.equal(photo.status, 200, await photo.clone().text());
      const photoJson = await photo.json();
      const filename = String(photoJson.pet.photoUrl).split('/').pop();

      const ownerFile = await fetch(`${http.origin}/api/files/${filename}`, { headers: authHeader(owner) });
      assert.equal(ownerFile.status, 200);

      const otherFile = await fetch(`${http.origin}/api/files/${filename}`, { headers: authHeader(other) });
      assert.equal(otherFile.status, 404);

      const archive = await fetch(`${http.origin}/api/pets/${petId}/archive`, {
        method: 'POST',
        headers: authHeader(owner),
      });
      assert.equal(archive.status, 200);

      const listAfter = await fetch(`${http.origin}/api/pets`, { headers: authHeader(owner) });
      const listAfterJson = await listAfter.json();
      assert.equal(listAfterJson.pets.some((row) => row.id === petId), false);

      const getArchived = await fetch(`${http.origin}/api/pets/${petId}`, { headers: authHeader(owner) });
      assert.equal(getArchived.status, 404);

      await deleteUserAccount(owner.id);
      owner = null;
      const gone = await prisma.pet.findFirst({ where: { id: petId } });
      assert.equal(gone, null);
    } finally {
      if (http) await http.close();
      if (other?.id) await deleteUserAccount(other.id);
      if (owner?.id) await deleteUserAccount(owner.id);
    }
  });
});
