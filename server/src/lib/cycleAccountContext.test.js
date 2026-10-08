import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCycleAccountContext, cycleAccountContextText, MEDI_RECORD_CONTEXT_RULES } from './cycleAccountContext.js';

const owner = 'synthetic-owner', today = '2026-10-08';
function fixture(profile = { mode: 'TRACK_PERIOD' }, logs = []) {
  let reads = 0;
  const db = {
    cycleProfile: { findUnique: async q => { assert.equal(q.where.userId, owner); return profile; } },
    cycleLog: { findMany: async q => {
      reads++;
      assert.equal(q.where.userId, owner); assert.equal(q.where.date.lte, today); assert.equal(q.take, 45);
      assert.deepEqual(q.orderBy, { date: 'desc' });
      // Only the serializer's own fields are selected — never notes, BBT, tests, sex or the observations bag.
      assert.deepEqual(Object.keys(q.select).sort(), ['date', 'flow', 'moods', 'painEntries', 'sleepQuality', 'stressLevel', 'symptoms']);
      return logs;
    } },
  };
  return { db, reads: () => reads };
}

test('a device without the explicit yes, profile privacy and masked notifications never read the diary', async () => {
  const device = fixture();
  const denied = await loadCycleAccountContext(owner, device.db, { today, allowed: false });
  assert.equal(denied.status, 'withheld'); assert.equal(denied.reason, 'device'); assert.equal(device.reads(), 0);
  for (const [profile, reason] of [[{ privacyEnabled: true, mode: 'PREGNANCY' }, 'privacy'], [{ reminderPrefs: { maskNotifications: true }, mode: 'TRY_TO_CONCEIVE' }, 'device']]) {
    const f = fixture(profile);
    const ctx = await loadCycleAccountContext(owner, f.db, { today });
    assert.equal(f.reads(), 0); assert.equal(ctx.status, 'withheld'); assert.equal(ctx.reason, reason);
    assert.equal(ctx.profile, undefined); assert.equal(ctx.logs, undefined);
    const text = cycleAccountContextText(ctx);
    assert.doesNotMatch(text, /PREGNANCY|TRY_TO_CONCEIVE/);
    assert.match(text, /never say the diary is empty|entries may exist/);
  }
});

test('no profile = no block; empty diary and failed reads are distinct and never „no symptoms“', async () => {
  assert.equal(await loadCycleAccountContext(owner, fixture(null).db, { today }), null);
  assert.equal(await loadCycleAccountContext(owner, fixture(null).db, { today, allowed: false }), null);
  assert.equal(cycleAccountContextText(null), null);
  const empty = await loadCycleAccountContext(owner, fixture().db, { today });
  assert.equal(empty.status, 'available'); assert.deepEqual(empty.logs, []);
  assert.match(cycleAccountContextText(empty), /შენახული დღიური ჩანაწერი არ არის/);
  const broken = { cycleProfile: { findUnique: async () => { throw Error('offline'); } } };
  const unavailable = await loadCycleAccountContext(owner, broken, { today });
  assert.equal(unavailable.status, 'unavailable'); assert.equal(unavailable.logs, undefined);
  const brokenLogs = { cycleProfile: { findUnique: async () => ({ mode: 'TRACK_PERIOD' }) }, cycleLog: { findMany: async () => { throw Error('timeout'); } } };
  assert.equal((await loadCycleAccountContext(owner, brokenLogs, { today })).status, 'unavailable');
});

test('today\'s logged symptoms reach Medi in Georgian with their date; private values do not', async () => {
  const f = fixture({ mode: 'TRACK_PERIOD', avgCycleLength: 29, lastPeriodStart: new Date('2026-09-20T00:00:00Z'), conditions: ['pcos'] }, [
    { date: today, flow: null, symptoms: ['dizziness', 'bloating', 'unprotected', 'unknown_private'], moods: ['tired_mood'], painEntries: [{ type: 'cramps', severity: 'moderate' }],
      notes: 'PRIVATE_NOTE_SENTINEL', bbt: 36.77, pregnancyTest: 'positive', sexualActivity: true, observations: { ovulationMarked: true } },
    { date: '2026-10-05', flow: 'none', symptoms: ['headache'], moods: [], painEntries: [] },
  ]);
  const ctx = await loadCycleAccountContext(owner, f.db, { today });
  const text = cycleAccountContextText(ctx);
  assert.match(text, /თავბრუსხვევა/); assert.match(text, /შებერილობა/); assert.match(text, /დაღლილი/); assert.match(text, /cramps:moderate/);
  assert.match(text, /2026-10-08: flow=not_recorded.*← დღეს/); assert.match(text, /2026-10-05: flow=none; სიმპტომები=თავის ტკივილი/);
  assert.match(text, /ბოლო მენსტრუაციის დაწყება 2026-09-20/); assert.match(text, /pcos/);
  assert.doesNotMatch(text, /PRIVATE_NOTE|unknown_private|unprotected|36\.77|positive|sexualActivity|ovulationMarked|excluded|SEXUAL_HEALTH/);
});

test('the bounded block keeps the newest days and says older ones were omitted, not absent', () => {
  const ctx = { status: 'available', asOf: today, profile: {}, instruction: 'x', logs: Array.from({ length: 45 }, (_, i) => ({ date: `d${i}`, line: `day-${i} ` + 'x'.repeat(150) })) };
  const text = cycleAccountContextText(ctx, 900);
  assert.match(text, /day-0/); assert.doesNotMatch(text, /day-44/); assert.match(text, /omitted, not absent/);
  assert.ok(text.length <= 900);
});

test('the shared rules forbid „no symptoms“ when entries are saved', () => {
  assert.match(MEDI_RECORD_CONTEXT_RULES, /never ask the person to type in again what is already saved/);
  assert.match(MEDI_RECORD_CONTEXT_RULES, /სიმპტომები არ ჩანს/);
});
