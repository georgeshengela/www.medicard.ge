import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  buildDoctorSummary,
  buildPredictions,
  CYCLE_TIMEZONE,
  cycleLengthStats,
  daysBetween,
  detectCyclePhase,
  inferCycleStats,
  isPeriodFlow,
  overlayLogsOnCalendar,
  pickLastPeriodStart,
  predictionConfidence,
  resolveForecastAverages,
  stampCalendarPhases,
  todayInTimeZone,
  toDateKey,
} from './cycle.js';

function logs(rows) {
  return rows.map(([date, flow]) => ({ date, flow, symptoms: [], moods: [] }));
}

describe('isPeriodFlow', () => {
  it('treats spotting as not a period', () => {
    assert.equal(isPeriodFlow('spotting'), false);
    assert.equal(isPeriodFlow('none'), false);
    assert.equal(isPeriodFlow(null), false);
    assert.equal(isPeriodFlow('light'), true);
    assert.equal(isPeriodFlow('medium'), true);
    assert.equal(isPeriodFlow('heavy'), true);
  });
});

describe('inferCycleStats', () => {
  it('uses fallbacks when history is missing', () => {
    const stats = inferCycleStats([], 28, 5);
    assert.equal(stats.avgCycleLength, 28);
    assert.equal(stats.avgPeriodLength, 5);
    assert.equal(stats.lastPeriodStart, null);
    assert.deepEqual(stats.periodStarts, []);
  });

  it('does not start a period from spotting only', () => {
    const stats = inferCycleStats(
      logs([
        ['2026-01-01', 'spotting'],
        ['2026-01-02', 'spotting'],
        ['2026-01-20', 'spotting'],
      ]),
    );
    assert.deepEqual(stats.periodStarts, []);
    assert.equal(stats.lastPeriodStart, null);
  });

  it('infers a 28-day cycle from two gaps', () => {
    const stats = inferCycleStats(
      logs([
        ['2026-01-01', 'medium'],
        ['2026-01-02', 'medium'],
        ['2026-01-03', 'light'],
        ['2026-01-29', 'medium'],
        ['2026-01-30', 'medium'],
        ['2026-02-26', 'heavy'],
      ]),
    );
    assert.deepEqual(stats.periodStarts, ['2026-01-01', '2026-01-29', '2026-02-26']);
    assert.equal(stats.avgCycleLength, 28);
    assert.equal(stats.lastPeriodStart, '2026-02-26');
    assert.equal(stats.avgPeriodLength, 3);
  });

  it('infers 21-day and 35-day cycles from valid gaps', () => {
    const short = inferCycleStats(
      logs([
        ['2026-01-01', 'medium'],
        ['2026-01-22', 'medium'],
        ['2026-02-12', 'medium'],
      ]),
    );
    assert.equal(short.avgCycleLength, 21);

    const long = inferCycleStats(
      logs([
        ['2026-01-01', 'medium'],
        ['2026-02-05', 'medium'],
        ['2026-03-12', 'medium'],
      ]),
    );
    assert.equal(long.avgCycleLength, 35);
  });

  it('ignores irregular gaps outside 18–45 when averaging', () => {
    const stats = inferCycleStats(
      logs([
        ['2026-01-01', 'medium'],
        ['2026-01-10', 'medium'],
        ['2026-02-07', 'medium'],
        ['2026-03-07', 'medium'],
      ]),
    );
    assert.deepEqual(stats.periodStarts, ['2026-01-01', '2026-01-10', '2026-02-07', '2026-03-07']);
    assert.equal(stats.avgCycleLength, 28);
  });

  it('uses fallback averages with only one period start (insufficient data)', () => {
    const stats = inferCycleStats(logs([['2026-03-01', 'medium']]), 28, 5);
    assert.deepEqual(stats.periodStarts, ['2026-03-01']);
    assert.equal(stats.lastPeriodStart, '2026-03-01');
    assert.equal(stats.avgCycleLength, 28);
    assert.equal(stats.avgPeriodLength, 5);
  });

  it('rewinds a run start when an earlier same-run bleed is logged', () => {
    const stats = inferCycleStats(
      logs([
        ['2026-03-02', 'medium'],
        ['2026-03-03', 'medium'],
        ['2026-03-01', 'light'],
      ]),
    );
    assert.deepEqual(stats.periodStarts, ['2026-03-01']);
    assert.equal(stats.lastPeriodStart, '2026-03-01');
  });
});

describe('pickLastPeriodStart', () => {
  it('keeps onboarding start when logs have no bleed', () => {
    assert.equal(pickLastPeriodStart('2026-02-01', logs([['2026-02-03', 'spotting']])), '2026-02-01');
    assert.equal(pickLastPeriodStart('2026-02-01', []), '2026-02-01');
  });

  it('does not let an older missed period steal the latest start', () => {
    const next = pickLastPeriodStart(
      '2026-03-01',
      logs([
        ['2026-01-05', 'medium'],
        ['2026-01-06', 'medium'],
        ['2026-03-01', 'medium'],
        ['2026-03-02', 'medium'],
      ]),
    );
    assert.equal(next, '2026-03-01');
  });

  it('moves last start earlier when the current run is edited', () => {
    const next = pickLastPeriodStart(
      '2026-03-02',
      logs([
        ['2026-03-01', 'medium'],
        ['2026-03-02', 'medium'],
      ]),
    );
    assert.equal(next, '2026-03-01');
  });
});

describe('buildPredictions', () => {
  it('returns empty calendar without a last period start', () => {
    const pred = buildPredictions({ lastPeriodStart: null });
    assert.equal(pred.nextPeriodStart, null);
    assert.deepEqual(pred.calendar, {});
  });

  it('marks forecast period days as predicted until logs overlay them', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2026-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
    });
    assert.equal(pred.calendar['2026-03-01'].period, true);
    assert.equal(pred.calendar['2026-03-01'].predicted, true);
    assert.equal(pred.calendar['2026-03-02'].predicted, true);
    assert.equal(pred.nextPeriodStart, '2026-03-29');
    assert.equal(pred.ovulationDate, '2026-03-15');
    assert.deepEqual(pred.fertileWindow, { start: '2026-03-10', end: '2026-03-16' });
  });

  it('keeps future cycles predicted', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2026-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
    });
    assert.equal(pred.calendar['2026-03-29'].predicted, true);
    assert.equal(pred.calendar['2026-03-29'].period, true);
  });

  it('still estimates when the irregular flag is on', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2026-03-01',
      avgCycleLength: 32,
      avgPeriodLength: 5,
    });
    assert.equal(pred.nextPeriodStart, '2026-04-02');
    assert.equal(pred.ovulationDate, '2026-03-19');
    assert.equal(predictionConfidence({ cycleCount: 4, isIrregular: true }), 'low');
    const summary = buildDoctorSummary({
      profile: {
        mode: 'TRACK_PERIOD',
        avgCycleLength: 32,
        avgPeriodLength: 5,
        isIrregular: true,
      },
      logs: logs([
        ['2026-01-04', 'medium'],
        ['2026-02-01', 'medium'],
        ['2026-03-01', 'medium'],
      ]),
      predictions: pred,
    });
    assert.equal(summary.cycleCount, 2);
    assert.equal(summary.confidence, 'low');
    assert.equal(summary.nextPeriodStart, '2026-04-02');
  });
});

describe('overlayLogsOnCalendar', () => {
  it('marks logged bleed predicted:false and leaves forecast predicted:true', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2026-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
    });
    const calendar = overlayLogsOnCalendar(pred.calendar, logs([
      ['2026-03-01', 'medium'],
      ['2026-03-02', 'light'],
    ]));
    assert.equal(calendar['2026-03-01'].predicted, false);
    assert.equal(calendar['2026-03-01'].period, true);
    assert.equal(calendar['2026-03-01'].logged, true);
    assert.equal(calendar['2026-03-03'].predicted, true);
    assert.equal(calendar['2026-03-03'].period, true);
    assert.equal(calendar['2026-03-29'].predicted, true);
  });

  it('treats spotting as logged, not a period day', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2026-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
    });
    const calendar = overlayLogsOnCalendar(pred.calendar, logs([['2026-03-01', 'spotting']]));
    assert.equal(calendar['2026-03-01'].logged, true);
    assert.equal(calendar['2026-03-01'].period, false);
    assert.equal(calendar['2026-03-01'].flow, 'spotting');
  });
});

describe('cycleLengthStats + confidence', () => {
  it('computes shortest, longest, and range', () => {
    const stats = cycleLengthStats([
      { start: '2026-01-01', length: 26 },
      { start: '2026-01-27', length: 30 },
      { start: '2026-02-26', length: 28 },
    ]);
    assert.equal(stats.shortest, 26);
    assert.equal(stats.longest, 30);
    assert.equal(stats.variability, 4);
    assert.equal(stats.count, 3);
  });

  it('returns low confidence for one cycle or irregular flag', () => {
    assert.equal(predictionConfidence({ cycleCount: 0 }), 'low');
    assert.equal(predictionConfidence({ cycleCount: 1 }), 'low');
    assert.equal(predictionConfidence({ cycleCount: 4, isIrregular: true }), 'low');
    assert.equal(predictionConfidence({ cycleCount: 3 }), 'medium');
    assert.equal(predictionConfidence({ cycleCount: 6 }), 'high');
  });
});

describe('addDays', () => {
  it('stays on calendar days', () => {
    assert.equal(addDays('2026-01-30', 2), '2026-02-01');
  });

  it('crosses month, year, February, and leap day', () => {
    assert.equal(addDays('2026-01-31', 1), '2026-02-01');
    assert.equal(addDays('2025-12-31', 1), '2026-01-01');
    assert.equal(addDays('2025-02-28', 1), '2025-03-01');
    assert.equal(addDays('2024-02-28', 1), '2024-02-29');
    assert.equal(addDays('2024-02-29', 1), '2024-03-01');
    assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2);
  });
});

describe('todayInTimeZone + toDateKey', () => {
  it('uses Asia/Tbilisi, not UTC ISO, around midnight', () => {
    // 22:00 UTC 29 Aug = 02:00 30 Aug in Tbilisi (UTC+4)
    const utcEvening = new Date('2026-08-29T22:00:00.000Z');
    assert.equal(utcEvening.toISOString().slice(0, 10), '2026-08-29');
    assert.equal(todayInTimeZone(CYCLE_TIMEZONE, utcEvening), '2026-08-30');
  });

  it('does not shift a stored @db.Date midnight UTC key', () => {
    assert.equal(toDateKey(new Date('2026-08-30T00:00:00.000Z')), '2026-08-30');
    assert.equal(toDateKey('2026-08-30T00:00:00.000Z'), '2026-08-30');
    assert.equal(toDateKey('2026-08-30'), '2026-08-30');
  });

  it('formats a DST spring-forward instant in Europe/London without throwing', () => {
    const gap = new Date('2026-03-29T00:30:00.000Z');
    const key = todayInTimeZone('Europe/London', gap);
    assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('period ranges', () => {
  it('builds a five-day logged range and ignores spotting on both sides', () => {
    const stats = inferCycleStats(
      logs([
        ['2026-08-09', 'spotting'],
        ['2026-08-10', 'light'],
        ['2026-08-11', 'medium'],
        ['2026-08-12', 'heavy'],
        ['2026-08-13', 'medium'],
        ['2026-08-14', 'light'],
        ['2026-08-15', 'spotting'],
      ]),
    );
    assert.deepEqual(stats.periodRanges, [
      { start: '2026-08-10', end: '2026-08-14', lengthDays: 5, source: 'logged' },
    ]);
    assert.deepEqual(stats.periodStarts, ['2026-08-10']);
    assert.equal(stats.inferredPeriodLength, 5);
    assert.equal(stats.inferredCycleLength, null);
    assert.equal(stats.cycleCount, 0);
  });

  it('keeps a single-day period as its own range', () => {
    const stats = inferCycleStats(logs([['2026-04-01', 'heavy']]));
    assert.deepEqual(stats.periodRanges, [
      { start: '2026-04-01', end: '2026-04-01', lengthDays: 1, source: 'logged' },
    ]);
    assert.equal(stats.inferredPeriodLength, null);
  });

  it('splits ranges across a gap', () => {
    const stats = inferCycleStats(
      logs([
        ['2026-01-01', 'medium'],
        ['2026-01-02', 'medium'],
        ['2026-01-10', 'medium'],
        ['2026-01-11', 'light'],
      ]),
    );
    assert.equal(stats.periodRanges.length, 2);
    assert.deepEqual(stats.periodRanges[0], {
      start: '2026-01-01',
      end: '2026-01-02',
      lengthDays: 2,
      source: 'logged',
    });
    assert.deepEqual(stats.periodRanges[1], {
      start: '2026-01-10',
      end: '2026-01-11',
      lengthDays: 2,
      source: 'logged',
    });
  });
});

function cycleStarts(...starts) {
  return logs(starts.map((date) => [date, 'medium']));
}

describe('forecast source (recommendation C)', () => {
  it('uses default 28/5 when history is empty and profile is default', () => {
    const inferred = inferCycleStats([]);
    const averages = resolveForecastAverages(
      { avgCycleLength: 28, avgPeriodLength: 5 },
      inferred,
    );
    assert.equal(averages.source, 'default');
    assert.equal(averages.usedCycleLength, 28);
    assert.equal(averages.usedPeriodLength, 5);
    assert.equal(averages.storedCycleLength, 28);
    assert.equal(averages.inferredCycleLength, null);
    assert.equal(averages.cycleCount, 0);
  });

  it('uses the stored user value when history is insufficient', () => {
    const inferred = inferCycleStats(cycleStarts('2026-03-01'));
    const averages = resolveForecastAverages(
      { avgCycleLength: 32, avgPeriodLength: 6 },
      inferred,
    );
    assert.equal(averages.source, 'user');
    assert.equal(averages.usedCycleLength, 32);
    assert.equal(averages.usedPeriodLength, 6);
    assert.equal(averages.storedCycleLength, 32);
    assert.equal(averages.inferredCycleLength, null);
    assert.equal(averages.cycleCount, 0);
  });

  it('uses inferred 31 and keeps stored 28 when cycleCount >= 2', () => {
    const inferred = inferCycleStats(
      cycleStarts('2026-01-01', '2026-02-01', '2026-03-04'),
    );
    assert.equal(inferred.cycleCount, 2);
    assert.equal(inferred.inferredCycleLength, 31);
    const averages = resolveForecastAverages(
      { avgCycleLength: 28, avgPeriodLength: 5 },
      inferred,
    );
    assert.equal(averages.source, 'inferred');
    assert.equal(averages.usedCycleLength, 31);
    assert.equal(averages.storedCycleLength, 28);
    assert.equal(averages.inferredCycleLength, 31);
  });

  it('does not overwrite the stored profile object', () => {
    const profile = { avgCycleLength: 28, avgPeriodLength: 5 };
    const inferred = inferCycleStats(
      cycleStarts('2026-01-01', '2026-02-01', '2026-03-04'),
    );
    resolveForecastAverages(profile, inferred);
    assert.equal(profile.avgCycleLength, 28);
    assert.equal(profile.avgPeriodLength, 5);
  });

  it('drives forecast length from inferred 24 / 31 / 40 when enough gaps exist', () => {
    const cases = [
      { starts: ['2026-01-01', '2026-01-25', '2026-02-18'], length: 24 },
      { starts: ['2026-01-01', '2026-02-01', '2026-03-04'], length: 31 },
      { starts: ['2026-01-01', '2026-02-10', '2026-03-22'], length: 40 },
    ];
    for (const row of cases) {
      const inferred = inferCycleStats(cycleStarts(...row.starts));
      const averages = resolveForecastAverages(
        { avgCycleLength: 28, avgPeriodLength: 5 },
        inferred,
      );
      assert.equal(averages.usedCycleLength, row.length, row.starts.join(','));
      const pred = buildPredictions({
        lastPeriodStart: row.starts[row.starts.length - 1],
        avgCycleLength: averages.usedCycleLength,
        avgPeriodLength: averages.usedPeriodLength,
        cycleCount: averages.cycleCount,
      });
      assert.equal(pred.nextPeriodStart, addDays(row.starts[row.starts.length - 1], row.length));
    }
  });

  it('uses inferred 28 from two valid 28-day gaps', () => {
    const inferred = inferCycleStats(
      cycleStarts('2026-01-01', '2026-01-29', '2026-02-26'),
    );
    assert.equal(inferred.inferredCycleLength, 28);
    assert.equal(inferred.cycleCount, 2);
  });
});

describe('history depth → confidence', () => {
  it('zero and one cycle stay low; four medium; six high', () => {
    assert.equal(predictionConfidence({ cycleCount: 0 }), 'low');
    assert.equal(predictionConfidence({ cycleCount: 1 }), 'low');
    const two = inferCycleStats(cycleStarts('2026-01-01', '2026-01-29', '2026-02-26'));
    assert.equal(two.cycleCount, 2);
    assert.equal(predictionConfidence({ cycleCount: two.cycleCount }), 'medium');
    const four = inferCycleStats(
      cycleStarts('2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26', '2026-04-23'),
    );
    assert.equal(four.cycleCount, 4);
    assert.equal(predictionConfidence({ cycleCount: 4 }), 'medium');
    const six = inferCycleStats(
      cycleStarts(
        '2026-01-01',
        '2026-01-29',
        '2026-02-26',
        '2026-03-26',
        '2026-04-23',
        '2026-05-21',
        '2026-06-18',
      ),
    );
    assert.equal(six.cycleCount, 6);
    assert.equal(predictionConfidence({ cycleCount: 6 }), 'high');
  });
});

describe('canonical predictions', () => {
  it('flags the forecast as estimated and attaches confidence', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2026-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 6,
    });
    assert.equal(pred.estimated, true);
    assert.equal(pred.confidence, 'high');
    assert.equal(pred.nextPeriodStart, '2026-03-29');
    assert.equal(pred.ovulationDate, '2026-03-15');
    assert.deepEqual(pred.fertileWindow, { start: '2026-03-10', end: '2026-03-16' });
    assert.equal(pred.calendar['2026-03-29'].predicted, true);
    assert.equal(pred.calendar['2026-03-29'].estimated, true);
    assert.equal(pred.calendar['2026-03-15'].ovulation, true);
    assert.equal(pred.calendar['2026-03-15'].estimated, true);
  });

  it('stamps cycle day and phase from the server, not the client', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2026-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
    });
    assert.equal(pred.calendar['2026-03-01'].cycleDay, 1);
    assert.equal(pred.calendar['2026-03-01'].phase, 'period');
    assert.equal(pred.calendar['2026-03-08'].phase, 'follicular');
    assert.equal(pred.calendar['2026-03-15'].cycleDay, 15);
    assert.equal(pred.calendar['2026-03-15'].phase, 'ovulation');
    assert.equal(pred.calendar['2026-03-20'].phase, 'luteal');
  });

  it('keeps logged bleed predicted:false and estimated:false', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2026-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      logs: logs([
        ['2026-03-01', 'medium'],
        ['2026-03-02', 'light'],
      ]),
    });
    assert.equal(pred.calendar['2026-03-01'].predicted, false);
    assert.equal(pred.calendar['2026-03-01'].estimated, false);
    assert.equal(pred.calendar['2026-03-01'].logged, true);
    assert.equal(pred.calendar['2026-03-03'].predicted, true);
    assert.equal(pred.calendar['2026-03-29'].predicted, true);
    assert.equal(pred.calendar['2026-03-29'].estimated, true);
  });

  it('detectCyclePhase uses an explicit calendar day, not host TZ', () => {
    const info = detectCyclePhase({
      lastPeriodStart: '2026-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      today: '2026-03-10',
    });
    assert.equal(info.day, 10);
    assert.equal(info.phase, 'fertile');
  });
});

describe('stampCalendarPhases', () => {
  it('does not invent CycleLog rows', () => {
    const calendar = stampCalendarPhases(
      {},
      {
        lastPeriodStart: '2026-03-01',
        fromKey: '2026-03-01',
        toKey: '2026-03-03',
      },
    );
    assert.equal(calendar['2026-03-02'].cycleDay, 2);
    assert.equal(calendar['2026-03-02'].logged, undefined);
    assert.equal(calendar['2026-03-02'].flow, undefined);
  });
});
