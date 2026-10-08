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

test('a Medi clinical answer receives saved cycle symptoms, refreshed for every turn', async t => {
  // Synthetic fixture, no connection or writes. Exercise the actual clinical prompt assembly.
  let symptoms = ['headache', 'bloating'];
  const owner = 'fixture-account';
  const fixtures = [
    [prisma.healthProfile, 'findUnique', async () => null],
    [prisma.healthMetricDaily, 'findMany', async () => []],
    [prisma.medicationSchedule, 'findMany', async () => []],
    [prisma.cycleProfile, 'findUnique', async q => { assert.equal(q.where.userId, owner); return { mode: 'TRACK_PERIOD', privacyEnabled: false }; }],
    [prisma.cycleLog, 'findMany', async q => { assert.equal(q.where.userId, owner); return [{ date: '2026-10-08', symptoms, moods: [], painEntries: [] }]; }],
  ];
  for (const [delegate, method, implementation] of fixtures) {
    const original = delegate[method]; delegate[method] = implementation;
    t.after(() => { delegate[method] = original; });
  }
  const context = await withPatientAiContext({ id: owner }, undefined, { includeCycle: true, today: '2026-10-08' });
  const messages = buildClinicalMessages({ mode: 'DOCTOR', context, messages: [{ role: 'user', content: 'გადახედე ჩემს ჩანიშნულ სიმპტომებს' }] });
  assert.match(messages[1].content, /თავის ტკივილი/);
  assert.match(messages[1].content, /შებერილობა/);
  assert.match(messages[1].content, /2026-10-08/);
  symptoms = ['fatigue'];
  const fresh = await withPatientAiContext({ id: owner }, undefined, { includeCycle: true, today: '2026-10-08' });
  assert.match(fresh, /დაღლილობა/);
  assert.doesNotMatch(fresh, /შებერილობა/);
});
