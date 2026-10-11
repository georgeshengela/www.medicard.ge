import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cycleBedtimes, dayPhase, formatDuration, formatHoursCompact, hhmm, nextWake, nightOf, parseHHMM, plannedBedtimeMinutes, tonight, wakeMinutesFor,
} from './sleepTime.ts';
import { windDownSlots } from './sleepSchedule.ts';
import { sleepWidgetTimeline } from './sleepWidgetSnapshot.ts';
import { sleepNightDetails, type StagedSleepPiece } from '../sleepNights.ts';
import type { SleepPlan } from './sleepTypes';

const plan: SleepPlan = { goalMinutes: 480, wakeTime: '07:00', weekendWakeTime: null, windDownMinutes: 30, bedtimeReminder: true, checkinReminder: true, alarm: true, hideScore: false };
const local = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

test('clock helpers', () => {
  assert.equal(hhmm(22 * 60 + 45), '22:45');
  assert.equal(hhmm(-15), '23:45');
  assert.equal(parseHHMM('07:05'), 425);
  assert.equal(parseHHMM('7:05'), null);
  assert.equal(formatHoursCompact(449), '7:29');
  assert.ok(formatDuration(480).includes('8'));
});

test('a night belongs to the morning it ends', () => {
  assert.equal(nightOf(local(2026, 10, 12, 7, 10)), '2026-10-12');
  assert.equal(nightOf(local(2026, 10, 12, 19, 0)), '2026-10-13');
});

test('planned bedtime = wake − goal − 15 min; weekend wake-up when set', () => {
  assert.equal(plannedBedtimeMinutes(plan, local(2026, 10, 13, 12)), 22 * 60 + 45);
  const weekend = { ...plan, weekendWakeTime: '09:00' };
  assert.equal(wakeMinutesFor(weekend, local(2026, 10, 17, 12)), 9 * 60); // Saturday
  assert.equal(plannedBedtimeMinutes(weekend, local(2026, 10, 17, 12)), 45);
});

test('tonight and the next wake-up roll over at the wake time', () => {
  const evening = local(2026, 10, 12, 21, 0);
  const t = tonight(plan, evening);
  assert.equal(t.wake.getTime(), local(2026, 10, 13, 7, 0).getTime());
  assert.equal(t.bedtime.getTime(), local(2026, 10, 12, 22, 45).getTime());
  assert.equal(t.windDown.getTime(), local(2026, 10, 12, 22, 15).getTime());
  assert.equal(nextWake(plan, local(2026, 10, 13, 6, 0)).getTime(), local(2026, 10, 13, 7, 0).getTime());
});

test('the hub leads with the right part of the day', () => {
  assert.equal(dayPhase(plan, local(2026, 10, 12, 20, 30)), 'evening');
  assert.equal(dayPhase(plan, local(2026, 10, 12, 23, 30)), 'night');
  assert.equal(dayPhase(plan, local(2026, 10, 13, 8, 0)), 'morning');
  assert.equal(dayPhase(plan, local(2026, 10, 13, 14, 0)), 'day');
});

test('90-minute cycle calculator', () => {
  const [six] = cycleBedtimes(local(2026, 10, 13, 7, 0));
  assert.equal(six.cycles, 6);
  assert.equal(six.bedtime.getTime(), local(2026, 10, 12, 21, 45).getTime());
});

test('wind-down reminders: one per evening, the weekend shifts the evening before', () => {
  const same = windDownSlots(plan);
  assert.equal(same.length, 7);
  assert.ok(same.every((s) => s.minutes === 22 * 60 + 15));
  const late = windDownSlots({ ...plan, weekendWakeTime: '09:00', windDownMinutes: 60 });
  // Saturday and Sunday mornings: bed 00:45, wind-down 23:45 on Friday and Saturday evenings.
  const fri = late.find((s) => s.weekday === 4 && s.minutes === 23 * 60 + 45);
  const sat = late.find((s) => s.weekday === 5 && s.minutes === 23 * 60 + 45);
  assert.ok(fri && sat, JSON.stringify(late));
});

test('widget timeline: no plan → the neutral tile; evening → countdown; sleep mode → the alarm', () => {
  assert.equal(sleepWidgetTimeline(null, null, null, local(2026, 10, 12, 12))[0].props.state, 'empty');
  const day = sleepWidgetTimeline(plan, { night: '2026-10-12', sleptMinutes: 455 }, null, local(2026, 10, 12, 13));
  assert.equal(day[0].props.state, 'rest');
  assert.equal(day[0].props.value, '7:35');
  const evening = day.find((e) => e.props.state === 'evening' && (e.props.countdownTo ?? 0) > 0);
  assert.ok(evening);
  assert.ok(day.every((e, i) => i === 0 || e.date.getTime() > day[i - 1].date.getTime()), 'entries in time order');
  const night = sleepWidgetTimeline(plan, null, { startedAt: local(2026, 10, 12, 23).getTime(), alarmAt: local(2026, 10, 13, 7, 15).getTime() }, local(2026, 10, 12, 23, 30));
  assert.equal(night[0].props.state, 'night');
  assert.equal(night[0].props.value, '07:15');
});

test('Health nights: main sleep only, stages once, a nap never stretches the night', () => {
  const t = (h: number, m = 0, d = 12) => local(2026, 10, d, h, m).getTime();
  const pieces: StagedSleepPiece[] = [
    { start: t(23, 0, 11), end: t(7, 0), stage: 'inBed' },
    { start: t(23, 20, 11), end: t(1, 0), stage: 'core' },
    { start: t(1, 0), end: t(2, 0), stage: 'deep' },
    { start: t(2, 0), end: t(2, 10), stage: 'awake' },
    { start: t(2, 10), end: t(5, 0), stage: 'core' },
    { start: t(5, 0), end: t(6, 40), stage: 'rem' },
    // the same deep phase from a second source
    { start: t(1, 0), end: t(2, 0), stage: 'deep' },
    // an afternoon nap the same day
    { start: t(14, 0), end: t(14, 40), stage: 'asleep' },
  ];
  const [n] = sleepNightDetails(pieces, '2026-10-01');
  assert.equal(n.night, '2026-10-12');
  assert.equal(new Date(n.wakeAt).getHours(), 7);
  assert.equal(n.deepMinutes, 60);
  assert.equal(n.remMinutes, 100);
  assert.equal(n.awakeMinutes, 10);
  assert.equal(n.asleepMinutes, 100 + 60 + 170 + 100);
});
