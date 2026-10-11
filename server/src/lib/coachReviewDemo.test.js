import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_DEMO_DEFAULT_CODE, ensureReviewDemoSlots, planReviewDemoSlots, reviewDemoCode } from './coachReviewDemo.js';

const open = (id, iso, extra = {}) => ({ id, status: 'OPEN', clientId: null, startsAt: new Date(iso), durationMin: 60, ...extra });
const iso = (d) => d.toISOString();

// The production state on 2026-10-11: the three seeded slots all expired.
const SEEDED = [open('a', '2026-09-29T06:00:00Z'), open('b', '2026-09-30T06:00:00Z'), open('c', '2026-10-02T06:00:00Z')];

test('review demo: expired seed slots roll forward to 10:00 Tbilisi on the coming days, no new rows', () => {
  const plan = planReviewDemoSlots(SEEDED, new Date('2026-10-11T10:00:00Z'));
  assert.equal(plan.fresh, 0);
  assert.deepEqual(plan.inserts, []);
  assert.deepEqual(plan.moves.map((m) => [m.id, iso(m.startsAt)]), [
    ['a', '2026-10-12T06:00:00.000Z'],
    ['b', '2026-10-13T06:00:00.000Z'],
    ['c', '2026-10-14T06:00:00.000Z'],
  ]);
});

test('review demo: three bookable open slots ahead means nothing to do', () => {
  const now = new Date('2026-10-11T10:00:00Z');
  const rows = [...SEEDED, open('d', '2026-10-12T06:00:00Z'), open('e', '2026-10-13T06:00:00Z'), open('f', '2026-10-20T06:00:00Z')];
  assert.deepEqual(planReviewDemoSlots(rows, now), { fresh: 3, moves: [], inserts: [] });
});

test('review demo: a booked slot frees its place; a slot starting within 3 h is neither counted nor moved', () => {
  const now = new Date('2026-10-12T04:00:00Z'); // 08:00 Tbilisi
  const rows = [
    open('soon', '2026-10-12T06:00:00Z'), // 10:00 today: still bookable, but too close to count
    { id: 'booked', status: 'SCHEDULED', clientId: 'reviewer', startsAt: new Date('2026-10-13T06:00:00Z'), durationMin: 60 },
    open('next', '2026-10-14T06:00:00Z'),
    open('old', '2026-10-01T06:00:00Z'),
  ];
  const plan = planReviewDemoSlots(rows, now);
  assert.equal(plan.fresh, 1);
  assert.deepEqual(plan.moves.map((m) => [m.id, iso(m.startsAt)]), [['old', '2026-10-15T06:00:00.000Z']]);
  assert.deepEqual(plan.inserts.map((n) => iso(n.startsAt)), ['2026-10-16T06:00:00.000Z']);
});

test('review demo: early morning uses today 10:00; a trainer with no rows gets three new slots', () => {
  const plan = planReviewDemoSlots([], new Date('2026-10-11T02:00:00Z')); // 06:00 Tbilisi
  assert.deepEqual(plan.moves, []);
  assert.deepEqual(plan.inserts.map((n) => [iso(n.startsAt), n.kind]), [
    ['2026-10-11T06:00:00.000Z', 'FUNCTIONAL'],
    ['2026-10-12T06:00:00.000Z', 'CARDIO'],
    ['2026-10-13T06:00:00.000Z', 'STRENGTH'],
  ]);
});

test('review demo: never moves a booked or cancelled session', () => {
  const rows = [
    { id: 'done', status: 'DONE', clientId: 'x', startsAt: new Date('2026-10-01T06:00:00Z'), durationMin: 60 },
    { id: 'past-booked', status: 'SCHEDULED', clientId: 'x', startsAt: new Date('2026-10-02T06:00:00Z'), durationMin: 60 },
    { id: 'cancelled', status: 'CANCELLED', clientId: null, startsAt: new Date('2026-10-03T06:00:00Z'), durationMin: 60 },
  ];
  const plan = planReviewDemoSlots(rows, new Date('2026-10-11T10:00:00Z'));
  assert.deepEqual(plan.moves, []);
  assert.equal(plan.inserts.length, 3);
});

test('review demo: code from env, default QSPW7W, off disables', () => {
  assert.equal(reviewDemoCode({}), REVIEW_DEMO_DEFAULT_CODE);
  assert.equal(reviewDemoCode({ APP_REVIEW_TRAINER_CODE: ' qspw7w ' }), 'QSPW7W');
  assert.equal(reviewDemoCode({ APP_REVIEW_TRAINER_CODE: 'off' }), null);
  assert.equal(reviewDemoCode({ APP_REVIEW_TRAINER_CODE: 'nope' }), null);
});

function fakeDb({ email, sessions = SEEDED }) {
  const writes = [];
  const sql = (strings) => strings.join('?');
  return {
    writes,
    async $queryRaw(strings, ...values) {
      const text = sql(strings);
      if (text.includes('to_regclass')) return [{ ok: true }];
      if (text.includes('FROM "TrainerProfile"')) return email ? [{ userId: 'demo', gymIds: ['gym-aspria'], email }] : [];
      if (text.includes('FROM "TrainerSession"')) {
        assert.equal(values[0], 'demo');
        return sessions;
      }
      throw new Error(`unexpected query ${text}`);
    },
    async $executeRaw(strings, ...values) {
      writes.push({ text: sql(strings), values });
      return 1;
    },
  };
}

test('review demo: writes only for a team @medicard.ge account, and only that trainer\'s expired open rows', async () => {
  const now = new Date('2026-10-11T10:00:00Z');
  const outsider = fakeDb({ email: 'coach@gmail.com' });
  assert.deepEqual(await ensureReviewDemoSlots({ db: outsider, now, code: 'QSPW7W' }), { skipped: 'no-demo-trainer' });
  assert.equal(outsider.writes.length, 0);

  const dry = fakeDb({ email: 'demo.trainer@medicard.ge' });
  const plan = await ensureReviewDemoSlots({ db: dry, now, code: 'QSPW7W', dryRun: true });
  assert.equal(plan.moves.length, 3);
  assert.equal(dry.writes.length, 0);

  const team = fakeDb({ email: 'demo.trainer@MEDICARD.ge' });
  assert.deepEqual(await ensureReviewDemoSlots({ db: team, now, code: 'QSPW7W' }), { fresh: 0, moved: 3, created: 0 });
  assert.equal(team.writes.length, 3);
  for (const w of team.writes) {
    assert.match(w.text, /^UPDATE "TrainerSession"/);
    assert.match(w.text, /"trainerId" = \? AND status = 'OPEN' AND "clientId" IS NULL AND "startsAt" <= \?/);
    assert.ok(w.values.includes('demo'));
  }

  assert.deepEqual(await ensureReviewDemoSlots({ db: fakeDb({ email: 'x@medicard.ge' }), now, code: null }), { skipped: 'off' });
});
