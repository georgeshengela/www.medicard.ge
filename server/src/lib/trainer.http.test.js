// MEDI COACH end-to-end over HTTP against a disposable local Postgres (never the hosted database):
//   DATABASE_URL=postgresql://coach@127.0.0.1:55433/medicard_coach_test node --test src/lib/trainer.http.test.js
// The database must have the Prisma schema plus prisma/20260928-trainer.sql (scripts/install-trainer.mjs).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import sharp from 'sharp';
import { prisma } from './prisma.js';
import { trainerRouter } from '../routes/trainer.routes.js';
import { errorHandler } from '../middleware/error.js';
import { signToken } from '../middleware/auth.js';
import { CONSENT_VERSION, addDaysYmd, tbilisiYmd } from './trainer.js';
import { adminReviewTrainer } from './trainerStore.js';
import { processSessionReminders } from './trainerPush.js';
import { deleteUserAccount } from './deleteUser.js';

function isolatedDb(url = process.env.DATABASE_URL || '') {
  try {
    const u = new URL(url);
    return ['127.0.0.1', 'localhost'].includes(u.hostname) && u.pathname === '/medicard_coach_test';
  } catch {
    return false;
  }
}

function listen(app) {
  const server = createServer(app);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ origin: `http://127.0.0.1:${port}`, close: () => new Promise((done) => server.close(() => done())) });
    });
  });
}

describe('MEDI COACH HTTP flow', { timeout: 120_000 }, () => {
  it('trainer applies, is verified, links clients with consent, schedules, plans, sees scoped data', async (t) => {
    if (!isolatedDb()) {
      t.skip('DATABASE_URL is not the disposable coach database (127.0.0.1/medicard_coach_test)');
      return;
    }
    const app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/api/trainer', trainerRouter);
    app.use(errorHandler);
    const http = await listen(app);
    const stamp = Date.now();
    const made = [];
    const mk = async (name, phone) => {
      const u = await prisma.user.create({ data: { email: `coach.${name}.${stamp}@medicard.test`, fullName: name, passwordHash: 'x', phone, birthDate: new Date('1992-05-10') } });
      made.push(u.id);
      return u;
    };
    const call = async (user, method, path, body, { form } = {}) => {
      const headers = { Authorization: `Bearer ${signToken(user)}` };
      let payload;
      if (form) payload = form;
      else if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
      }
      const res = await fetch(`${http.origin}/api/trainer${path}`, { method, headers, body: payload });
      const type = res.headers.get('content-type') || '';
      return { status: res.status, type, body: type.includes('json') ? await res.json() : await res.arrayBuffer() };
    };
    const jpeg = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#14B8A6' } }).jpeg().toBuffer();
    const imageForm = (fields) => {
      const f = new FormData();
      for (const [k, v] of Object.entries(fields)) f.append(k, String(v));
      f.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'x.jpg');
      return f;
    };

    try {
      const trainer = await mk('ნიკა', `+99559${String(stamp).slice(-7)}`);
      const client = await mk('ნინო', `+99557${String(stamp).slice(-7)}`);
      const client2 = await mk('ლუკა', `+99555${String(stamp).slice(-7)}`);
      const outsider = await mk('გარე', null);

      // Gym directory
      const gyms = await call(client, 'GET', '/gyms');
      assert.equal(gyms.status, 200);
      assert.ok(gyms.body.brands.length > 50, 'the Georgian directory is installed');
      const oktopus = gyms.body.brands.find((b) => b.brand === 'Oktopus');
      assert.ok(oktopus.branches.length >= 5);
      const gymIds = [oktopus.branches[0].id];
      assert.equal((await call(client, 'GET', '/gyms?q=aspria')).body.brands[0].brand, 'Aspria');

      // Application: phone required; pending cannot work yet
      assert.equal((await call(outsider, 'POST', '/apply', { displayName: 'გარე', gymIds })).body.code, 'PHONE_VERIFICATION_REQUIRED');
      const applied = await call(trainer, 'POST', '/apply', { displayName: 'ნიკა ბერიძე', bio: 'ძალოვანი ვარჯიში', specialties: ['strength', 'weight_loss'], experienceYears: 6, instagram: '@nika.fit', gymIds });
      assert.equal(applied.status, 201, JSON.stringify(applied.body));
      assert.equal(applied.body.trainerProfile.status, 'PENDING');
      assert.equal(applied.body.trainerProfile.code, null, 'no code before verification');
      assert.equal((await call(trainer, 'GET', '/coach/today')).body.code, 'TRAINER_NOT_VERIFIED');
      const cert = await call(trainer, 'POST', '/certificates', undefined, { form: imageForm({ title: 'NASM Certified Personal Trainer', issuer: 'NASM', year: 2021 }) });
      assert.equal(cert.status, 201, JSON.stringify(cert.body));
      const certFile = await call(trainer, 'GET', `/certificates/${cert.body.certificate.id}/file`);
      assert.equal(certFile.status, 200);
      assert.match(certFile.type, /image\/jpeg/);
      assert.equal((await call(client, 'GET', `/certificates/${cert.body.certificate.id}/file`)).status, 404, 'others cannot open certificates');

      await adminReviewTrainer({ userId: trainer.id, action: 'approve', note: '', admin: { id: 'a', email: 'qa@medicard.test' } });
      const me = await call(trainer, 'GET', '/me');
      assert.equal(me.body.trainerProfile.status, 'VERIFIED');
      const code = me.body.trainerProfile.code;
      assert.match(code, /^[A-Z0-9]{6}$/);

      // Client finds the trainer by code and links with consent
      const card = await call(client, 'GET', `/code/${code.toLowerCase()}`);
      assert.equal(card.body.trainer.displayName, 'ნიკა ბერიძე');
      assert.equal(card.body.trainer.verified, true);
      assert.equal(card.body.trainer.certificates[0].issuer, 'NASM');
      assert.equal((await call(client, 'POST', '/link', { code, consentVersion: 'old' })).status, 400);
      const linked = await call(client, 'POST', '/link', { code, consentVersion: CONSENT_VERSION });
      assert.equal(linked.status, 201, JSON.stringify(linked.body));
      assert.equal(linked.body.link.status, 'ACTIVE');
      assert.equal(linked.body.overview.link.scopes.photos, false, 'photos are not shared by default');
      assert.equal((await call(client, 'POST', '/link', { code, consentVersion: CONSENT_VERSION })).status, 200, 'repeat is idempotent');
      assert.equal((await call(trainer, 'POST', '/link', { code, consentVersion: CONSENT_VERSION })).body.code, 'OWN_TRAINER');

      // Second client requests from search; trainer accepts
      const found = await call(client2, 'GET', `/search?gymId=${gymIds[0]}`);
      assert.equal(found.body.trainers.length, 1);
      const req2 = await call(client2, 'POST', '/link', { trainerId: trainer.id, consentVersion: CONSENT_VERSION, note: 'მინდა 5 კგ-ის დაკლება' });
      assert.equal(req2.body.link.status, 'REQUESTED');
      const roster = await call(trainer, 'GET', '/coach/clients');
      assert.equal(roster.body.clients.length, 1);
      assert.equal(roster.body.requests[0].note, 'მინდა 5 კგ-ის დაკლება');
      assert.equal((await call(trainer, 'POST', `/coach/requests/${roster.body.requests[0].linkId}`, { accept: true })).body.link.status, 'ACTIVE');

      // Sessions: weekly series, conflict, open slot booked once
      const tomorrow = addDaysYmd(tbilisiYmd(), 1);
      const at = (ymd, hh) => new Date(`${ymd}T${String(hh - 4).padStart(2, '0')}:00:00Z`);
      const series = await call(trainer, 'POST', '/coach/sessions', { clientId: client.id, startsAt: at(tomorrow, 19), durationMin: 60, gymId: gymIds[0], kind: 'STRENGTH', repeatWeeks: 3 });
      assert.equal(series.status, 201, JSON.stringify(series.body));
      assert.equal(series.body.sessions.length, 3);
      assert.equal(series.body.sessions[0].gym.brand, 'Oktopus');
      const clash = await call(trainer, 'POST', '/coach/sessions', { clientId: client2.id, startsAt: new Date(at(tomorrow, 19).getTime() + 30 * 60000) });
      assert.equal(clash.body.code, 'SESSION_CONFLICT', JSON.stringify(clash.body));
      assert.equal((await call(trainer, 'POST', '/coach/sessions', { clientId: outsider.id, startsAt: at(tomorrow, 10) })).body.code, 'LINK_NOT_ACTIVE', 'cannot book strangers');
      const slot = await call(trainer, 'POST', '/coach/sessions', { clientId: null, startsAt: at(tomorrow, 8), kind: 'CARDIO' });
      assert.equal(slot.body.sessions[0].status, 'OPEN');
      const ov = await call(client2, 'GET', '/overview');
      assert.equal(ov.body.openSlots.length, 1);
      assert.equal((await call(client2, 'POST', `/sessions/${slot.body.sessions[0].id}/book`)).status, 201);
      assert.equal((await call(client, 'POST', `/sessions/${slot.body.sessions[0].id}/book`)).body.code, 'SLOT_TAKEN');
      const week = await call(trainer, 'GET', '/coach/sessions');
      assert.equal(week.body.sessions.filter((s) => s.status === 'SCHEDULED').length, 2, 'this week: series #1 and the booked slot');

      const clientView = await call(client, 'GET', '/overview');
      assert.equal(clientView.body.upcoming.length, 3);
      assert.equal(clientView.body.trainer.displayName, 'ნიკა ბერიძე');
      const firstId = clientView.body.upcoming[0].id;
      assert.ok((await call(client, 'POST', `/sessions/${firstId}/confirm`)).body.session.clientConfirmedAt);
      const cancelled = await call(client, 'POST', `/sessions/${clientView.body.upcoming[2].id}/cancel`, { reason: 'მივლინება' });
      assert.equal(cancelled.body.session.status, 'CANCELLED');
      assert.equal(cancelled.body.session.lateCancel, false);
      assert.equal((await call(client2, 'POST', `/sessions/${firstId}/cancel`)).status, 404, 'cannot cancel someone else’s session');

      // Reminders: 24 h window claims once
      const firstStart = new Date(clientView.body.upcoming[0].startsAt);
      const sent = [];
      const r1 = await processSessionReminders({ now: new Date(firstStart.getTime() - 23 * 3600000), send: async (tk, m) => { sent.push(m); return { sent: 1 }; } });
      assert.ok(r1.checked >= 1);
      const [flags] = await prisma.$queryRaw`SELECT reminded24, reminded1 FROM "TrainerSession" WHERE id = ${firstId}`;
      assert.deepEqual(flags, { reminded24: true, reminded1: false });
      await processSessionReminders({ now: new Date(firstStart.getTime() - 23 * 3600000), send: async () => ({ sent: 1 }) });
      const [again] = await prisma.$queryRaw`SELECT reminded24 FROM "TrainerSession" WHERE id = ${firstId}`;
      assert.equal(again.reminded24, true);
      const r2 = await processSessionReminders({ now: new Date(firstStart.getTime() - 50 * 60000), send: async () => ({ sent: 1 }) });
      assert.ok(r2.checked >= 1);
      const [flags2] = await prisma.$queryRaw`SELECT reminded1 FROM "TrainerSession" WHERE id = ${firstId}`;
      assert.equal(flags2.reminded1, true);

      // Nutrition: two days over the plan → trainer sees OVER and an alert
      const today = tbilisiYmd();
      for (const [d, kcal, protein] of [[addDaysYmd(today, -1), 2600, 120], [addDaysYmd(today, -2), 2500, 120], [addDaysYmd(today, -3), 1980, 90]]) {
        await prisma.nutritionMeal.create({ data: { id: `m-${stamp}-${d}`, userId: client.id, date: d, type: 'lunch', items: [{ name: 'ხაჭაპური', calories: kcal, protein, carbs: 200, fat: 90 }] } });
      }
      assert.equal((await call(trainer, 'POST', `/coach/clients/${client.id}/plan`, { title: 'ჭრის ფაზა', targets: { calories: 2000, protein: 140 }, meals: [{ slot: 'breakfast', time: '08:30', items: [{ name: 'შვრია', grams: 60, calories: 230 }] }] })).status, 201);
      const dash = await call(trainer, 'GET', `/coach/clients/${client.id}`);
      assert.equal(dash.status, 200, JSON.stringify(dash.body));
      const byDate = Object.fromEntries(dash.body.nutrition.days.map((d) => [d.date, d.status]));
      assert.equal(byDate[addDaysYmd(today, -1)], 'OVER');
      assert.equal(byDate[addDaysYmd(today, -2)], 'OVER');
      assert.equal(byDate[addDaysYmd(today, -3)], 'LOW_PROTEIN');
      assert.equal(dash.body.plan.title, 'ჭრის ფაზა');
      assert.equal(dash.body.photos, null, 'photos not shared');
      const coachRoster = await call(trainer, 'GET', '/coach/clients');
      assert.ok(coachRoster.body.clients.find((c) => c.id === client.id).alerts.some((a) => a.kind === 'OVER_STREAK'));
      const todayView = await call(trainer, 'GET', '/coach/today');
      assert.equal(todayView.status, 200);
      assert.ok(todayView.body.alerts.some((a) => a.kind === 'OVER_STREAK'));
      const clientPlan = await call(client, 'GET', '/overview');
      assert.equal(clientPlan.body.plan.targets.calories, 2000);
      assert.equal(clientPlan.body.nutrition.days.find((d) => d.date === addDaysYmd(today, -1)).status, 'OVER');

      // Weight goal and progress (appState is where the app keeps them)
      await prisma.healthProfile.create({ data: { userId: client.id, heightCm: 168, weightKg: 82, extraAnswers: { appState: { weightLogs: [{ id: 'w1', date: addDaysYmd(today, -20), kg: 84, at: 'x' }, { id: 'w2', date: addDaysYmd(today, -1), kg: 81.5, at: 'y' }], weightGoal: { id: 'g', startKg: 84, targetKg: 74, startedYmd: addDaysYmd(today, -20), deadlineYmd: addDaysYmd(today, 100), paceKgPerWeek: 0.5 } } } } });
      const dash2 = await call(trainer, 'GET', `/coach/clients/${client.id}`);
      assert.equal(dash2.body.weight.currentKg, 81.5);
      assert.equal(dash2.body.weight.progress.percent, 25);
      assert.equal(dash2.body.weight.series.length, 2);
      assert.equal((await call(trainer, 'POST', `/coach/clients/${client.id}/goal`, { type: 'lose', targetKg: 72, deadlineYmd: addDaysYmd(today, 120) })).status, 201);
      assert.equal((await call(client, 'GET', '/overview')).body.link.proposedGoal.targetKg, 72);
      assert.equal((await call(client, 'POST', '/link/goal', { decision: 'accepted' })).body.ok, true);
      assert.equal((await call(client, 'GET', '/overview')).body.link.proposedGoal, null);

      // Photos: private; trainer only with the photos scope; strangers never
      const photo = await call(client, 'POST', '/photos', undefined, { form: imageForm({ pose: 'FRONT', weightKg: 81.5 }) });
      assert.equal(photo.status, 201, JSON.stringify(photo.body));
      const pid = photo.body.photo.id;
      assert.equal((await call(client, 'GET', `/photos/${pid}/file`)).status, 200);
      assert.equal((await call(trainer, 'GET', `/coach/photos/${pid}/file`)).status, 404, 'photos scope is off');
      assert.equal((await call(client2, 'GET', `/photos/${pid}/file`)).status, 404);
      await call(client, 'PATCH', '/link', { scopes: { photos: true } });
      const seen = await call(trainer, 'GET', `/coach/photos/${pid}/file`);
      assert.equal(seen.status, 200);
      assert.match(seen.type, /image\/jpeg/);
      assert.equal((await call(trainer, 'GET', `/coach/clients/${client.id}`)).body.photos.length, 1);

      // Revoking nutrition hides it at once and blocks new plans
      await call(client, 'PATCH', '/link', { scopes: { nutrition: false } });
      assert.equal((await call(trainer, 'GET', `/coach/clients/${client.id}`)).body.nutrition, null);
      assert.equal((await call(trainer, 'POST', `/coach/clients/${client.id}/plan`, { title: 'ახალი', targets: { calories: 1800 } })).body.code, 'SCOPE_NOT_SHARED');

      // Workouts from Health (kept only while shared)
      const w = await call(client, 'POST', '/workouts/sync', { workouts: [{ externalId: `hk-${stamp}`, source: 'apple_health', kind: 'traditionalStrengthTraining', startedAt: new Date(Date.now() - 3 * 3600000), endedAt: new Date(Date.now() - 2 * 3600000), kcal: 420, avgHeartRate: 128 }] });
      assert.equal(w.body.saved, 1);
      assert.equal((await call(trainer, 'GET', `/coach/clients/${client.id}`)).body.activity.workouts[0].kcal, 420);
      assert.equal((await call(outsider, 'POST', '/workouts/sync', { workouts: [] })).body.skipped, 'not_shared');

      // Completing: future session refused; a past one is logged and visible to the client
      assert.equal((await call(trainer, 'POST', `/coach/sessions/${firstId}/complete`, { status: 'DONE' })).status, 409);
      const pastId = `past-${stamp}`;
      await prisma.$executeRaw`INSERT INTO "TrainerSession" (id, "trainerId", "clientId", "startsAt", "durationMin", status) VALUES (${pastId}, ${trainer.id}, ${client.id}, ${new Date(Date.now() - 3 * 3600000)}, 60, 'SCHEDULED')`;
      const done = await call(trainer, 'POST', `/coach/sessions/${pastId}/complete`, { status: 'DONE', exercises: [{ name: 'ბექ სქვოთი', sets: 4, reps: 8, kg: 60 }], trainerNote: 'ტექნიკა გაუმჯობესდა' });
      assert.equal(done.body.session.status, 'DONE');
      const detail = await call(client, 'GET', `/session/${pastId}`);
      assert.equal(detail.body.session.exercises[0].kg, 60);
      assert.equal(detail.body.session.workout.kcal, 420, 'the phone workout is attached to the session');
      assert.equal((await call(client, 'POST', `/sessions/${pastId}/rate`, { rating: 5 })).body.session.clientRating, 5);

      // Client ends the link: access stops, future sessions are cancelled
      assert.equal((await call(client, 'DELETE', '/link')).body.ok, true);
      assert.equal((await call(trainer, 'GET', `/coach/clients/${client.id}`)).body.code, 'LINK_NOT_ACTIVE');
      assert.equal((await call(trainer, 'GET', `/coach/photos/${pid}/file`)).status, 404);
      const [left] = await prisma.$queryRaw`SELECT count(*)::int AS n FROM "TrainerSession" WHERE "clientId" = ${client.id} AND status = 'SCHEDULED' AND "startsAt" > now()`;
      assert.equal(left.n, 0);

      // Account deletion removes the person's coach rows
      const del = await deleteUserAccount(client.id);
      assert.equal(del.ok, true);
      made.splice(made.indexOf(client.id), 1);
      const [rest] = await prisma.$queryRaw`SELECT (SELECT count(*)::int FROM "ProgressPhoto" WHERE "userId" = ${client.id}) + (SELECT count(*)::int FROM "TrainerLink" WHERE "clientId" = ${client.id}) AS n`;
      assert.equal(rest.n, 0);
    } finally {
      for (const id of made) await prisma.user.delete({ where: { id } }).catch(() => {});
      await http.close();
    }
  });
});
