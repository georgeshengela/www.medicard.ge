import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCycleAccountContext, cycleAccountContextText } from './cycleAccountContext.js';

const owner = 'synthetic-owner', today = '2026-10-08';
function fixture(profile = { mode: 'TRACK_PERIOD' }, logs = []) {
  let reads = 0;
  const db = {
    cycleProfile: { findUnique: async q => { assert.equal(q.where.userId, owner); return profile; } },
    cycleLog: { findMany: async q => { reads++; assert.equal(q.where.userId, owner); assert.equal(q.where.date.lte, today); assert.equal(q.take, 45); assert.deepEqual(q.orderBy, { date: 'desc' }); assert.equal(q.select.notes, undefined); return logs; } },
  };
  return { db, reads: () => reads };
}

test('missing permission stops before all cycle queries; profile privacy and masking stop log reads', async () => {
  const denied = await loadCycleAccountContext(owner, {}, { today, allowed: false });
  assert.equal(denied.status, 'withheld');
  for (const profile of [{ privacyEnabled: true, mode: 'PREGNANCY' }, { reminderPrefs: { maskNotifications: true }, mode: 'TRY_TO_CONCEIVE' }]) {
    const f = fixture(profile);
    const ctx = await loadCycleAccountContext(owner, f.db, { today });
    assert.equal(f.reads(), 0); assert.equal(ctx.status, 'withheld');
    assert.equal(ctx.profile, undefined); assert.equal(ctx.logs, undefined);
  }
});

test('no profile, empty diary and failed reads are distinct states, not evidence of no symptoms', async () => {
  assert.equal((await loadCycleAccountContext(owner, fixture(null).db, { today })).status, 'not_configured');
  const empty = await loadCycleAccountContext(owner, fixture().db, { today });
  assert.equal(empty.status, 'available'); assert.deepEqual(empty.logs, []);
  const broken = { cycleProfile: { findUnique: async () => { throw Error('offline'); } } };
  const unavailable = await loadCycleAccountContext(owner, broken, { today });
  assert.equal(unavailable.status, 'unavailable'); assert.equal(unavailable.logs, undefined);
});

test('dated regular symptoms reach Medi while private values and even excluded-field markers do not', async () => {
  const f = fixture({ mode: 'TRACK_PERIOD' }, [{ date: today, flow: null,
    symptoms: ['fatigue', 'bloating', 'unprotected', 'unknown_private'], moods: ['calm'], painEntries: [],
    notes: 'PRIVATE_NOTE_SENTINEL', bbt: 36.77, pregnancyTest: 'positive', sexualActivity: true, observations: { ovulationMarked: true } }]);
  const ctx = await loadCycleAccountContext(owner, f.db, { today });
  const text = cycleAccountContextText(ctx);
  assert.match(text, /დაღლილობა/); assert.match(text, /შებერილობა/); assert.match(text, /2026-10-08/);
  assert.match(text, /flow=not_recorded/); assert.doesNotMatch(text, /flow=none/);
  assert.doesNotMatch(text, /PRIVATE_NOTE|unknown_private|unprotected|36\.77|positive|sexualActivity|ovulationMarked|excluded|SEXUAL_HEALTH/);
});

test('bounded clinical context preserves newest entries and declares omitted history', () => {
  const text = cycleAccountContextText({ status: 'available', logs: Array.from({ length: 45 }, (_, i) => ({ line: `day-${i} ` + 'x'.repeat(150) })) }, 600);
  assert.match(text, /day-0/); assert.doesNotMatch(text, /day-44/); assert.match(text, /omitted, not absent/);
  assert.ok(text.length <= 600);
});
