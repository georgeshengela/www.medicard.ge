import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CONSENT_VERSION,
  DEFAULT_SCOPES,
  adherenceScore,
  applySchema,
  clientAlerts,
  dayAdherence,
  expandSeries,
  expectedWeight,
  findConflict,
  formatSessionTime,
  goalProgress,
  isLateCancel,
  linkAllows,
  linkSchema,
  mealPlanSchema,
  normalizeScopes,
  reminderDue,
  sessionSchema,
  tbilisiDayStart,
  tbilisiYmd,
  trailingRun,
} from './trainer.js';
import { gymId, gymRowsFromDirectory, groupByBrand } from './gyms.js';
import { matchWorkout, photoPublic } from './trainerStore.js';

test('scopes: photos are off by default, unknown keys ignored, links must be ACTIVE', () => {
  assert.deepEqual(normalizeScopes(undefined), { ...DEFAULT_SCOPES });
  assert.equal(DEFAULT_SCOPES.photos, false);
  assert.deepEqual(normalizeScopes({ photos: true, admin: true, nutrition: false }), { workouts: true, nutrition: false, weight: true, photos: true });
  assert.equal(linkAllows({ status: 'ACTIVE', scopes: { nutrition: true } }, 'nutrition'), true);
  assert.equal(linkAllows({ status: 'ACTIVE', scopes: { nutrition: false } }, 'nutrition'), false);
  assert.equal(linkAllows({ status: 'REQUESTED', scopes: { nutrition: true } }, 'nutrition'), false);
  assert.equal(linkAllows({ status: 'ACTIVE', scopes: {} }, 'photos'), false);
  assert.equal(linkAllows(null, 'weight'), false);
});

test('Tbilisi calendar: day boundaries are UTC+4', () => {
  assert.equal(tbilisiYmd(new Date('2026-09-28T19:59:00Z')), '2026-09-28');
  assert.equal(tbilisiYmd(new Date('2026-09-28T20:00:00Z')), '2026-09-29');
  assert.equal(tbilisiDayStart('2026-09-29').toISOString(), '2026-09-28T20:00:00.000Z');
  assert.equal(formatSessionTime('2026-10-01T15:00:00Z'), 'ხუთ, 1 ოქტ · 19:00');
});

test('sessions: weekly series, conflicts, late cancel and reminder windows', () => {
  const series = expandSeries('2026-10-01T15:00:00Z', 4);
  assert.equal(series.length, 4);
  assert.equal(series[3].toISOString(), '2026-10-22T15:00:00.000Z');
  assert.equal(expandSeries('2026-10-01T15:00:00Z', 99).length, 12);
  const existing = [{ id: 'a', status: 'SCHEDULED', startsAt: '2026-10-01T15:00:00Z', durationMin: 60 }, { id: 'b', status: 'CANCELLED', startsAt: '2026-10-01T17:00:00Z', durationMin: 60 }];
  assert.equal(findConflict(existing, '2026-10-01T15:30:00Z', 60)?.id, 'a');
  assert.equal(findConflict(existing, '2026-10-01T16:00:00Z', 60), null, 'back-to-back is fine');
  assert.equal(findConflict(existing, '2026-10-01T17:00:00Z', 60), null, 'cancelled sessions do not block');
  assert.equal(findConflict(existing, '2026-10-01T15:30:00Z', 60, 'a'), null, 'a session does not clash with itself');
  const now = new Date('2026-10-01T10:00:00Z');
  assert.equal(isLateCancel('2026-10-01T20:00:00Z', now), true);
  assert.equal(isLateCancel('2026-10-02T12:00:00Z', now), false);
  const s = { status: 'SCHEDULED', clientId: 'c', startsAt: '2026-10-01T15:00:00Z', reminded24: false, reminded1: false };
  assert.equal(reminderDue(s, new Date('2026-09-30T14:00:00Z')), null, 'more than 24 h ahead');
  assert.equal(reminderDue(s, new Date('2026-09-30T16:00:00Z')), '24h');
  assert.equal(reminderDue({ ...s, reminded24: true }, new Date('2026-09-30T16:00:00Z')), null);
  assert.equal(reminderDue({ ...s, reminded24: true }, new Date('2026-10-01T14:05:00Z')), '1h');
  assert.equal(reminderDue({ ...s, reminded1: true, reminded24: true }, new Date('2026-10-01T14:05:00Z')), null);
  assert.equal(reminderDue({ ...s, status: 'OPEN', clientId: null }, new Date('2026-10-01T14:05:00Z')), null);
  assert.equal(reminderDue(s, new Date('2026-10-01T15:01:00Z')), null, 'already started');
});

test('nutrition adherence against the trainer plan', () => {
  const targets = { calories: 2000, protein: 150 };
  assert.equal(dayAdherence({ targets, eaten: { calories: 2050, protein: 150 }, meals: 3 }).status, 'ON');
  assert.equal(dayAdherence({ targets, eaten: { calories: 2300, protein: 150 }, meals: 3 }).status, 'OVER');
  assert.equal(dayAdherence({ targets, eaten: { calories: 1500, protein: 150 }, meals: 2 }).status, 'UNDER');
  assert.equal(dayAdherence({ targets, eaten: { calories: 1500 }, meals: 2, isToday: true }).status, 'PENDING', 'today is not judged as under yet');
  assert.equal(dayAdherence({ targets, eaten: { calories: 2300 }, meals: 3, isToday: true }).status, 'OVER', 'over is final even today');
  assert.equal(dayAdherence({ targets, eaten: { calories: 2000, protein: 90 }, meals: 3 }).status, 'LOW_PROTEIN');
  assert.equal(dayAdherence({ targets, eaten: { calories: 0 }, meals: 0 }).status, 'NONE');
  assert.equal(dayAdherence({ targets: null, eaten: { calories: 900 }, meals: 1 }).status, 'ON', 'no plan: logging counts');
  const days = [
    { date: '2026-09-25', status: 'ON' }, { date: '2026-09-26', status: 'OVER' }, { date: '2026-09-27', status: 'OVER' },
    { date: '2026-09-28', status: 'PENDING' }, { date: '2026-09-24', status: 'NONE' },
  ];
  assert.equal(adherenceScore(days), 33);
  assert.equal(adherenceScore([{ status: 'NONE' }]), null);
  assert.equal(trailingRun(days, (d) => d.status === 'OVER'), 2, 'skips today, counts the streak');
});

test('goal progress and trainer alerts', () => {
  const goal = { startKg: 90, targetKg: 80, startedYmd: '2026-09-01', deadlineYmd: '2026-11-30' };
  assert.deepEqual(goalProgress(goal, 85), { percent: 50, remainingKg: -5, direction: 'lose' });
  assert.equal(goalProgress(goal, 95).percent, 0);
  assert.equal(goalProgress({ startKg: 60, targetKg: 66 }, 63).direction, 'gain');
  assert.equal(expectedWeight(goal, '2026-10-16'), 85);
  const alerts = clientAlerts({
    name: 'ნინო',
    nutritionDays: [{ date: '2026-09-26', status: 'OVER' }, { date: '2026-09-27', status: 'OVER' }, { date: '2026-09-28', status: 'PENDING' }],
    lastMealYmd: '2026-09-28',
    lastWeighYmd: '2026-09-18',
    lastSession: { status: 'NO_SHOW' },
    goal,
    currentKg: 88,
    today: '2026-10-16',
  });
  const kinds = alerts.map((a) => a.kind);
  assert.ok(kinds.includes('OVER_STREAK'));
  assert.ok(kinds.includes('NO_SHOW'));
  assert.ok(kinds.includes('BEHIND_GOAL'));
  assert.ok(kinds.includes('NO_WEIGH_IN'));
  assert.ok(!alerts.some((a) => /კკალ|\d{3,4} კალ/.test(a.text)), 'alerts never quote calorie values');
  assert.deepEqual(clientAlerts({ name: 'x', today: '2026-10-01' }), [], 'nothing shared → no alerts');
});

test('validation: application, link consent, sessions, meal plans', () => {
  assert.throws(() => applySchema.parse({ displayName: 'ნიკა', gymIds: [] }));
  assert.equal(applySchema.parse({ displayName: 'ნიკა ბერიძე', gymIds: ['g1'], specialties: ['strength'], instagram: '@nika.fit' }).instagram, '@nika.fit');
  assert.throws(() => applySchema.parse({ displayName: 'ნიკა', gymIds: ['g1'], specialties: ['hacking'] }));
  assert.throws(() => linkSchema.parse({ code: 'ABC234', consentVersion: 'old' }), 'outdated consent is refused');
  assert.equal(linkSchema.parse({ code: 'ABC234', consentVersion: CONSENT_VERSION }).code, 'ABC234');
  assert.throws(() => linkSchema.parse({ consentVersion: CONSENT_VERSION }));
  const s = sessionSchema.parse({ startsAt: '2026-10-01T15:00:00Z', clientId: 'c' });
  assert.equal(s.durationMin, 60);
  assert.equal(s.kind, 'STRENGTH');
  assert.throws(() => sessionSchema.parse({ startsAt: '2026-10-01T15:00:00Z', durationMin: 5 }));
  assert.throws(() => mealPlanSchema.parse({ title: 'x', targets: { calories: 300 } }));
  const plan = mealPlanSchema.parse({ title: 'ჭრის ფაზა', targets: { calories: 1900, protein: 150 }, meals: [{ slot: 'breakfast', time: '08:30', items: [{ name: 'შვრია', grams: 60, calories: 230 }] }] });
  assert.equal(plan.meals[0].items[0].calories, 230);
});

test('gym directory: stable ids, low confidence hidden, grouped by brand', () => {
  const directory = JSON.parse(readFileSync(new URL('../data/gyms-ge.json', import.meta.url), 'utf8'));
  const rows = gymRowsFromDirectory(directory);
  assert.ok(rows.length >= 100, 'at least 100 branches');
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, 'ids are unique');
  assert.equal(gymId('Oktopus', 'City Mall', 'თბილისი'), gymRowsFromDirectory(directory).find((r) => r.brand === 'Oktopus' && r.name === 'City Mall').id);
  assert.ok(rows.every((r) => r.source), 'every gym carries its public source');
  assert.equal(rows.find((r) => r.name === 'Digomi City').status, 'HIDDEN');
  assert.ok(rows.filter((r) => r.status === 'ACTIVE').length > 100);
  const grouped = groupByBrand(rows.filter((r) => r.status === 'ACTIVE'));
  assert.equal(grouped[0].brand, 'Oktopus', 'largest chain first');
});

test('photos and workouts: private URLs only; workout matched to the session window', () => {
  const p = photoPublic({ id: 'p1', takenOn: '2026-09-28', pose: 'FRONT', fileKey: '/uploads/abc.jpg' });
  assert.equal(p.url, '/api/trainer/photos/p1/file');
  assert.equal(JSON.stringify(p).includes('/uploads/'), false, 'storage key never leaves the server');
  const session = { startsAt: '2026-10-01T15:00:00Z', durationMin: 60 };
  const w = [{ id: 'w1', startedAt: '2026-10-01T15:05:00Z', endedAt: '2026-10-01T16:02:00Z' }, { id: 'w2', startedAt: '2026-10-01T08:00:00Z', endedAt: '2026-10-01T08:30:00Z' }];
  assert.equal(matchWorkout(session, w)?.id, 'w1');
  assert.equal(matchWorkout(session, [w[1]]), null);
});

import { avatarVisible, newQrToken, parseQrToken, qrLink, QR_TOKEN_RE } from './identity.js';

test('personal QR: random token, parsed from a scanned URL, never the user id', () => {
  const a = newQrToken();
  const b = newQrToken();
  assert.notEqual(a, b);
  assert.match(a, QR_TOKEN_RE);
  assert.equal(parseQrToken(qrLink(a)), a);
  assert.equal(parseQrToken(`${qrLink(a)}?utm=x`), a);
  assert.equal(parseQrToken(a), a);
  assert.equal(parseQrToken('https://medicard.ge/c/K7M2QX'), null, 'a trainer code is not a personal QR');
  assert.equal(parseQrToken('hello'), null);
});

test('avatar photo visibility', () => {
  const base = { viewerId: 'v', targetId: 't' };
  assert.equal(avatarVisible({ ...base, viewerId: 't' }), true, 'self');
  assert.equal(avatarVisible({ ...base, targetIsVerifiedTrainer: true }), true, 'trainer card is public');
  assert.equal(avatarVisible({ ...base, sharedOpenLink: true }), true, 'linked people');
  assert.equal(avatarVisible({ ...base, viewerIsVerifiedTrainer: true, qrMatches: true }), true, 'scan preview');
  assert.equal(avatarVisible({ ...base, viewerIsVerifiedTrainer: true, qrMatches: false }), false, 'trainer without the QR');
  assert.equal(avatarVisible({ ...base, qrMatches: true }), false, 'non-trainer with a QR');
  assert.equal(avatarVisible(base), false, 'stranger');
});
