import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPetsOverview, isTeamEmail, ownerContact, vetTopics } from './adminPets.js';

const NOW = new Date('2026-10-11T09:00:00Z'); // 13:00 in Tbilisi
const at = (s) => new Date(s);

function fixture() {
  return {
    teamUserIds: ['team'],
    accountsTotal: 11,
    owners: [
      { id: 'team', fullName: 'Demo', email: 'demo@medicard.ge', phone: null, createdAt: at('2026-03-24T08:00:00Z'), lastSeenAt: at('2026-10-11T08:00:00Z') },
      { id: 'u1', fullName: 'Nino', email: '995599123456@phone.medicard.ge', phone: null, createdAt: at('2026-10-07T08:00:00Z'), lastSeenAt: at('2026-10-09T08:00:00Z') },
      { id: 'u2', fullName: 'Giorgi', email: 'x@apple.medicard.ge', phone: null, createdAt: at('2026-09-01T08:00:00Z'), lastSeenAt: null },
    ],
    pets: [
      { id: 'pt', userId: 'team', name: 'Luna', speciesId: 'dog', breedId: 'golden-retriever', sex: 'FEMALE', neutered: true, ageKind: 'EXACT', birthDate: '2022-04-18', hasPhoto: true, hasVet: true, archivedAt: null, createdAt: at('2026-06-23T08:00:00Z'), updatedAt: at('2026-06-23T08:00:00Z') },
      { id: 'p1', userId: 'u1', name: 'Kusa', speciesId: 'cat', breedId: 'mixed', sex: 'MALE', neutered: null, ageKind: 'APPROXIMATE', approxAgeYears: 3, approxAgeMonths: 0, approxAgeRecordedOn: '2026-10-07', hasPhoto: false, hasVet: false, archivedAt: null, createdAt: at('2026-10-07T09:00:00Z'), updatedAt: at('2026-10-07T09:00:10Z') },
      { id: 'p2', userId: 'u2', name: 'Bobi', speciesId: 'dog', breedId: 'unknown', sex: 'UNKNOWN', neutered: false, ageKind: 'UNKNOWN', hasPhoto: false, hasVet: false, archivedAt: null, createdAt: at('2026-09-20T08:00:00Z'), updatedAt: at('2026-09-20T08:00:00Z') },
      { id: 'p3', userId: 'u2', name: 'Rex', speciesId: 'dog', breedId: 'custom', customBreed: 'მწევარი', sex: 'MALE', neutered: false, ageKind: 'EXACT', birthDate: '2016-01-01', hasPhoto: false, hasVet: true, archivedAt: at('2026-10-01T08:00:00Z'), createdAt: at('2026-09-20T08:05:00Z'), updatedAt: at('2026-10-01T08:00:00Z') },
    ],
    weights: [
      { petId: 'pt', userId: 'team', createdAt: at('2026-10-01T08:00:00Z') },
      { petId: 'p1', userId: 'u1', createdAt: at('2026-10-07T09:01:00Z') },
      { petId: 'p1', userId: 'u1', createdAt: at('2026-10-09T09:01:00Z') },
    ],
    allergies: [{ petId: 'p1', userId: 'u1', createdAt: at('2026-10-07T09:02:00Z'), category: 'food', reportedStatus: 'suspected' }],
    conditions: [],
    products: [{ petId: 'pt', userId: 'team', createdAt: at('2026-10-01T08:00:00Z'), kind: 'VACCINATION', archivedAt: null }],
    schedules: [
      { petId: 'pt', userId: 'team', createdAt: at('2026-10-01T08:00:00Z'), kind: 'VACCINATION', recurrenceKind: 'EVERY_N_MONTHS', status: 'ACTIVE', reminderEnabled: true, nextDueOn: '2026-10-05', source: 'VETERINARIAN' },
      { petId: 'p2', userId: 'u2', createdAt: at('2026-10-10T08:00:00Z'), kind: 'DEWORMING', recurrenceKind: 'EVERY_N_MONTHS', status: 'ACTIVE', reminderEnabled: true, nextDueOn: '2026-10-15', source: 'USER_ENTERED' },
    ],
    events: [{ petId: 'pt', userId: 'team', createdAt: at('2026-10-02T08:00:00Z'), status: 'RECORDED', source: 'notification' }],
    skips: [],
    vetSessions: [{ petId: 'p2', userId: 'u2', createdAt: at('2026-10-10T08:10:00Z') }],
    questions: [
      { petId: 'pt', userId: 'team', sessionId: 'st', createdAt: at('2026-10-06T21:57:00Z') },
      { petId: 'p2', userId: 'u2', sessionId: 's2', createdAt: at('2026-10-10T08:10:00Z') },
      { petId: 'p2', userId: 'u2', sessionId: 's2', createdAt: at('2026-10-10T08:12:00Z') },
    ],
    questionTexts: [
      { userId: 'team', content: 'ლუნას ვიზიტისთვის რა მოვამზადო?' },
      { userId: 'u2', content: 'ძაღლი ღებინებს და არ ჭამს' },
      { userId: 'u2', content: 'შხამიანი რამე შეჭამა, არ სუნთქავს კარგად' },
    ],
    answers: [{ userId: 'team', status: 'COMPLETE', count: 1 }, { userId: 'u2', status: 'COMPLETE', count: 1 }, { userId: 'u2', status: 'FAILED', count: 1 }],
    drafts: [{ userId: 'u2', count: 1 }],
    deliveries: [{ userId: 'team', status: 'SCHEDULED_LOCAL', count: 40 }, { userId: 'u2', status: 'SCHEDULED_LOCAL', count: 2 }],
    aiVet: [
      { userId: 'team', status: 'OK', latencyMs: 7000, tokenUsage: { cost: 0.004 } },
      { userId: 'u2', status: 'OK', latencyMs: 9000, tokenUsage: { cost: 0.006 } },
      { userId: 'u2', status: 'ERROR', latencyMs: 30000, tokenUsage: null },
    ],
    vetFeedback: [{ userId: 'u2', rating: 1 }],
    signups: [
      { id: 'u1', createdAt: at('2026-10-07T08:00:00Z') },
      { id: 'u9', createdAt: at('2026-10-08T08:00:00Z') },
    ],
    appActivity: [
      { userId: 'u1', date: '2026-10-07' },
      { userId: 'u1', date: '2026-10-09' },
      { userId: 'u2', date: '2026-09-20' },
    ],
    flags: [{ key: 'pets', enabled: true, effective: true }, { key: 'mediVet', enabled: false, effective: false }],
  };
}

test('team logins are exact @medicard.ge accounts only', () => {
  assert.equal(isTeamEmail('demo@medicard.ge'), true);
  assert.equal(isTeamEmail('Review@MEDICARD.GE'), true);
  assert.equal(isTeamEmail('995599123456@phone.medicard.ge'), false);
  assert.equal(isTeamEmail('abc@apple.medicard.ge'), false);
  assert.equal(isTeamEmail('x@gmail.com'), false);
});

test('owner contact reads synthetic logins like the rest of the admin', () => {
  assert.equal(ownerContact({ email: '995599123456@phone.medicard.ge' }), '+995 599 12 34 56');
  assert.equal(ownerContact({ email: 'x@apple.medicard.ge' }), 'Apple-ით შესული');
  assert.equal(ownerContact({ email: 'a@b.ge', phone: '+995599000111' }), '+995 599 00 01 11');
  assert.equal(ownerContact({ email: 'a@b.ge' }), 'a@b.ge');
});

test('topics: keyword buckets, several per question, „other“ when nothing matches', () => {
  assert.deepEqual(vetTopics('ძაღლი ღებინებს და არ ჭამს'), ['food', 'digestion']);
  assert.deepEqual(vetTopics('Hello there'), ['other']);
  assert.ok(vetTopics('When is the next flea treatment?').includes('parasites'));
});

test('team accounts are left out by default: counts, ladder, list', () => {
  const d = buildPetsOverview(fixture(), { days: 30, now: NOW });
  assert.equal(d.totals.accounts, 10);
  assert.equal(d.totals.owners, 2);
  assert.equal(d.totals.pets, 3);
  assert.equal(d.totals.petsActive, 2);
  assert.equal(d.totals.petsArchived, 1);
  assert.deepEqual(d.team, { accounts: 1, pets: 1, owners: 1 });
  assert.equal(d.pets.some((p) => p.owner.team), false);
  const ladder = Object.fromEntries(d.ladder.map((s) => [s.key, s.count]));
  // u1 logged weight + allergy; u2 made a plan with a reminder and asked Medi Vet.
  assert.deepEqual(ladder, { owners: 2, recorded: 2, planned: 1, reminders: 1, vet: 1, returned: 2 });
  assert.equal(d.totals.onlyProfile, 0);
  assert.equal(d.vet.users, 1);
  assert.equal(d.vet.questions, 2);
  assert.equal(d.vet.ai.ok, 1);
  assert.equal(d.vet.ai.errors, 1);
  assert.equal(d.vet.answers.FAILED, 1);
  assert.equal(d.vet.drafts, 1);
  assert.equal(d.vet.feedback.up, 1);
  assert.equal(d.vet.safety.emergency, 1);
  assert.equal(d.care.delivery.SCHEDULED_LOCAL, 2);
  assert.equal(d.care.events.fromReminder, 0);
  assert.equal(d.flags.mediVet.effective, false);
});

test('including the team brings its pet, care and Medi Vet use back', () => {
  const d = buildPetsOverview(fixture(), { days: 30, includeTeam: true, now: NOW });
  assert.equal(d.totals.accounts, 11);
  assert.equal(d.totals.owners, 3);
  assert.equal(d.vet.questions, 3);
  assert.equal(d.care.events.fromReminder, 1);
  assert.equal(d.care.plans.overdue, 1);
  assert.equal(d.care.plans.dueSoon, 1);
  assert.equal(d.vet.ai.costUsd, 0.01);
  assert.equal(d.pets.find((p) => p.id === 'pt').owner.team, true);
});

test('pet rows: usage per pet, profile checks, breed and age, newest activity first', () => {
  const d = buildPetsOverview(fixture(), { days: 30, now: NOW });
  const [first] = d.pets;
  assert.equal(first.id, 'p2'); // Medi Vet question on 10 Oct is the latest pet activity
  assert.deepEqual(first.usage, { weight: 0, health: 0, care: 1, events: 0, reminders: 1, vet: 2 });
  const kusa = d.pets.find((p) => p.id === 'p1');
  assert.equal(kusa.usage.weight, 2);
  assert.equal(kusa.usage.health, 1);
  assert.equal(kusa.breed, null);
  assert.equal(kusa.breedKind, 'mixed');
  assert.equal(kusa.age.years, 3);
  assert.equal(kusa.profile.neutered, false);
  assert.equal(kusa.owner.contact, '+995 599 12 34 56');
  const rex = d.pets.find((p) => p.id === 'p3');
  assert.equal(rex.breed, 'მწევარი');
  assert.equal(rex.archived, true);
  assert.ok(!('photoUrl' in rex) && !('vetPhone' in rex));
});

test('period: new pets, signups that added a pet, first-pet timing', () => {
  const d = buildPetsOverview(fixture(), { days: 7, now: NOW });
  assert.equal(d.period.from, '2026-10-05');
  assert.equal(d.period.newPets, 1);
  assert.equal(d.period.signups, 2);
  assert.equal(d.period.signupsWithPet, 1);
  assert.equal(d.period.signupPetRate, 50);
  assert.equal(d.period.trend.pets.length, 7);
  assert.equal(d.period.trend.pets.find((p) => p.day === '2026-10-07').count, 1);
  assert.equal(d.period.questions, 2);
  assert.equal(d.firstPet.sameDay, 1);
  assert.equal(d.firstPet.later, 1);
  assert.equal(d.totals.appReturned, 1);
  assert.equal(d.composition.species.find((s) => s.id === 'dog').count, 1);
  assert.equal(d.composition.perOwner.one, 2);
});
