import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, ageLabel, ageParts, correctedAgeDays, daysBetween } from './age.js';
import { chartWindow, growthCurves, growthTrend, lmsAt, percentileFromZ, scoreMeasurement, zFromLms } from './growth.js';
import { buildGeSchedule, summarizeSchedule } from './vaccinesGe.js';

test('calendar months clamp to the last day', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2025-11-15', 3), '2026-02-15');
});

test('age parts and labels read the way parents say them', () => {
  assert.deepEqual(ageParts('2026-05-30', '2026-10-12'), { years: 0, months: 4, days: 12, totalMonths: 4 });
  assert.equal(ageLabel('2026-05-30', '2026-10-12'), '4 თვის და 12 დღის');
  assert.equal(ageLabel('2026-05-30', '2026-10-12', 'en'), '4 months 12 days');
  assert.equal(ageLabel('2026-10-02', '2026-10-12'), '10 დღის');
  assert.equal(ageLabel('2026-09-01', '2026-09-22'), '3 კვირის');
  assert.equal(ageLabel('2023-07-12', '2026-10-12'), '3 წლის და 3 თვის');
  assert.equal(ageLabel('2016-01-01', '2026-10-12'), '10 წლის');
});

test('corrected age only for preterm babies under two years', () => {
  assert.equal(correctedAgeDays(120, 32), 120 - 56);
  assert.equal(correctedAgeDays(120, 39), 120);
  assert.equal(correctedAgeDays(800, 30), 800);
  assert.equal(correctedAgeDays(20, 28), 0);
});

test('WHO medians come back as z = 0, percentile 50', () => {
  // Boys 12 months (365 days): weight median 9.646 kg (WHO table), length median 75.7391 cm.
  const w = lmsAt('wfa', 'MALE', 365);
  assert.equal(w.M, 9.646);
  assert.ok(Math.abs(zFromLms(9.646, w, 'wfa')) < 1e-9);
  assert.equal(percentileFromZ(0), 50);
  // Girls 5 years (1826 days) height median 109.4189 cm.
  assert.equal(lmsAt('lhfa', 'FEMALE', 1826).M, 109.4189);
  // Interpolates between rows: day 10 sits between day 7 and day 14.
  const d10 = lmsAt('wfa', 'FEMALE', 10);
  assert.ok(d10.M > 3.3388 && d10.M < 3.5693);
});

test('WHO worked example: weight z beyond +3 uses the restricted method', () => {
  // WHO computation guide example: boy, 12 months, 14.0 kg → z well above 3 but finite and monotone.
  const lms = lmsAt('wfa', 'MALE', 365);
  const z14 = zFromLms(14, lms, 'wfa');
  const z15 = zFromLms(15, lms, 'wfa');
  assert.ok(z14 > 3 && z15 > z14);
});

test('a measurement is scored on WHO cut-offs with corrected age and the 0.7 cm rule', () => {
  const ok = scoreMeasurement({ birthYmd: '2025-10-12', sex: 'FEMALE', measuredOn: '2026-10-12', weightKg: 8.9, heightCm: 74 });
  assert.equal(ok.entries.wfa.status, 'normal');
  assert.equal(ok.entries.lhfa.status, 'normal');
  assert.equal(ok.entries.bfa, undefined, 'BMI starts at 24 months');
  const low = scoreMeasurement({ birthYmd: '2025-10-12', sex: 'MALE', measuredOn: '2026-10-12', weightKg: 7.0 });
  assert.equal(low.entries.wfa.status, 'low');
  const typo = scoreMeasurement({ birthYmd: '2025-10-12', sex: 'MALE', measuredOn: '2026-10-12', weightKg: 95 });
  assert.equal(typo.entries.wfa.status, 'check');
  const pre = scoreMeasurement({ birthYmd: '2026-06-12', sex: 'MALE', gestationWeeks: 32, measuredOn: '2026-10-12', weightKg: 5.4 });
  assert.equal(pre.ageDays, daysBetween('2026-06-12', '2026-10-12') - 56);
  const standing = scoreMeasurement({ birthYmd: '2025-10-12', sex: 'MALE', measuredOn: '2026-10-12', heightCm: 75, position: 'STANDING' });
  const lying = scoreMeasurement({ birthYmd: '2025-10-12', sex: 'MALE', measuredOn: '2026-10-12', heightCm: 75.7, position: 'LYING' });
  assert.equal(standing.entries.lhfa.value, lying.entries.lhfa.value);
  const school = scoreMeasurement({ birthYmd: '2018-04-01', sex: 'MALE', measuredOn: '2026-10-12', weightKg: 27, heightCm: 132 });
  assert.equal(school.entries.bfa.status, 'normal');
  assert.equal(school.entries.wfa.status, 'normal');
});

test('trend flags a change of two centile spaces, not a single low point', () => {
  assert.equal(growthTrend([{ ageDays: 60, z: 0.2 }, { ageDays: 150, z: -1.3 }]).direction, 'falling');
  assert.equal(growthTrend([{ ageDays: 60, z: 0.2 }, { ageDays: 150, z: -0.4 }]).direction, 'steady');
  assert.equal(growthTrend([{ ageDays: 60, z: 0.2 }, { ageDays: 90, z: -2 }]), null, 'too close together');
});

test('chart windows and curves', () => {
  assert.deepEqual(chartWindow('wfa', 200), { from: 0, to: 730 });
  assert.deepEqual(chartWindow('wfa', 1000), { from: 0, to: 1826 });
  assert.equal(chartWindow('hcfa', 2500), null);
  const curves = growthCurves('wfa', 'FEMALE', { from: 0, to: 730 });
  assert.ok(curves.p3.length > 20);
  assert.ok(curves.p97[0][1] > curves.p50[0][1] && curves.p50[0][1] > curves.p3[0][1]);
});

const doneAll = (birth, ids) => ids.map((id) => {
  const [code, dose] = id.split('-');
  return { code, dose: Number(dose), status: 'GIVEN_UNKNOWN_DATE', givenOn: null };
});

test('a newborn: birth doses due now, the two-month visit ahead', () => {
  const items = buildGeSchedule({ birthYmd: '2026-10-10', todayYmd: '2026-10-12' });
  const by = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(by['hepb-1'].status, 'due');
  assert.equal(by['bcg-1'].status, 'due');
  assert.equal(by['hexa-1'].dueOn, '2026-12-10');
  assert.equal(by['hexa-1'].status, 'upcoming');
  assert.equal(by['td-1'].dueOn, '2040-10-10');
  assert.equal(by['hpv-3'].status, 'not_needed');
  const summary = summarizeSchedule(items, '2026-10-12');
  assert.equal(summary.next.id, 'hepb-1');
});

test('late doses keep the 4-week gap and never restart the series', () => {
  const records = [{ code: 'hexa', dose: 1, status: 'GIVEN', givenOn: '2026-05-01' }];
  const items = buildGeSchedule({ birthYmd: '2026-02-20', todayYmd: '2026-10-12', records });
  const by = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(by['hexa-1'].status, 'done');
  assert.equal(by['hexa-2'].status, 'overdue');
  // hexa-3 waits 28 days after the overdue hexa-2 (which can happen today at the earliest).
  assert.equal(by['hexa-3'].dueOn, '2026-11-09');
  assert.equal(by['rota-1'].status, 'expired', 'rotavirus not started by 16 weeks');
  assert.equal(by['rota-2'].status, 'expired');
});

test('PCV started after 12 months needs two doses; BCG and Hexa age out', () => {
  const items = buildGeSchedule({ birthYmd: '2024-06-01', todayYmd: '2026-10-12', records: doneAll('2024-06-01', ['hepb-1']) });
  const by = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(by['pcv-3'].status, 'not_needed');
  assert.equal(by['pcv-1'].note, 'pcvTwoDoses');
  assert.equal(by['bcg-1'].status, 'expired');
  assert.equal(by['hexa-1'].status, 'expired');
  assert.equal(by['mmr-1'].status, 'overdue');
});

test('a dose given less than 4 weeks after the previous one is flagged', () => {
  const records = [
    { code: 'hexa', dose: 1, status: 'GIVEN', givenOn: '2026-04-01' },
    { code: 'hexa', dose: 2, status: 'GIVEN', givenOn: '2026-04-15' },
  ];
  const items = buildGeSchedule({ birthYmd: '2026-02-01', todayYmd: '2026-10-12', records });
  assert.equal(items.find((i) => i.id === 'hexa-2').warning, 'shortGap');
});

test('HPV started at 15 or later becomes three doses 0-2-6', () => {
  const records = [{ code: 'hpv', dose: 1, status: 'GIVEN', givenOn: '2026-09-01' }];
  const items = buildGeSchedule({ birthYmd: '2011-01-01', todayYmd: '2026-10-12', records });
  const by = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(by['hpv-2'].dueOn, '2026-10-31');
  assert.notEqual(by['hpv-3'].status, 'not_needed');
});
