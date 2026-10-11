import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoachUsage, loadCoachUsage } from './adminUsageCoach.js';

const NOW = new Date('2026-10-11T09:00:00Z'); // 13:00 in Tbilisi
const at = (s) => new Date(s);
const NONE = { workouts: false, nutrition: false, weight: false, photos: false };

function fixture() {
  return {
    teamUserIds: ['team'],
    accountsTotal: 12,
    people: [
      { id: 'team', fullName: 'Demo', email: 'demo.woman@medicard.ge', phone: null, createdAt: at('2026-03-24T08:00:00Z'), lastSeenAt: at('2026-10-11T07:00:00Z') },
      { id: 't1', fullName: 'Giorgi Beridze', email: '995599123456@phone.medicard.ge', phone: null, createdAt: at('2026-08-30T08:00:00Z'), lastSeenAt: at('2026-10-10T08:00:00Z') },
      { id: 't2', fullName: 'Ana', email: 'x@apple.medicard.ge', phone: null, createdAt: at('2026-10-07T08:00:00Z'), lastSeenAt: null },
      { id: 't3', fullName: 'Levan', email: 'levan@gmail.com', phone: null, createdAt: at('2026-09-19T08:00:00Z'), lastSeenAt: null },
    ],
    profiles: [
      { userId: 'team', displayName: 'ნინო · დემო', specialties: ['women'], experienceYears: 6, gymIds: ['g1'], status: 'VERIFIED', reviewedAt: at('2026-09-28T16:10:07Z'), submittedAt: at('2026-09-28T16:10:06Z'), createdAt: at('2026-09-28T16:10:06Z'), hasBio: true, hasInstagram: false, certificates: 0, certificateDates: [] },
      { userId: 't1', displayName: 'გიორგი ბერიძე', specialties: ['strength', 'weight_loss', 'not_a_key'], experienceYears: 6, gymIds: ['g1'], status: 'VERIFIED', reviewedAt: at('2026-09-02T08:00:00Z'), submittedAt: at('2026-09-01T08:00:00Z'), createdAt: at('2026-09-01T08:00:00Z'), hasBio: true, hasInstagram: true, certificates: 1, certificateDates: ['2026-09-01T08:05:00Z'] },
      { userId: 't2', displayName: 'ანა', specialties: ['yoga'], experienceYears: null, gymIds: ['g1', 'g2'], status: 'PENDING', reviewedAt: null, submittedAt: at('2026-10-08T08:00:00Z'), createdAt: at('2026-10-08T08:00:00Z'), hasBio: false, hasInstagram: false, certificates: 0, certificateDates: [] },
      { userId: 't3', displayName: 'ლევანი', specialties: [], experienceYears: 1, gymIds: ['g2'], status: 'REJECTED', reviewedAt: at('2026-09-21T08:00:00Z'), submittedAt: at('2026-09-20T08:00:00Z'), createdAt: at('2026-09-20T08:00:00Z'), hasBio: true, hasInstagram: false, certificates: 0, certificateDates: [] },
    ],
    links: [
      // c1 linked with t1's code (active at once), shares food and weight, has a goal proposal waiting.
      { trainerId: 't1', clientId: 'c1', status: 'ACTIVE', initiator: 'CLIENT', scopes: { ...NONE, nutrition: true, weight: true }, endedBy: null, createdAt: at('2026-09-05T08:00:00Z'), acceptedAt: at('2026-09-05T08:00:00.010Z'), endedAt: null, goalProposedAt: '2026-10-01T08:00:00Z' },
      // t1 invited c2 by QR, c2 accepted, later ended it.
      { trainerId: 't1', clientId: 'c2', status: 'ENDED', initiator: 'TRAINER', scopes: NONE, endedBy: 'CLIENT', createdAt: at('2026-09-14T08:00:00Z'), acceptedAt: at('2026-09-14T09:00:00Z'), endedAt: at('2026-09-20T08:00:00Z'), goalProposedAt: null },
      // t1 invited the team account — left out unless the team counts.
      { trainerId: 't1', clientId: 'team', status: 'REQUESTED', initiator: 'TRAINER', scopes: NONE, endedBy: null, createdAt: at('2026-10-09T08:00:00Z'), acceptedAt: null, endedAt: null, goalProposedAt: null },
      // c3 asked t1 and waits.
      { trainerId: 't1', clientId: 'c3', status: 'REQUESTED', initiator: 'CLIENT', scopes: NONE, endedBy: null, createdAt: at('2026-10-10T08:00:00Z'), acceptedAt: null, endedAt: null, goalProposedAt: null },
    ],
    sessions: [
      { trainerId: 't1', clientId: 'c1', startsAt: at('2026-09-15T15:00:00Z'), durationMin: 60, kind: 'STRENGTH', status: 'DONE', clientConfirmedAt: null, cancelledBy: null, lateCancel: false, clientRating: null, createdAt: at('2026-09-08T08:00:00Z'), updatedAt: at('2026-09-15T16:10:00Z'), exerciseCount: 3, series: 'repeat' },
      { trainerId: 't1', clientId: 'c1', startsAt: at('2026-09-22T15:00:00Z'), durationMin: 60, kind: 'STRENGTH', status: 'DONE', clientConfirmedAt: null, cancelledBy: null, lateCancel: false, clientRating: 5, createdAt: at('2026-09-08T08:00:00Z'), updatedAt: at('2026-09-23T10:00:00Z'), exerciseCount: 0, series: 'repeat' },
      { trainerId: 't1', clientId: 'c1', startsAt: at('2026-10-06T15:00:00Z'), durationMin: 45, kind: 'CARDIO', status: 'DONE', clientConfirmedAt: at('2026-10-05T10:00:00Z'), cancelledBy: null, lateCancel: false, clientRating: null, createdAt: at('2026-10-01T08:00:00Z'), updatedAt: at('2026-10-06T16:05:00Z'), exerciseCount: 0, series: null },
      { trainerId: 't1', clientId: 'c2', startsAt: at('2026-09-18T15:00:00Z'), durationMin: 60, kind: 'HIIT', status: 'NO_SHOW', clientConfirmedAt: null, cancelledBy: null, lateCancel: false, clientRating: null, createdAt: at('2026-09-12T08:00:00Z'), updatedAt: at('2026-09-18T16:30:00Z'), exerciseCount: 0, series: null },
      { trainerId: 't1', clientId: 'c1', startsAt: at('2026-10-13T15:00:00Z'), durationMin: 60, kind: 'STRENGTH', status: 'SCHEDULED', clientConfirmedAt: at('2026-10-10T08:00:00Z'), cancelledBy: null, lateCancel: false, clientRating: null, createdAt: at('2026-10-09T08:00:00Z'), updatedAt: at('2026-10-10T08:00:00Z'), exerciseCount: 0, series: null },
      { trainerId: 't1', clientId: 'c1', startsAt: at('2026-10-08T15:00:00Z'), durationMin: 60, kind: 'STRENGTH', status: 'SCHEDULED', clientConfirmedAt: null, cancelledBy: null, lateCancel: false, clientRating: null, createdAt: at('2026-10-02T08:00:00Z'), updatedAt: at('2026-10-02T08:00:00Z'), exerciseCount: 0, series: null },
      { trainerId: 't1', clientId: 'c2', startsAt: at('2026-09-19T08:00:00Z'), durationMin: 60, kind: 'MOBILITY', status: 'CANCELLED', clientConfirmedAt: null, cancelledBy: 'CLIENT', lateCancel: true, clientRating: null, createdAt: at('2026-09-13T08:00:00Z'), updatedAt: at('2026-09-19T05:00:00Z'), exerciseCount: 0, series: null },
      { trainerId: 't1', clientId: null, startsAt: at('2026-10-15T08:00:00Z'), durationMin: 60, kind: 'STRENGTH', status: 'OPEN', clientConfirmedAt: null, cancelledBy: null, lateCancel: false, clientRating: null, createdAt: at('2026-10-09T09:00:00Z'), updatedAt: at('2026-10-09T09:00:00Z'), exerciseCount: 0, series: null },
      // The demo trainer's open slots, all in the past.
      ...['2026-09-29', '2026-09-30', '2026-10-02'].map((d) => ({ trainerId: 'team', clientId: null, startsAt: at(`${d}T06:00:00Z`), durationMin: 60, kind: 'STRENGTH', status: 'OPEN', clientConfirmedAt: null, cancelledBy: null, lateCancel: false, clientRating: null, createdAt: at('2026-09-28T16:10:08Z'), updatedAt: at('2026-09-28T16:10:08Z'), exerciseCount: 0, series: null })),
    ],
    plans: [
      { trainerId: 't1', clientId: 'c1', active: true, createdAt: at('2026-10-02T08:00:00Z') },
      { trainerId: 't1', clientId: 'c1', active: false, createdAt: at('2026-09-16T08:00:00Z') },
    ],
    photos: [
      { userId: 'c1', createdAt: at('2026-10-03T08:00:00Z') },
      { userId: 'c1', createdAt: at('2026-10-04T08:00:00Z') },
      { userId: 'team', createdAt: at('2026-09-28T11:25:00Z') },
    ],
    workouts: [{ userId: 'c1', count: 5 }],
    qr: [{ userId: 'c1', createdAt: at('2026-09-05T07:55:00Z') }, { userId: 'u9', createdAt: at('2026-10-01T08:00:00Z') }, { userId: 'team', createdAt: at('2026-09-28T12:00:00Z') }],
    gyms: [
      { id: 'g1', brand: 'Aspria', brandKa: 'ასპრია', name: 'Vake', nameKa: null, city: 'თბილისი', district: 'ვაკე', status: 'ACTIVE', proposedBy: null },
      { id: 'g2', brand: 'Iron Gym', brandKa: null, name: 'Saburtalo', nameKa: null, city: 'თბილისი', district: null, status: 'ACTIVE', proposedBy: null },
      { id: 'g3', brand: 'New Box', brandKa: null, name: 'New Box', nameKa: null, city: 'ბათუმი', district: null, status: 'PROPOSED', proposedBy: 't2' },
      { id: 'g4', brand: 'Old', brandKa: null, name: 'Old', nameKa: null, city: 'ქუთაისი', district: null, status: 'HIDDEN', proposedBy: null },
    ],
    reviews: [
      { action: 'TRAINER_APPROVE', targetId: 'team', createdAt: at('2026-09-28T16:10:08Z') },
      { action: 'TRAINER_APPROVE', targetId: 't1', createdAt: at('2026-09-02T08:00:00Z') },
      { action: 'TRAINER_REJECT', targetId: 't3', createdAt: at('2026-09-21T08:00:00Z') },
    ],
    signups: [
      { id: 't2', createdAt: at('2026-10-07T08:00:00Z') },
      { id: 'c3', createdAt: at('2026-10-09T08:00:00Z') },
      { id: 'u9', createdAt: at('2026-10-01T08:00:00Z') },
      { id: 'c1', createdAt: at('2026-09-04T08:00:00Z') },
    ],
    avatarUserIds: ['t1'],
    reports: [{ reporterId: 'c2', reporterRole: 'CLIENT', subjectId: 't1', reason: 'harassment', blocked: true, status: 'open', createdAt: at('2026-09-20T08:00:00Z') }],
    blocks: [{ clientId: 'c2', trainerId: 't1', createdAt: at('2026-09-20T08:00:00Z') }],
    flags: [{ key: 'coach', enabled: false, effective: false, updatedAt: at('2026-10-05T19:53:41Z') }],
  };
}

const byKey = (ladder) => Object.fromEntries(ladder.map((s) => [s.key, s.count]));

test('team accounts are left out by default: trainers, links, sessions, ladder', () => {
  const d = buildCoachUsage(fixture(), { days: 30, now: NOW });
  assert.equal(d.totals.accounts, 11);
  assert.equal(d.totals.trainers, 3);
  assert.deepEqual([d.totals.pending, d.totals.verified, d.totals.rejected], [1, 1, 1]);
  assert.deepEqual(d.team, { accounts: 1, trainers: 1, links: 1, sessions: 3 });
  assert.equal(d.items.some((i) => i.team), false);
  assert.equal(d.sessions.slots.expired, 0); // the demo's past slots are team rows
  assert.deepEqual(byKey(d.ladder), { applied: 3, verified: 1, client: 1, session: 1, deep: 1, returned: 1 });
  assert.equal(d.ladder[1].rate, 33.3);
  assert.equal(d.flags.coach.effective, false);
  assert.equal(d.flags.coach.since, '2026-10-05T19:53:41.000Z');
});

test('including the team brings the demo trainer, its invite and its expired slots back', () => {
  const d = buildCoachUsage(fixture(), { days: 30, includeTeam: true, now: NOW });
  assert.equal(d.totals.accounts, 12);
  assert.equal(d.totals.trainers, 4);
  assert.equal(d.totals.verifiedNoClients, 1);
  assert.equal(d.sessions.slots.expired, 3);
  assert.equal(d.clients.invited, 1);
  assert.equal(d.items.find((i) => i.id === 't1').usage.invites, 1);
  const demo = d.items.find((i) => i.id === 'team');
  assert.equal(demo.team, true);
  assert.equal(demo.usage.expiredSlots, 3);
  assert.equal(demo.person.contact, 'demo.woman@medicard.ge');
  assert.equal(d.clients.qr.people, 3);
});

test('client side in aggregate: who is linked, how, what they share', () => {
  const c = buildCoachUsage(fixture(), { days: 30, now: NOW }).clients;
  assert.equal(c.ever, 2);
  assert.equal(c.active, 1);
  assert.equal(c.requested, 1);
  assert.equal(c.invited, 0);
  assert.equal(c.ended, 1);
  assert.equal(c.endedBy.CLIENT, 1);
  assert.deepEqual(c.via, { client: 1, trainer: 1 });
  assert.deepEqual(c.scopes, { workouts: 0, nutrition: 1, weight: 1, photos: 0 });
  assert.equal(c.sharesNothing, 0);
  assert.equal(c.goalsPending, 1);
  assert.equal(c.returned, 2);
  assert.deepEqual(c.photos, { people: 1, total: 2, linked: 1 });
  assert.deepEqual(c.workouts, { people: 1, total: 5 });
  assert.equal(c.qr.people, 2);
});

test('trainer card: counts only, newest activity first, no client ids or names', () => {
  const d = buildCoachUsage(fixture(), { days: 30, now: NOW });
  assert.deepEqual(d.items.map((i) => i.id), ['t1', 't2', 't3']);
  const t1 = d.items[0];
  assert.equal(t1.name, 'გიორგი ბერიძე');
  assert.equal(t1.status, 'VERIFIED');
  assert.equal(t1.verifiedAt, '2026-09-02T08:00:00.000Z');
  assert.deepEqual(t1.specialties, ['strength', 'weight_loss']);
  assert.deepEqual(t1.profile, { photo: true, bio: true, specialties: true, experience: true, certificate: true, gym: true });
  assert.deepEqual(t1.gyms, [{ label: 'ასპრია · ვაკე', city: 'თბილისი' }]);
  assert.deepEqual(t1.usage, {
    clients: 1, clientsEver: 2, requests: 1, invites: 0, ended: 1, goals: 1, sessions: 3, noShow: 1, cancelled: 1,
    upcoming: 1, unmarked: 1, openSlots: 1, expiredSlots: 0, plans: 2, plansActive: 1, reports: 1, reportsOpen: 1, blocks: 1,
  });
  assert.ok(t1.days >= 2);
  assert.equal(t1.lastAt, '2026-10-10T08:00:00.000Z');
  assert.equal(t1.person.contact, '+995 599 12 34 56');
  const t2 = d.items[1];
  assert.equal(t2.waitHours, 73);
  assert.deepEqual(t2.gyms.map((g) => g.label), ['ასპრია · ვაკე', 'Iron Gym · Saburtalo']);
  const wire = JSON.stringify(d.items);
  for (const leak of ['c1', 'c2', 'c3', 'scopes', 'hasBio', 'certificateDates']) assert.ok(!wire.includes(`"${leak}"`), `items must not carry ${leak}`);
  assert.equal(typeof t1.profile.bio, 'boolean'); // whether there is a bio, never the text
});

test('sessions, plans, review queue, gyms and reports', () => {
  const d = buildCoachUsage(fixture(), { days: 30, now: NOW });
  const s = d.sessions;
  assert.equal(s.booked, 7);
  assert.deepEqual(s.status, { upcoming: 1, unmarked: 1, DONE: 3, NO_SHOW: 1, CANCELLED: 1 });
  assert.equal(s.noShowRate, 25);
  assert.equal(s.lateCancel, 1);
  assert.equal(s.cancelledBy.CLIENT, 1);
  assert.deepEqual(s.slots, { future: 1, expired: 0, booked: 0 });
  assert.equal(s.repeated, 2);
  assert.equal(s.confirmed, 2);
  assert.equal(s.confirmRate, 33.3);
  assert.equal(s.withExercises, 1);
  assert.deepEqual(s.ratings, { count: 1, avg: 5 });
  assert.equal(s.kinds.STRENGTH, 4);
  assert.deepEqual(d.plans, { total: 2, active: 1, trainers: 1, clients: 1 });
  assert.equal(d.review.pending, 1);
  assert.equal(d.review.pendingOverdue, 1);
  assert.equal(d.review.oldestPendingHours, 73);
  assert.equal(d.review.answered, 2);
  assert.equal(d.review.medianAnswerHours, 24);
  assert.equal(d.review.rejectedEver, 1);
  assert.deepEqual(d.review.certificates, { trainers: 1, total: 1 });
  assert.equal(d.review.specialties.length, 3);
  assert.equal(d.review.experience.upTo10, 1);
  assert.equal(d.review.profile.photo, 1);
  assert.deepEqual(d.gyms.directory, { ACTIVE: 2, HIDDEN: 1, PROPOSED: 1 });
  assert.equal(d.gyms.proposedByTrainers, 1);
  assert.equal(d.gyms.top[0].label, 'ასპრია · ვაკე');
  assert.equal(d.gyms.top[0].trainers, 2); // t1 + t2; the rejected t3 is not counted
  assert.equal(d.safety.installed, true);
  assert.equal(d.safety.reports.open, 1);
  assert.equal(d.safety.reports.reasons.harassment, 1);
  assert.equal(d.safety.reports.withBlock, 1);
  assert.equal(d.safety.blocks, 1);
});

test('period: 30 and 7 days, trend series cover every day', () => {
  const p = buildCoachUsage(fixture(), { days: 30, now: NOW }).period;
  assert.equal(p.from, '2026-09-12');
  assert.equal(p.applications, 2);
  assert.equal(p.verified, 0);
  assert.equal(p.newLinks, 1);
  assert.equal(p.requests, 2);
  assert.equal(p.held, 3);
  assert.equal(p.noShow, 1);
  assert.equal(p.cancelled, 1);
  assert.equal(p.scheduled, 5);
  assert.equal(p.slots, 1);
  assert.equal(p.plans, 2);
  assert.equal(p.activeTrainers, 3);
  assert.equal(p.activeClients, 3);
  assert.equal(p.activePeople, 6);
  assert.equal(p.signups, 3);
  assert.equal(p.signupsJoined, 1);
  assert.equal(p.signupRate, 33.3);
  assert.equal(p.trend.held.length, 30);
  assert.equal(p.trend.held.find((x) => x.day === '2026-10-06').count, 1);
  const week = buildCoachUsage(fixture(), { days: 7, now: NOW }).period;
  assert.equal(week.from, '2026-10-05');
  assert.equal(week.held, 1);
  assert.equal(week.trend.scheduled.length, 7);
  assert.equal(week.trend.scheduled.find((x) => x.day === '2026-10-09').count, 2);
});

test('empty data: no crash, zeros, null rates, no reports table yet', () => {
  const d = buildCoachUsage({ reports: null, blocks: null }, { days: 30, now: NOW });
  assert.equal(d.installed, true);
  assert.equal(d.totals.trainers, 0);
  assert.equal(d.totals.accounts, 0);
  assert.equal(d.totals.clientRate, null);
  assert.ok(d.ladder.every((s) => s.count === 0 && s.rate === null));
  assert.deepEqual(d.items, []);
  assert.equal(d.itemsTotal, 0);
  assert.equal(d.review.oldestPendingHours, null);
  assert.equal(d.review.medianAnswerHours, null);
  assert.equal(d.safety.installed, false);
  assert.equal(d.period.trend.active.length, 30);
  assert.equal(d.flags.coach.effective, true);
});

test('loader: a missing coach table means „not installed“, not an error', async () => {
  const missing = () => Promise.reject(Object.assign(new Error('relation "TrainerProfile" does not exist'), { code: 'P2010' }));
  const db = {
    user: { findMany: async () => [], count: async () => 0 },
    adminAuditLog: { findMany: async () => [] },
    appActivity: { groupBy: async () => [], findMany: async () => [] },
    $queryRaw: missing,
    $queryRawUnsafe: missing,
  };
  const d = await loadCoachUsage({ db, now: NOW });
  assert.equal(d.installed, false);
});
