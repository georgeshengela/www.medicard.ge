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
import { setAskOpenRouterPreparedForTests } from './aiEngine.js';
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

describe('pets Phase 7 HTTP (isolated DB)', { timeout: 120_000 }, () => {
  it('covers identity, ages, health, reminders telemetry, chat mock, and deletion', async (t) => {
    if (skipUnlessIsolatedPetsDb(t)) return;

    let owner = null;
    let other = null;
    let http = null;
    const stamp = Date.now();
    setAskOpenRouterPreparedForTests(async ({ onDelta }) => {
      const content = 'ძაღლის რუტინული მოვლა დამოკიდებულია ვეტერინარის გეგმაზე. ეს არ არის დიაგნოზი.';
      if (onDelta) onDelta(content);
      return { content, model: 'mock/pets-phase7', engine: 'openrouter' };
    });

    try {
      await prisma.pet.findMany({ take: 1 });
      await prisma.petCareSchedule.findMany({ take: 1 });
      await prisma.petChatSession.findMany({ take: 1 });

      owner = await prisma.user.create({
        data: {
          email: `pets.p7.owner.${stamp}@medicard.test`,
          fullName: 'Phase7 Owner',
          passwordHash: await bcrypt.hash('PetsPhase7Owner!', 12),
        },
      });
      other = await prisma.user.create({
        data: {
          email: `pets.p7.other.${stamp}@medicard.test`,
          fullName: 'Phase7 Other',
          passwordHash: await bcrypt.hash('PetsPhase7Other!', 12),
        },
      });

      const app = express();
      app.use(express.json());
      app.use('/api/pets', petsRouter);
      app.use(errorHandler);
      http = await listen(app);
      const ownerAuth = { 'Content-Type': 'application/json', ...authHeader(owner) };
      const otherAuth = { 'Content-Type': 'application/json', ...authHeader(other) };

      const exact = await json(
        await fetch(`${http.origin}/api/pets`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({
            name: 'ნუკრი',
            speciesId: 'dog',
            breedId: 'labrador-retriever',
            ageKind: 'EXACT',
            birthDate: '2020-01-15',
          }),
        }),
      );
      assert.equal(exact.status, 201, JSON.stringify(exact.body));
      const petA = exact.body.pet.id;

      const approx = await json(
        await fetch(`${http.origin}/api/pets`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({
            name: 'მილა',
            speciesId: 'cat',
            ageKind: 'APPROXIMATE',
            approxAgeYears: 3,
            approxAgeMonths: 2,
          }),
        }),
      );
      assert.equal(approx.status, 201, JSON.stringify(approx.body));
      const petB = approx.body.pet.id;

      const unknown = await json(
        await fetch(`${http.origin}/api/pets/${petA}`, {
          method: 'PATCH',
          headers: ownerAuth,
          body: JSON.stringify({ ageKind: 'UNKNOWN', birthDate: null }),
        }),
      );
      assert.equal(unknown.status, 200);
      assert.equal(unknown.body.pet.ageKind, 'UNKNOWN');

      const otherList = await json(await fetch(`${http.origin}/api/pets`, { headers: otherAuth }));
      assert.equal(otherList.status, 200);
      assert.equal(otherList.body.pets.length, 0);

      const wrongPet = await json(await fetch(`${http.origin}/api/pets/${petA}`, { headers: otherAuth }));
      assert.equal(wrongPet.status, 404);

      const weight = await json(
        await fetch(`${http.origin}/api/pets/${petA}/weight`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({ recordedOn: '2026-09-01', inputValue: 12.5, inputUnit: 'kg', clientRequestId: `w1-${stamp}` }),
        }),
      );
      assert.equal(weight.status, 201, JSON.stringify(weight.body));
      const older = await json(
        await fetch(`${http.origin}/api/pets/${petA}/weight`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({ recordedOn: '2026-09-10', inputValue: 13, inputUnit: 'kg', clientRequestId: `w2-${stamp}` }),
        }),
      );
      assert.equal(older.status, 201);
      const listed = await json(await fetch(`${http.origin}/api/pets/${petA}/weight`, { headers: ownerAuth }));
      assert.equal(listed.status, 200);
      assert.equal(Number(listed.body.latest.weightKg), 13);

      const allergy = await json(
        await fetch(`${http.origin}/api/pets/${petA}/allergies`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({ name: 'ქათამი', category: 'food', reportedStatus: 'suspected' }),
        }),
      );
      assert.equal(allergy.status, 201, JSON.stringify(allergy.body));
      const condition = await json(
        await fetch(`${http.origin}/api/pets/${petA}/conditions`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({ name: 'დერმატიტი', status: 'active', reportedBasis: 'owner_reported' }),
        }),
      );
      assert.equal(condition.status, 201, JSON.stringify(condition.body));

      const product = await json(
        await fetch(`${http.origin}/api/pets/${petA}/products`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({ kind: 'FLEA_TICK', name: 'ბრავექტო', clientRequestId: `p-${stamp}` }),
        }),
      );
      assert.equal(product.status, 201, JSON.stringify(product.body));

      const schedule = await json(
        await fetch(`${http.origin}/api/pets/${petA}/schedules`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({
            kind: 'FLEA_TICK',
            title: 'ბრავექტო',
            productId: product.body.product.id,
            startOn: '2026-09-14',
            recurrenceKind: 'ONCE',
            recurrenceBasis: 'NONE',
            source: 'USER_ENTERED',
            clientRequestId: `s-${stamp}`,
          }),
        }),
      );
      assert.equal(schedule.status, 201, JSON.stringify(schedule.body));
      const scheduleId = schedule.body.schedule.id;
      const occurrenceKey = `r${schedule.body.schedule.revision}|${schedule.body.schedule.nextDueOn}|date|0`;

      const reminder = await json(
        await fetch(`${http.origin}/api/pets/${petA}/schedules/${scheduleId}/reminders`, {
          method: 'PATCH',
          headers: ownerAuth,
          body: JSON.stringify({ reminderEnabled: true, reminderOffsetsDays: [0] }),
        }),
      );
      assert.equal(reminder.status, 200, JSON.stringify(reminder.body));
      assert.equal(reminder.body.revisionUnchanged, true);
      assert.equal(reminder.body.schedule.revision, schedule.body.schedule.revision);

      const identity = phase5ReminderIdentity({
        userId: owner.id,
        petId: petA,
        scheduleId,
        occurrenceKey,
      });
      const telemetry = await json(
        await fetch(`${http.origin}/api/pets/${petA}/schedules/${scheduleId}/reminder-delivery`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({
            occurrenceKey,
            alertKind: 'due',
            identity,
            installId: 'phase7-install',
            status: 'SCHEDULED_LOCAL',
            fireAtMs: Date.now() + 60_000,
          }),
        }),
      );
      assert.equal(telemetry.status, 202, JSON.stringify(telemetry.body));
      assert.equal(telemetry.body.accepted, true);
      assert.equal(telemetry.body.reminderSchemaReady, true);

      const feed = await json(await fetch(`${http.origin}/api/pets/reminders/feed`, { headers: ownerAuth }));
      assert.equal(feed.status, 200);
      assert.equal(feed.body.careSchemaReady, true);

      const chat = await json(
        await fetch(`${http.origin}/api/pets/${petA}/chat/query`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({ message: 'როგორია რუტინული მოვლა?', clientRequestId: `chat-${stamp}` }),
        }),
      );
      assert.equal(chat.status, 200, JSON.stringify(chat.body));
      assert.equal(chat.body.status, 'COMPLETE');
      assert.equal(chat.body.engine, 'openrouter');
      assert.doesNotMatch(JSON.stringify(chat.body), /evidencemd/i);

      const replayChat = await json(
        await fetch(`${http.origin}/api/pets/${petA}/chat/query`, {
          method: 'POST',
          headers: ownerAuth,
          body: JSON.stringify({ message: 'როგორია რუტინული მოვლა?', clientRequestId: `chat-${stamp}` }),
        }),
      );
      assert.equal(replayChat.status, 200);
      assert.equal(replayChat.body.replayed, true);

      const otherChat = await json(
        await fetch(`${http.origin}/api/pets/${petA}/chat/query`, {
          method: 'POST',
          headers: otherAuth,
          body: JSON.stringify({ message: 'სხვისი ცხოველი', clientRequestId: `other-${stamp}` }),
        }),
      );
      assert.equal(otherChat.status, 404);

      const archive = await json(
        await fetch(`${http.origin}/api/pets/${petB}/archive`, { method: 'POST', headers: ownerAuth }),
      );
      assert.equal(archive.status, 200);
      const archivedGet = await json(await fetch(`${http.origin}/api/pets/${petB}`, { headers: ownerAuth }));
      assert.equal(archivedGet.status, 404);

      const deleted = await deleteUserAccount(owner.id);
      assert.equal(deleted.ok, true);
      owner = null;
      assert.equal(await prisma.pet.count({ where: { id: petA } }), 0);
      assert.equal(await prisma.petChatSession.count({ where: { petId: petA } }), 0);
    } catch (error) {
      if (isPetsCareSchemaMissing(error) || isPetsSchemaMissing(error)) {
        t.skip('Pet tables are not applied on the local database');
        return;
      }
      throw error;
    } finally {
      setAskOpenRouterPreparedForTests(null);
      if (http) await http.close();
      if (owner) await prisma.user.delete({ where: { id: owner.id } }).catch(() => {});
      if (other) await prisma.user.delete({ where: { id: other.id } }).catch(() => {});
    }
  });
});
