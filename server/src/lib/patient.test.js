import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPatientProfile, withPatientAiContext } from './patient.js';
import { prisma } from './prisma.js';
import { buildClinicalMessages } from './clinicalMessages.js';

test('profile block is the account holder, not the person in this message', () => {
  const block = buildPatientProfile({
    fullName: 'გიორგი ბერიძე',
    gender: 'MALE',
    birthDate: '1996-01-15',
  });
  assert.match(block, /ანგარიშის მფლობელის პროფილი/);
  assert.doesNotMatch(block, /გიორგი|ბერიძე|1996-01-15/);
  assert.match(block, /ასაკი:/);
  assert.match(block, /ბავშვზე, შვილზე/);
  assert.doesNotMatch(block, /პაციენტის სქესი და ასაკი ნორმის საზღვრების/);
});

function stubPrisma(t, data) {
  const owner = data.owner;
  const fixtures = [
    [prisma.healthProfile, 'findUnique', async q => { assert.equal(q.where.userId, owner); return data.healthProfile ?? null; }],
    [prisma.healthMetricDaily, 'findMany', async q => { assert.equal(q.where.userId, owner); return []; }],
    [prisma.medicationSchedule, 'findMany', async q => { assert.equal(q.where.userId, owner); return data.meds ?? []; }],
    [prisma.cycleProfile, 'findUnique', async q => { assert.equal(q.where.userId, owner); return data.cycleProfile ?? null; }],
    [prisma.cycleLog, 'findMany', async q => { assert.equal(q.where.userId, owner); data.cycleReads = (data.cycleReads ?? 0) + 1; return data.cycleLogs(); }],
    [prisma.medicalRecord, 'findMany', async q => { assert.equal(q.where.userId, owner); return q.where.type === 'LAB' ? (data.labIds ?? []) : (data.records ?? []); }],
    [prisma.doctorVisit, 'findMany', async q => { assert.equal(q.where.userId, owner); return data.visits ?? []; }],
  ];
  for (const [delegate, method, implementation] of fixtures) {
    const original = delegate[method]; delegate[method] = implementation;
    t.after(() => { delegate[method] = original; });
  }
}

test('Medi\'s clinical answer receives the saved diary, checks, labs, visits and this chat — re-read every turn', async t => {
  // Synthetic fixture, no connection or writes. Exercises the real clinical prompt assembly (2026-10-08 incident).
  let symptoms = ['headache', 'bloating'];
  const data = {
    owner: 'fixture-account',
    cycleProfile: { mode: 'TRACK_PERIOD', privacyEnabled: false },
    cycleLogs: () => [{ date: '2026-10-08', symptoms, moods: [], painEntries: [] }],
    records: [{ type: 'SYMPTOM', createdAt: new Date('2026-10-01T09:00:00Z'), aiAnalysis: '## სიმპტომების შემოწმება\n\n**სიმპტომები:** ხველა, ცხელება\n**შეფასება:** ექიმთან 24 საათში' }],
    healthProfile: { extraAnswers: { labPanels: [
      { id: 'p1', date: '2026-09-01', recordIds: ['r1'], parameters: [{ key: 'hgb', nameKa: 'ჰემოგლობინი', value: 98, display: '98', unit: 'g/L', refLow: 120, refHigh: 160, flag: 'L' }] },
      { id: 'p2', date: '2026-08-01', recordIds: ['gone'], parameters: [{ key: 'tsh', nameKa: 'TSH', value: 9, display: '9', unit: 'mIU/L', flag: 'H' }] },
    ] } },
    labIds: [{ id: 'r1' }],
    visits: [{ doctorType: 'GYN', visitDate: '2026-10-12', visitTime: '10:30' }],
  };
  stubPrisma(t, data);
  const options = { full: true, cycleAllowed: true, today: '2026-10-08',
    thread: [{ role: 'user', content: 'დღეს ციკლი ჩავინიშნე' }, { role: 'assistant', content: 'შენახულია.' }, { role: 'user', content: 'უკვე სესიაშია' }],
    priorTurns: [{ role: 'user', content: 'უკვე სესიაშია' }] };
  const context = await withPatientAiContext({ id: data.owner }, undefined, options);
  const messages = buildClinicalMessages({ mode: 'DOCTOR', context, messages: [{ role: 'user', content: 'სიმპტომებზე დაყრდნობით მიპასუხე' }] });
  const block = messages[1].content;
  for (const expected of [/თავის ტკივილი/, /შებერილობა/, /2026-10-08.*← დღეს/, /ხველა, ცხელება/, /2026-10-01 · სიმპტომების შემოწმება/,
    /ჰემოგლობინი: 98 g\/L \(ნორმა 120–160\) ↓ ნორმაზე დაბალი · 2026-09-01/, /2026-10-12 10:30 · გინეკოლოგი/, /დღეს ციკლი ჩავინიშნე/]) {
    assert.match(block, expected);
  }
  assert.doesNotMatch(block, /TSH/, 'a panel from a deleted upload never reaches Medi');
  assert.doesNotMatch(block, /უკვე სესიაშია/, 'turns the clinical session already holds are not repeated');
  symptoms = ['fatigue'];
  const fresh = await withPatientAiContext({ id: data.owner }, undefined, options);
  assert.match(fresh, /დაღლილობა/);
  assert.doesNotMatch(fresh, /შებერილობა/);
});

test('without the client\'s yes the diary is not read; a man gets no cycle block; other AI callers stay small', async t => {
  const data = { owner: 'fixture-account', cycleProfile: { mode: 'TRACK_PERIOD' }, cycleLogs: () => [{ date: '2026-10-08', symptoms: ['headache'] }] };
  stubPrisma(t, data);
  const withheld = await withPatientAiContext({ id: data.owner }, undefined, { full: true, today: '2026-10-08' });
  assert.equal(data.cycleReads ?? 0, 0);
  assert.match(withheld, /withheld/); assert.doesNotMatch(withheld, /თავის ტკივილი/);
  data.cycleProfile = null;
  const man = await withPatientAiContext({ id: data.owner, gender: 'MALE' }, undefined, { full: true, cycleAllowed: true, today: '2026-10-08' });
  assert.doesNotMatch(man || '', /ციკლ|cycle/i);
  data.cycleProfile = { mode: 'TRACK_PERIOD' };
  const small = await withPatientAiContext({ id: data.owner });
  assert.match(small, /ციკლის რეჟიმი: TRACK_PERIOD/); assert.equal(data.cycleReads ?? 0, 0);
});
