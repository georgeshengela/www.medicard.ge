import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from './cycle.js';
import {
  buildCyclePregnancyData,
  gestationalAgeFromReference,
  trimesterFromCompletedWeek,
} from './cyclePregnancy.js';
import { presentPregnancyTimeline } from '../../../mobile/src/lib/pregnancyTimelinePresent.js';

const TODAY = '2026-09-10';
const DUE = { date: '2027-04-01', estimated: true };

function datingAt(week, day, trimester) {
  return {
    reviewRequired: false,
    estimatedGestationalAge: {
      week,
      day,
      dayOfPregnancy: week * 7 + day,
      trimester,
    },
    estimatedDueDate: DUE,
    referenceDate: '1999-01-01',
  };
}

function active(dating) {
  return presentPregnancyTimeline({
    mode: 'PREGNANCY',
    pregnancyActive: true,
    dating,
  });
}

function episodeAt(week, day, status = 'ACTIVE') {
  return {
    id: 'ep-1',
    referenceDate: addDays(TODAY, -(week * 7 + day)),
    referenceType: 'LMP',
    status,
  };
}

describe('presentPregnancyTimeline fixtures', () => {
  it('A — week 6 first trimester, current milestone highlighted', () => {
    const timeline = active(datingAt(6, 2, 1));
    assert.equal(timeline.available, true);
    assert.equal(timeline.currentWeek, 6);
    assert.equal(timeline.currentDay, 2);
    assert.equal(timeline.trimester, 1);
    assert.equal(timeline.currentMilestoneId, 'heart_activity');
    assert.equal(timeline.milestones.find((row) => row.id === 'heart_activity').status, 'CURRENT');
    assert.equal(timeline.milestones.find((row) => row.id === 'early_calendar').status, 'PAST');
    assert.equal(timeline.milestones.find((row) => row.id === 'embryonic_period').status, 'UPCOMING');
    assert.equal(timeline.progress.kind, 'gestational_calendar');
    assert.equal(timeline.progress.ofWeeks, 40);
    assert.equal(timeline.beyondStandardTerm, false);
  });

  it('B — week 13 is second trimester on the documented convention', () => {
    const age = gestationalAgeFromReference(addDays(TODAY, -(13 * 7)), TODAY);
    assert.equal(age.week, 13);
    assert.equal(age.trimester, 2);
    const timeline = active({
      reviewRequired: false,
      estimatedGestationalAge: age,
      estimatedDueDate: DUE,
    });
    assert.equal(timeline.trimester, 2);
    assert.equal(timeline.currentMilestoneId, 't2_start');
    assert.equal(timeline.milestones.find((row) => row.id === 't1_end').status, 'PAST');
  });

  it('C — week 14 remains second trimester', () => {
    const timeline = active(datingAt(14, 0, 2));
    assert.equal(timeline.trimester, 2);
    assert.equal(timeline.currentMilestoneId, null);
    assert.equal(timeline.currentMarker.betweenMilestones, true);
    assert.equal(timeline.milestones.find((row) => row.id === 't2_start').status, 'PAST');
    assert.equal(timeline.milestones.find((row) => row.id === 'movement_window').status, 'UPCOMING');
  });

  it('D — week 27/28 third trimester boundary', () => {
    const t27 = active(datingAt(27, 0, 3));
    assert.equal(t27.trimester, 3);
    assert.equal(t27.currentMilestoneId, 't3_start');
    const t28 = active(datingAt(28, 1, 3));
    assert.equal(t28.trimester, 3);
    assert.equal(t28.currentMilestoneId, 'later_pregnancy');
  });

  it('E — week 40 estimated due-date end state', () => {
    const timeline = active(datingAt(40, 0, 3));
    assert.equal(timeline.currentMilestoneId, 'estimated_term');
    assert.equal(timeline.beyondStandardTerm, false);
    assert.equal(timeline.estimatedDueDate.date, DUE.date);
    assert.equal(timeline.estimatedDueDate.estimated, true);
    assert.equal(timeline.nextMilestone, null);
    assert.ok(timeline.progress.fraction <= 1);
  });

  it('F — week 41+ has no overdue language and fills the 40-week rail', () => {
    const timeline = active(datingAt(41, 2, 3));
    assert.equal(timeline.beyondStandardTerm, true);
    assert.equal(timeline.currentWeek, 41);
    assert.equal(timeline.progress.fraction, 1);
    assert.ok(timeline.milestones.every((row) => row.status === 'PAST'));
    assert.doesNotMatch(JSON.stringify(timeline), /overdue|გადაცილებული|alarm/i);
  });

  it('G — reviewRequired hides position and milestones', () => {
    const timeline = active({
      reviewRequired: true,
      estimatedGestationalAge: { week: 6, day: 0, dayOfPregnancy: 42, trimester: 1 },
      estimatedDueDate: DUE,
    });
    assert.equal(timeline.available, false);
    assert.equal(timeline.reviewRequired, true);
    assert.equal(timeline.currentWeek, null);
    assert.equal(timeline.currentDay, null);
    assert.equal(timeline.trimester, null);
    assert.equal(timeline.progress, null);
    assert.deepEqual(timeline.milestones, []);
  });

  it('H — TRACK mode has no timeline', () => {
    assert.equal(
      presentPregnancyTimeline({
        mode: 'TRACK_PERIOD',
        pregnancyActive: false,
        dating: datingAt(6, 0, 1),
      }),
      null,
    );
  });

  it('I — TTC mode has no timeline', () => {
    assert.equal(
      presentPregnancyTimeline({
        mode: 'TRY_TO_CONCEIVE',
        pregnancyActive: false,
        dating: datingAt(6, 0, 1),
      }),
      null,
    );
  });

  it('J — ended episode does not show an active timeline', () => {
    assert.equal(
      presentPregnancyTimeline({
        mode: 'PREGNANCY',
        pregnancyActive: false,
        dating: datingAt(20, 0, 2),
      }),
      null,
    );
  });

  it('does not recompute week/day from a reference date', () => {
    const timeline = active(datingAt(6, 3, 1));
    assert.equal(timeline.currentWeek, 6);
    assert.equal(timeline.currentDay, 3);
    assert.equal(timeline.estimatedDueDate.date, DUE.date);
  });

  it('passes trimester through from dating and does not remap it', () => {
    const timeline = active(datingAt(13, 0, 1));
    assert.equal(timeline.trimester, 1);
  });

  it('does not attach baby-size or diagnosis fields', () => {
    const timeline = active(datingAt(18, 0, 2));
    const blob = JSON.stringify(timeline);
    assert.doesNotMatch(blob, /comparisonKey|lengthCm|weightGrams|illustrationKey|raspberry|developmentPercent|healthPercent/);
    assert.equal(timeline.progress.kind, 'gestational_calendar');
  });
});

describe('trimesterFromCompletedWeek convention', () => {
  it('matches NHS completed-week bands used by Phase 18 dating', () => {
    assert.equal(trimesterFromCompletedWeek(0), 1);
    assert.equal(trimesterFromCompletedWeek(12), 1);
    assert.equal(trimesterFromCompletedWeek(13), 2);
    assert.equal(trimesterFromCompletedWeek(14), 2);
    assert.equal(trimesterFromCompletedWeek(26), 2);
    assert.equal(trimesterFromCompletedWeek(27), 3);
    assert.equal(trimesterFromCompletedWeek(28), 3);
    assert.equal(trimesterFromCompletedWeek(40), 3);
    assert.equal(trimesterFromCompletedWeek(44), 3);
    assert.equal(trimesterFromCompletedWeek(-1), null);
  });
});

describe('GET pregnancy timeline attachment', () => {
  it('attaches a live timeline only for an ACTIVE pregnancy episode', () => {
    const data = buildCyclePregnancyData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      episode: episodeAt(6, 0),
    });
    assert.equal(data.estimatedGestationalAge.week, 6);
    assert.equal(data.timeline.available, true);
    assert.equal(data.timeline.currentWeek, data.estimatedGestationalAge.week);
    assert.equal(data.timeline.currentDay, data.estimatedGestationalAge.day);
    assert.equal(data.timeline.trimester, data.estimatedGestationalAge.trimester);
    assert.equal(data.weekDevelopment.week, 6);
  });

  it('is null in TRACK and TTC and when the episode has ended', () => {
    assert.equal(
      buildCyclePregnancyData({
        today: TODAY,
        profile: { mode: 'TRACK_PERIOD' },
        episode: episodeAt(6, 0),
      }).timeline,
      null,
    );
    assert.equal(
      buildCyclePregnancyData({
        today: TODAY,
        profile: { mode: 'TRY_TO_CONCEIVE' },
        episode: episodeAt(6, 0),
      }).timeline,
      null,
    );
    assert.equal(
      buildCyclePregnancyData({
        today: TODAY,
        profile: { mode: 'PREGNANCY' },
        episode: episodeAt(20, 0, 'ENDED'),
      }).timeline,
      null,
    );
  });

  it('hides timeline position when dating is reviewRequired', () => {
    const data = buildCyclePregnancyData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      episode: {
        id: 'ep-old',
        referenceDate: addDays(TODAY, -320),
        referenceType: 'LMP',
        status: 'ACTIVE',
      },
    });
    assert.equal(data.reviewRequired, true);
    assert.equal(data.estimatedGestationalAge, null);
    assert.equal(data.timeline.available, false);
    assert.deepEqual(data.timeline.milestones, []);
  });
});
