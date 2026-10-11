import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedPoller, FEED_SOURCES, loadFeed, shapeFeed } from './adminFeed.js';
import { adminFeedStatements } from '../../scripts/install-admin-feed.mjs';

const people = [
  { id: 'u1', fullName: 'Nino', email: '995599123456@phone.medicard.ge', phone: null },
  { id: 'demo', fullName: 'Demo', email: 'demo@medicard.ge', phone: null },
];

test('events: person, words, link; newest first', () => {
  const out = shapeFeed([
    { source: 'pet', row: { id: 'p1', userId: 'u1', at: '2026-10-11T08:00:00Z', name: 'ლუნა', speciesId: 'dog' } },
    { source: 'medication', row: { id: 'm1', userId: 'u1', at: '2026-10-11T09:00:00Z' } },
    { source: 'meal', row: { id: 'f1', userId: 'demo', at: '2026-10-11T07:00:00Z', source: 'photo' } },
  ], people);
  assert.deepEqual(out.map((e) => e.id), ['medication:m1', 'pet:p1', 'meal:f1']);
  assert.equal(out[0].text, 'დაამატა წამალი');
  assert.equal(out[0].meta, '');
  assert.equal(out[1].meta, 'ძაღლი · ლუნა');
  assert.deepEqual(out[1].user, { id: 'u1', name: 'Nino', contact: '+995 599 12 34 56', team: false });
  assert.equal(out[1].href, '#/pets?focus=p1', 'opens that pet card on MEDIVET');
  assert.equal(out[0].href, '#/pills?focus=u1');
  assert.equal(out[2].user.team, true);
  assert.equal(out[2].meta, 'ფოტოთი');
});

test('MEDICYCLE stays anonymous: no person, hashed id, imported temperature is not a log', () => {
  const out = shapeFeed([
    { source: 'cycle', row: { id: 'c-1', userId: 'u1', at: '2026-10-11T08:00:00Z', flow: 'LIGHT', symptoms: [], moods: [] } },
    { source: 'cycle', row: { id: 'c-2', userId: 'u1', at: '2026-10-11T08:01:00Z', bbt: 36.5, observations: { bbtSource: 'health' }, symptoms: [], moods: [] } },
    { source: 'mediAction', row: { id: 'a1', userId: 'u1', at: '2026-10-11T08:02:00Z', tool: 'period_record' } },
  ], people);
  assert.equal(out.length, 1, 'the Medi-saved cycle entry is not a second event');
  for (const e of out) {
    assert.equal(e.user, null);
    assert.equal(e.who, null);
    assert.equal(e.href, '#/cycle');
    assert.ok(!JSON.stringify(e).includes('u1'));
  }
  assert.match(out.find((e) => e.text === 'ვიღაცამ ჩაწერა ციკლის დღე').id, /^cycle:[0-9a-f]{12}$/);
});

test('saved through Medi and in its module: one event marked „Medi-თ“', () => {
  const out = shapeFeed([
    { source: 'medication', row: { id: 'm1', userId: 'u1', at: '2026-10-11T08:16:10Z' } },
    { source: 'mediAction', row: { id: 'a1', userId: 'u1', at: '2026-10-11T08:16:05Z', tool: 'medication_add' } },
    { source: 'mediAction', row: { id: 'a2', userId: 'u1', at: '2026-10-11T09:00:00Z', tool: 'hydration_add' } },
  ], people);
  assert.deepEqual(out.map((e) => [e.id, e.text, e.meta]), [
    ['mediAction:a2', 'Medi-თ ჩაწერა წყალი', ''],
    ['medication:m1', 'დაამატა წამალი', 'Medi-თ'],
  ]);
  assert.ok(out.every((e) => !('viaMedi' in e)));
});

test('attention events: a letter from someone without an account, a prize, a report', () => {
  const out = shapeFeed([
    { source: 'support', row: { id: 's1', userId: null, at: '2026-10-11T08:00:00Z', counterpartName: 'Tasso' } },
    { source: 'claim', row: { id: 'k1', userId: 'u1', at: '2026-10-11T08:01:00Z', kind: 'PHYSICAL', title: 'iPhone' } },
    { source: 'communityReport', row: { id: 'r1', userId: 'u1', at: '2026-10-11T08:02:00Z' } },
    { source: 'medi', row: { id: 'i1', userId: 'u1', at: '2026-10-11T08:03:00Z', mode: 'DOCTOR', status: 'ERROR' } },
  ], people);
  assert.ok(out.every((e) => e.attention));
  const letter = out.find((e) => e.module === 'support');
  assert.equal(letter.user, null);
  assert.equal(letter.who, 'Tasso');
  assert.equal(letter.href, '#/support?tab=inbox&thread=s1');
  assert.equal(out.find((e) => e.module === 'run').href, '#/medipulsi?tab=claims&focus=k1');
  assert.equal(out.find((e) => e.module === 'medi').href, '#/ai?pane=quality&focus=i1');
});

test('a coin box opening is paid on the spot: no attention, says what it was', () => {
  const [e] = shapeFeed([
    { source: 'claim', row: { id: 'k2', userId: 'u1', at: '2026-10-11T04:10:59Z', status: 'APPROVED', kind: 'DIGITAL', coins: '50', starter: 'true' } },
  ], people);
  assert.equal(e.attention, false);
  assert.equal(e.text, 'გახსნა MEDIRUN-ის ყუთი');
  assert.equal(e.meta, 'სასტარტო ყუთი · 50 Medi Coins');
});

test('no health values or free text leave the feed', () => {
  const out = shapeFeed([
    { source: 'dose', row: { id: 'd1', userId: 'u1', at: '2026-10-11T08:00:00Z', source: 'notification', medName: 'Secret', status: 'skipped' } },
    { source: 'record', row: { id: 'r1', userId: 'u1', at: '2026-10-11T08:00:00Z', type: 'LAB', aiAnalysis: 'Hb 12' } },
  ], people);
  const text = JSON.stringify(out);
  assert.ok(!/Secret|skipped|Hb 12/.test(text));
  assert.equal(out.find((e) => e.id === 'dose:d1').meta, 'შეხსენებიდან');
});

test('loadFeed asks every source with the time window and skips tables that do not exist', async () => {
  const calls = [];
  const db = {
    $queryRawUnsafe: async (sql, ...args) => {
      calls.push({ sql, args });
      if (sql.includes('"CommunityReport"')) throw new Error('relation "CommunityReport" does not exist');
      if (sql.includes('FROM "Pet"')) return [{ id: 'p1', userId: 'u1', at: new Date('2026-10-11T08:00:00Z'), name: 'ლუნა', speciesId: 'cat' }];
      return [];
    },
    user: { findMany: async () => people },
  };
  const out = await loadFeed({ after: '2026-10-11T07:00:00Z', limit: 10, db });
  assert.equal(calls.length, FEED_SOURCES.length);
  assert.ok(calls.every((c) => c.args.length === 1 && c.sql.includes('> $1') && /LIMIT 10$/.test(c.sql)));
  assert.equal(out.length, 1);
  assert.equal(out[0].meta, 'კატა · ლუნა');
});

test('poller: the first poll only sets the cursor; later polls send each event once', async () => {
  let t = 1_000_000;
  let rows = [{ id: 'a', at: '2026-10-11T08:00:00Z' }];
  const sent = [];
  const asked = [];
  const poller = createFeedPoller({ load: async (q) => { asked.push(q.after); return rows; }, emit: (e) => sent.push(...e.map((x) => x.id)), now: () => t });
  assert.deepEqual(await poller.poll(), []);
  assert.equal(asked.length, 0);
  t += 4000;
  await poller.poll();
  assert.deepEqual(sent, ['a']);
  t += 4000;
  rows = [{ id: 'b', at: '2026-10-11T08:00:05Z' }, { id: 'a', at: '2026-10-11T08:00:00Z' }];
  await poller.poll();
  assert.deepEqual(sent, ['a', 'b']);
  assert.ok(asked.at(-1).getTime() < t - 4000, 'looks back past the cursor');
  poller.reset();
  assert.deepEqual(await poller.poll(), []);
});

test('install script only creates feed indexes', () => {
  assert.equal(adminFeedStatements('CREATE INDEX IF NOT EXISTS "Pet_createdAt_feed_idx" ON "Pet" ("createdAt");').length, 1);
  assert.throws(() => adminFeedStatements('DROP INDEX "Pet_createdAt_feed_idx";'));
});

// MEDISLEEP tests ride here: the server `npm test` command line is at the Windows length limit.
import './sleep.test.js';
import './adminUsageSleep.test.js';
