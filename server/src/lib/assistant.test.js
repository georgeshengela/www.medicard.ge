import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
process.env.DATABASE_URL ||= 'postgresql://unused@127.0.0.1:1/unused';
process.env.JWT_SECRET ||= 'assistant-unit-tests-only-secret';
process.env.EVIDENCEMD_API_KEY ||= 'disabled-unit-test';
const { publicAssistantCatalog, validateAssistantAction, assistantEndpoint, ASSISTANT_DESTINATIONS } = await import('./assistantCatalog.js');
const { loadAssistantContext } = await import('./assistantContext.js');
const { isSilentPcmWav } = await import('./assistantAudio.js');
const { signAssistantPlan, sealAssistantPlan, verifyAssistantPlan, operationBody, executeAssistantPlan } = await import('./assistantExecution.js');
const owner = 'b902294d-67b1-4077-a0d8-c5383c7b18db';
const other = '35aa9131-b3ae-4635-8a2c-0b1ec3b22e77';
const action = { tool: 'hydration_add', args: { date: '2026-09-21', amountMl: 250 } };
test('catalog is strict, scoped, and supplies JSON schemas', () => {
  assert.ok(publicAssistantCatalog('human').length >= 19);
  assert.ok(publicAssistantCatalog('pet').length >= 11);
  for (const t of publicAssistantCatalog('human')) assert.equal(t.parameters.additionalProperties, false);
  assert.throws(() => validateAssistantAction({ tool: '__proto__', args: {} }, 'human'));
  assert.throws(() => validateAssistantAction({ tool: 'pet_add', args: {} }, 'human'));
  assert.throws(() => validateAssistantAction({ tool: 'profile_update', args: { userId: other, extraAnswers: {} } }, 'human'));
  assert.throws(() => validateAssistantAction({ tool: 'open', args: { destination: 'https://attacker.invalid' } }, 'human'));
  assert.ok(Object.values(ASSISTANT_DESTINATIONS).every(r => r.startsWith('/')));
});
test('every native destination resolves to an existing app screen', () => {
  const root = new URL('../../../mobile/app', import.meta.url);
  const screens = fs.readdirSync(root, { recursive: true }).filter(f => f.endsWith('.tsx') && !f.endsWith('_layout.tsx'))
    .map(f => '/' + f.split(path.sep).join('/').replace(/\.tsx$/, '').replace(/\/index$/, '').replace(/\([^/]+\)\//g, ''));
  for (const [name, route] of Object.entries(ASSISTANT_DESTINATIONS)) assert.ok(screens.includes(route.replace(/\([^/]+\)\//g, '')) || (['/chat/doctor', '/chat/consilium'].includes(route) && screens.includes('/chat/[mode]')), `${name}: ${route}`);
});
test('invalid dates, doses and missing goal values require clarification', () => {
  assert.throws(() => validateAssistantAction({ ...action, args: { date: '2026-02-30', amountMl: 250 } }, 'human'));
  assert.throws(() => validateAssistantAction({ tool: 'weight_goal', args: { targetKg: 100 } }, 'human'));
  assert.throws(() => validateAssistantAction({ tool: 'medication_add', args: { medName: 'test', dosage: '10mg', frequency: ['28:61'] } }, 'human'));
  assert.throws(() => validateAssistantAction({ ...action, args: { date: '2026-09-21', amountMl: -100 } }, 'human'));
});
test('action signature binds account, purpose and arguments', () => {
  const p = signAssistantPlan(owner, action, 'human', '2026-09-21');
  const token = sealAssistantPlan(owner, p);
  assert.deepEqual(verifyAssistantPlan(owner, token), p);
  assert.throws(() => verifyAssistantPlan(other, token));
  assert.throws(() => verifyAssistantPlan(owner, token.slice(0, -4) + 'xxxx'));
  assert.equal(operationBody(p).hydrationEvents[0].clientEventId, `medi:${p.id}`);
  assert.equal(assistantEndpoint(action), '/api/health-metrics/sync');
});
test('pet context never queries human tables, regardless of requested domains', async () => {
  const db = new Proxy({ pet: { findMany: async q => { assert.equal(q.where.userId, owner); return []; } } }, {
    get(target, key) { assert.equal(key, 'pet'); return target[key]; },
  });
  const result = await loadAssistantContext({ id: owner }, ['profile', 'metrics', 'cycle', 'records'], 'pet', db);
  assert.equal(result.scope, 'pet'); assert.equal(result.profile, undefined); assert.equal(result.cycle, undefined);
});
test('protected cycle cannot load observations into context', async () => {
  const db = { cycleProfile: { findUnique: async () => ({ privacyEnabled: true }) }, cycleLog: { findMany: () => { throw Error('must not read'); } } };
  const result = await loadAssistantContext({ id: owner }, ['cycle'], 'human', db);
  assert.equal(result.cycle.status, 'withheld'); assert.equal(result.cycle.logs, undefined);
});
test('while the cycle is withheld, the planner gets no earlier consultation that may restate it', async () => {
  const sessions = [
    { id: 'c1', title: 'გასტრიტი', mode: 'DOCTOR', updatedAt: new Date('2026-10-07'), messages: [{ role: 'user', content: 'მუცელი მტკივა' }, { role: 'assistant', content: 'შესაძლოა გასტრიტი.', cycleContext: false }] },
    { id: 'c2', title: 'რატომ?', mode: 'DOCTOR', updatedAt: new Date('2026-10-06'), messages: [{ role: 'user', content: 'რატომ ვარ ასე?' }, { role: 'assistant', content: 'გუშინ ჩაინიშნე გაღიზიანებადობა.', cycleContext: true }] },
    { id: 'c3', title: 'ციკლი', mode: 'DOCTOR', updatedAt: new Date('2026-10-05'), messages: [{ role: 'user', content: 'რა ხდება ჩემს ციკლში?' }, { role: 'assistant', content: 'ოვულაციის ფაზა.' }] },
  ];
  const db = (profile) => ({ cycleProfile: { findUnique: async () => profile }, cycleLog: { findMany: async () => [] },
    chatSession: { findMany: async q => { assert.equal(q.where.userId, owner); return sessions; } } });
  const ids = (result) => result.consultations.map(c => c.id);
  // History questions load consultations together with the cycle (assistantDefaultDomains).
  assert.deepEqual(ids(await loadAssistantContext({ id: owner }, ['consultations', 'cycle'], 'human', db({ privacyEnabled: true }), null, '2026-10-08', { cycleAllowed: true })), ['c1']);
  assert.deepEqual(ids(await loadAssistantContext({ id: owner }, ['consultations', 'cycle'], 'human', db({ mode: 'TRACK_PERIOD' }), null, '2026-10-08', { cycleAllowed: false })), ['c1']);
  assert.deepEqual(ids(await loadAssistantContext({ id: owner }, ['consultations'], 'human', db({ mode: 'TRACK_PERIOD' }), null, '2026-10-08', { cycleAllowed: false })), ['c1']);
  assert.deepEqual(ids(await loadAssistantContext({ id: owner }, ['consultations', 'cycle'], 'human', db({ mode: 'TRACK_PERIOD' }), null, '2026-10-08', { cycleAllowed: true })), ['c1', 'c2', 'c3']);
  const withoutCycleDomain = await loadAssistantContext({ id: owner }, ['consultations'], 'human', db(null), null, '2026-10-08', { cycleAllowed: false });
  assert.deepEqual(ids(withoutCycleDomain), ['c1', 'c2', 'c3']);
  assert.equal('cycle' in withoutCycleDomain, false, 'the status check never adds a cycle block');
  assert.equal(JSON.stringify(withoutCycleDomain.consultations).includes('cycleContext'), false, 'the marker never reaches the model');
});
test('no cycle profile means no cycle block at all (men are not told about a cycle)', async () => {
  const db = { cycleProfile: { findUnique: async () => null }, cycleLog: { findMany: () => { throw Error('must not read'); } } };
  const result = await loadAssistantContext({ id: owner }, ['cycle'], 'human', db);
  assert.equal('cycle' in result, false);
});
test('Medi cycle context never carries BBT, tests, mucus or intimate fields (W3-5)', async () => {
  const row = {
    id: 'l1', userId: owner, date: '2026-08-14', flow: 'light', symptoms: ['bloating', 'unprotected', 'vaginal_dryness', 'discharge'], moods: ['calm'],
    painEntries: [], bbt: 36.73, bbtSource: 'apple_watch_wrist', wristTempDelta: 0.42, ovulationTest: 'positive', pregnancyTest: 'positive',
    cervicalMucus: 'eggwhite', sexualActivity: true, libido: 5, notes: 'zzdiaryzz', customTagIds: ['zztagzz'],
    observations: { ovulationMarked: true, pregnancyChecklist: ['prenatal_vitamin'], energy: 'very_low' },
  };
  const db = {
    cycleProfile: { findUnique: async () => ({ privacyEnabled: false, mode: 'TRY_TO_CONCEIVE', avgCycleLength: 28, avgPeriodLength: 5, lastPeriodStart: '2026-08-01' }) },
    cycleLog: { findMany: async q => { assert.equal(q.where.userId, owner); return [row]; } },
  };
  const result = await loadAssistantContext({ id: owner }, ['cycle'], 'human', db);
  const text = JSON.stringify(result.cycle);
  assert.match(text, /flow=light/);
  assert.match(text, /შებერილობა/);
  for (const leak of [/36\.73/, /0\.42/, /wrist/i, /eggwhite/, /positive/, /\bbbt\b|BBT/i, /ovulationTest|pregnancyTest|cervicalMucus|ovulationMarked|pregnancyChecklist/, /sexualActivity|libido/, /unprotected|vaginal_dryness|discharge/, /prenatal_vitamin|very_low/, /zzdiaryzz|zztagzz/]) {
    assert.doesNotMatch(text, leak);
  }
  const keys = result.cycle.observationKeys.map(k => k.key);
  assert.ok(keys.includes('flow') && keys.includes('cramps'));
  for (const key of ['bbt', 'ovulationTest', 'pregnancyTest', 'cervicalMucus', 'ovulationMarked', 'sexualActivity', 'libido', 'notes', 'discharge', 'pregnancyChecklist']) assert.equal(keys.includes(key), false, key);
});
test('digital silence is detected before generative transcription, speech is not discarded', () => {
  const b = Buffer.alloc(46); b.write('RIFF'); b.writeUInt32LE(38, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(2, 40);
  assert.equal(isSilentPcmWav(b), true);
  b.writeInt16LE(3, 44); assert.equal(isSilentPcmWav(b), false);
  assert.equal(isSilentPcmWav(Buffer.from('not audio')), false);
  b.writeUInt32LE(5000, 40); assert.equal(isSilentPcmWav(b), false);
});
function receiptDb() {
  const rows = new Map();
  return {
    rows,
    async $executeRaw(strings, ...v) {
      const sql = strings.join('?');
      if (sql.startsWith('INSERT')) {
        if (rows.has(v[0])) return 0;
        rows.set(v[0], { userId: v[1], payloadHash: v[3], status: 'RUNNING' }); return 1;
      }
      if (sql.includes("'DONE'")) rows.get(v[0]).status = 'DONE';
      else rows.get(v[1]).status = v[0];
      return 1;
    },
    async $queryRaw(_s, operationId, userId) { const row = rows.get(operationId); return row?.userId === userId ? [row] : []; },
  };
}
test('same action is dispatched once, including concurrent retries', async () => {
  const db = receiptDb(), p = signAssistantPlan(owner, action, 'human', '2026-09-21'); let calls = 0;
  const dispatch = async () => { calls++; await new Promise(r => setTimeout(r, 10)); };
  const results = await Promise.allSettled([executeAssistantPlan(p, { userId: owner }, db, dispatch), executeAssistantPlan(p, { userId: owner }, db, dispatch)]);
  assert.equal(calls, 1); assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await executeAssistantPlan(p, { userId: owner }, db, dispatch)).replayed, true);
  assert.equal(calls, 1);
});
test('transport failure never blindly replays a potentially saved record', async () => {
  const db = receiptDb(), p = signAssistantPlan(owner, action, 'human', '2026-09-21'); let calls = 0;
  const dispatch = async () => { calls++; throw Error('connection lost'); };
  await assert.rejects(executeAssistantPlan(p, { userId: owner }, db, dispatch), e => e.code === 'ASSISTANT_UNCERTAIN');
  await assert.rejects(executeAssistantPlan(p, { userId: owner }, db, dispatch), e => e.code === 'ASSISTANT_UNCERTAIN');
  assert.equal(calls, 1);
});
