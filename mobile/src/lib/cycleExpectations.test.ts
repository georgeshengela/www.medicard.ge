import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bundlePeriodStarts,
  cycleExpectations,
  expectationLine,
  expectationsFromBundle,
  expectedIds,
  observationKeys,
} from './cycleExpectations.ts';

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

// Four starts = three completed 28-day cycles + the current one; today = cycle day 26.
const starts = ['2026-06-16', '2026-07-14', '2026-08-11', '2026-09-08'];
const today = addDays('2026-09-08', 25);

function log(date: string, fields: Partial<{ symptoms: string[]; moods: string[]; painEntries: { type: string }[] }>) {
  return { date, symptoms: [], moods: [], painEntries: [], ...fields };
}

test('an observation logged on the same cycle day ± 1 in 2 of the last 3 cycles is expected; 1 of 3 is not', () => {
  const logs = [
    log(addDays(starts[0], 24), { painEntries: [{ type: 'cramps' }], symptoms: ['bloating'] }), // day 25
    log(addDays(starts[1], 26), { painEntries: [{ type: 'cramps' }] }), // day 27
    log(addDays(starts[2], 25), { symptoms: ['acne'], moods: ['irritable'] }), // day 26
    log(addDays(starts[1], 25), { moods: ['irritable'] }),
  ];
  const out = cycleExpectations({ logs, periodStarts: starts, date: today });
  assert.deepEqual(
    out.map((e) => [e.kind, e.id, e.cyclesSeen, e.of]),
    [
      ['pain', 'cramps', 2, 3],
      ['mood', 'irritable', 2, 3],
    ],
  );
  assert.equal(out[0].label, 'სპაზმები');
});

test('day tolerance is exactly one: day 24 and day 28 do not count towards day 26', () => {
  const logs = [
    log(addDays(starts[0], 23), { symptoms: ['bloating'] }), // day 24
    log(addDays(starts[1], 27), { symptoms: ['bloating'] }), // day 28 (= next start - 1 for a 28-day cycle)
    log(addDays(starts[2], 24), { symptoms: ['bloating'] }), // day 25 ✓ — only one cycle
  ];
  assert.deepEqual(cycleExpectations({ logs, periodStarts: starts, date: today }), []);
});

test('fewer than three completed cycles → nothing, however strong the pattern', () => {
  const logs = [log(addDays(starts[1], 25), { symptoms: ['bloating'] }), log(addDays(starts[2], 25), { symptoms: ['bloating'] })];
  assert.deepEqual(cycleExpectations({ logs, periodStarts: starts.slice(1), date: today }), []);
  // The same logs with a third completed cycle in front do qualify.
  assert.equal(cycleExpectations({ logs, periodStarts: starts, date: today }).length, 1);
});

test('only the last three completed cycles are read; older ones neither add nor block', () => {
  const older = ['2026-03-24', '2026-04-21', '2026-05-19'];
  const all = [...older, ...starts];
  const logs = [
    log(addDays(older[0], 25), { symptoms: ['nausea'] }),
    log(addDays(older[1], 25), { symptoms: ['nausea'] }),
    log(addDays(older[2], 25), { symptoms: ['nausea'] }),
    log(addDays(starts[1], 25), { symptoms: ['fatigue'] }),
    log(addDays(starts[2], 25), { symptoms: ['fatigue'] }),
  ];
  const out = cycleExpectations({ logs, periodStarts: all, date: today });
  assert.deepEqual(out.map((e) => e.id), ['fatigue']);
  assert.equal(out[0].of, 3);
});

test('sex, sex drive, intimate symptoms, discharge, BBT, mucus and tests never take part', () => {
  const privateLog = {
    date: addDays(starts[1], 25),
    symptoms: ['discharge', 'vaginal_dryness', 'itching_vulva', 'pain_sex', 'protected', 'unprotected', 'oral_sex', 'neutral_drive'],
    moods: ['high_drive'],
    painEntries: [{ type: 'pain_sex' }],
    sexualActivity: true,
    libido: 3,
    bbt: 36.9,
    cervicalMucus: 'eggwhite',
    ovulationTest: 'positive',
  };
  assert.deepEqual(observationKeys(privateLog), []);
  const logs = [privateLog, { ...privateLog, date: addDays(starts[2], 25) }, { ...privateLog, date: addDays(starts[0], 25) }];
  assert.deepEqual(cycleExpectations({ logs, periodStarts: starts, date: today }), []);
});

test('legacy pain symptoms count as the pain row item (cramps symptom + cramps pain = one expectation)', () => {
  const logs = [
    log(addDays(starts[0], 25), { symptoms: ['cramps', 'back_pain'] }),
    log(addDays(starts[1], 25), { painEntries: [{ type: 'cramps' }, { type: 'lower_back' }] }),
    log(addDays(starts[2], 25), { symptoms: ['cramps'] }),
  ];
  const out = cycleExpectations({ logs, periodStarts: starts, date: today });
  assert.deepEqual(out.map((e) => [e.kind, e.id, e.cyclesSeen]), [
    ['pain', 'cramps', 3],
    ['pain', 'lower_back', 2],
  ]);
  assert.deepEqual(expectedIds(out, 'pain'), ['cramps', 'lower_back']);
  assert.deepEqual(expectedIds(out, 'symptom'), []);
});

test('the quick log can ask for another day: day 2 of the cycle reads the period days', () => {
  const logs = starts.slice(0, 3).map((s) => log(addDays(s, 1), { painEntries: [{ type: 'cramps' }], symptoms: ['fatigue'] }));
  const out = cycleExpectations({ logs, periodStarts: starts, date: addDays(starts[3], 1) });
  assert.deepEqual(out.map((e) => e.id), ['cramps', 'fatigue']);
  // A date before the first start, or a malformed one, yields nothing.
  assert.deepEqual(cycleExpectations({ logs, periodStarts: starts, date: '2026-01-01' }), []);
  assert.deepEqual(cycleExpectations({ logs, periodStarts: starts, date: 'today' }), []);
});

test('the hero line names the most frequent item not yet logged today, always „სავარაუდოა“', () => {
  const logs = [
    ...starts.slice(0, 3).map((s) => log(addDays(s, 25), { painEntries: [{ type: 'cramps' }], symptoms: ['bloating'] })),
    log(addDays(starts[1], 25), { symptoms: ['bloating', 'acne'] }),
    log(addDays(starts[2], 26), { symptoms: ['acne'] }),
  ];
  const out = cycleExpectations({ logs, periodStarts: starts, date: today });
  const line = expectationLine(out, null);
  assert.equal(line, 'სპაზმები დღეს სავარაუდოა — ბოლო 3 ციკლიდან 3-ში ამ დღეებში გქონდა');
  assert.match(line!, /სავარაუდოა/);
  assert.doesNotMatch(line!, /დიაგნოზ|აუცილებლად|გექნება/);
  // Cramps already logged today → the line moves on to bloating; everything logged → no line.
  assert.equal(expectationLine(out, log(today, { painEntries: [{ type: 'cramps' }] })), 'შებერილობა დღეს სავარაუდოა — ბოლო 3 ციკლიდან 3-ში ამ დღეებში გქონდა');
  assert.equal(expectationLine(out, log(today, { painEntries: [{ type: 'cramps' }], symptoms: ['bloating', 'acne'] })), null);
});

test('a mood expectation is phrased as a feeling', () => {
  const logs = starts.slice(0, 3).map((s) => log(addDays(s, 25), { moods: ['irritable'] }));
  const out = cycleExpectations({ logs, periodStarts: starts, date: today });
  assert.equal(expectationLine(out, null), 'განწყობა „გაღიზიანება“ დღეს სავარაუდოა — ბოლო 3 ციკლიდან 3-ში ამ დღეებში ასე აღნიშნე');
});

test('from a bundle: classic modes only, period starts from inferred → trends → ranges', () => {
  const logs = starts.slice(0, 3).map((s) => log(addDays(s, 25), { symptoms: ['bloating'] }));
  const base = { logs, inferred: null, trends: null, periodRanges: starts.map((start) => ({ start })) };
  assert.deepEqual(bundlePeriodStarts(base), starts);
  assert.deepEqual(bundlePeriodStarts({ ...base, trends: { periodStarts: ['2026-01-01'] } }), ['2026-01-01']);
  assert.deepEqual(bundlePeriodStarts({ ...base, inferred: { periodStarts: ['2026-02-02'] }, trends: { periodStarts: ['2026-01-01'] } }), ['2026-02-02']);
  assert.equal(expectationsFromBundle({ ...base, profile: { mode: 'TRACK_PERIOD' } }, today).length, 1);
  assert.equal(expectationsFromBundle({ ...base, profile: { mode: 'TRY_TO_CONCEIVE' } }, today).length, 1);
  assert.equal(expectationsFromBundle({ ...base, profile: { mode: 'PREGNANCY' } }, today).length, 0);
  assert.equal(expectationsFromBundle({ ...base, profile: { mode: 'PERIMENOPAUSE' } }, today).length, 0);
  assert.equal(expectationsFromBundle(null, today).length, 0);
});
