import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysYmd,
  beforeAfter,
  clockOf,
  dayLabel,
  daysBetween,
  goalPercent,
  normalizeCoachCode,
  relativeStart,
  tbilisiToIso,
  tbilisiYmd,
  weekDays,
  workoutKindLabel,
  type ProgressPhoto,
} from './coach.ts';
import { isNotificationRoute } from './notificationPlan.ts';

test('Tbilisi wall clock ↔ UTC (UTC+4, no DST)', () => {
  assert.equal(tbilisiToIso('2026-10-01', '19:00'), '2026-10-01T15:00:00.000Z');
  assert.equal(tbilisiToIso('2026-10-01', '02:30'), '2026-09-30T22:30:00.000Z');
  assert.equal(clockOf('2026-10-01T15:00:00.000Z'), '19:00');
  assert.equal(tbilisiYmd('2026-09-30T21:00:00Z'), '2026-10-01');
  assert.equal(addDaysYmd('2026-12-31', 1), '2027-01-01');
});

test('day labels and Monday-first weeks', () => {
  assert.equal(dayLabel('2026-09-28', '2026-09-28'), 'დღეს');
  assert.equal(dayLabel('2026-09-29', '2026-09-28'), 'ხვალ');
  assert.equal(dayLabel('2026-09-27', '2026-09-28'), 'გუშინ');
  assert.equal(dayLabel('2026-10-01', '2026-09-28'), 'ხუთ, 1 ოქტ');
  const week = weekDays('2026-10-01');
  assert.equal(week[0], '2026-09-28', 'Monday');
  assert.equal(week[6], '2026-10-04', 'Sunday');
  assert.equal(daysBetween('2026-09-01', '2026-10-01'), 30);
});

test('relative start for the next session', () => {
  const now = Date.parse('2026-10-01T14:00:00Z');
  assert.equal(relativeStart('2026-10-01T14:40:00Z', now), '40 წუთში');
  assert.equal(relativeStart('2026-10-01T17:00:00Z', now), '3 საათში');
  assert.equal(relativeStart('2026-10-02T15:00:00Z', now), 'ხვალ 19:00');
  assert.equal(relativeStart('2026-10-01T13:59:00Z', now), 'მიმდინარეობს');
});

test('goal percent is clamped and direction-agnostic', () => {
  assert.equal(goalPercent(90, 80, 85), 50);
  assert.equal(goalPercent(90, 80, 95), 0);
  assert.equal(goalPercent(90, 80, 78), 100);
  assert.equal(goalPercent(60, 66, 63), 50);
  assert.equal(goalPercent(null, 80, 85), null);
});

test('before/after uses the earliest and latest photo of one pose', () => {
  const p = (id: string, takenOn: string, pose: ProgressPhoto['pose']): ProgressPhoto => ({ id, takenOn, pose, weightKg: null, note: '', url: `/api/trainer/photos/${id}/file` });
  const photos = [p('a', '2026-09-01', 'FRONT'), p('b', '2026-09-20', 'SIDE'), p('c', '2026-09-28', 'FRONT'), p('d', '2026-09-14', 'FRONT')];
  const pair = beforeAfter(photos, 'FRONT');
  assert.equal(pair?.before.id, 'a');
  assert.equal(pair?.after.id, 'c');
  assert.equal(beforeAfter(photos, 'SIDE'), null, 'one photo is not a comparison');
});

test('coach codes use the unambiguous alphabet', () => {
  assert.equal(normalizeCoachCode(' k7m-2qx '), 'K7M2QX');
  assert.equal(normalizeCoachCode('ABC10O'), null, '0, O, 1 are excluded');
  assert.equal(normalizeCoachCode('ABC'), null);
});

test('workout kinds from Health read in Georgian', () => {
  assert.equal(workoutKindLabel('traditionalStrengthTraining'), 'ძალოვანი ვარჯიში');
  assert.equal(workoutKindLabel('somethingNew'), 'ვარჯიში');
});

test('trainer notifications may open coach and trainer screens', () => {
  assert.equal(isNotificationRoute('/trainer/sessions'), true);
  assert.equal(isNotificationRoute('/coach/client/abc'), true);
  assert.equal(isNotificationRoute('/coach'), true);
  assert.equal(isNotificationRoute('//evil.example/coach'), false);
});
