/**
 * Diagnostic golden suite for Cycle Phase 1 audit + Phase 2/3 closures.
 * Forecast length remains arithmetic mean. Confidence uses trimmed range at n≥6.
 * Segmentation may merge one missing/spotting interior day. CYCLE_WELLNESS allowlist unchanged.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  buildCycleAiUserPrompt,
  buildCycleAlerts,
  buildPredictions,
  daysBetween,
  detectCyclePhase,
  inferCycleStats,
  overlayLogsOnCalendar,
  pickLastPeriodStart,
  predictionConfidence,
  resolveForecastAverages,
  todayInTimeZone,
  toDateKey,
} from './cycle.js';
import {
  assertCycleDateKey,
  planEndPeriod,
  planFillRange,
  planStartPeriod,
} from './cyclePeriod.js';

function logs(rows) {
  return rows.map(([date, flow, extra = {}]) => ({
    date,
    flow,
    symptoms: extra.symptoms || [],
    moods: extra.moods || [],
    ...extra,
  }));
}

function bleed(start, lengthDays, flow = 'medium') {
  const rows = [];
  for (let i = 0; i < lengthDays; i += 1) rows.push([addDays(start, i), flow]);
  return rows;
}

function startsToLogs(starts, lengthDays = 5) {
  return logs(starts.flatMap((s) => bleed(s, lengthDays)));
}

describe('golden A — regular 28-day', () => {
  const starts = ['2025-01-01', '2025-01-29', '2025-02-26', '2025-03-26'];
  const inferred = inferCycleStats(startsToLogs(starts));

  it('mean of three 28-day gaps is 28; cycleCount is gaps not starts', () => {
    assert.deepEqual(inferred.periodStarts, starts);
    assert.equal(inferred.cycleCount, 3);
    assert.equal(inferred.inferredCycleLength, 28);
    assert.equal(inferred.avgPeriodLength, 5);
  });

  it('forecast ovulation = LMP + (length − 14); fertile = ov−5 … ov+1', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2025-03-26',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
    });
    assert.equal(pred.nextPeriodStart, '2025-04-23');
    assert.equal(pred.ovulationDate, '2025-04-09');
    assert.deepEqual(pred.fertileWindow, { start: '2025-04-04', end: '2025-04-10' });
    assert.equal(pred.confidence, 'medium');
    assert.equal(pred.estimated, true);
    assert.equal(pred.calendar['2025-03-26'].predicted, true);
  });
});

describe('golden B — regular 30-day', () => {
  it('infers 30 and predicts from last start + 30', () => {
    const inferred = inferCycleStats(
      startsToLogs(['2025-01-01', '2025-01-31', '2025-03-02']),
    );
    assert.equal(inferred.inferredCycleLength, 30);
    const pred = buildPredictions({
      lastPeriodStart: inferred.lastPeriodStart,
      avgCycleLength: inferred.inferredCycleLength,
      avgPeriodLength: inferred.avgPeriodLength,
      cycleCount: inferred.cycleCount,
    });
    assert.equal(pred.nextPeriodStart, '2025-04-01');
    assert.equal(pred.ovulationDate, '2025-03-18');
  });
});

describe('golden C — 24/34 variable', () => {
  it('uses arithmetic mean, not median; 4-gap range 10 stays medium', () => {
    const inferred = inferCycleStats(
      startsToLogs(['2025-01-01', '2025-01-25', '2025-02-28', '2025-03-24', '2025-04-27']),
    );
    assert.equal(inferred.cycleCount, 4);
    assert.equal(inferred.inferredCycleLength, 29);
    assert.equal(predictionConfidence({ cycleCount: 4, isIrregular: false }), 'medium');
  });
});

describe('golden D — highly irregular 23/37/29/45', () => {
  it('still averages all in-band gaps; variability now blocks HIGH', () => {
    const inferred = inferCycleStats(
      startsToLogs(['2025-01-01', '2025-01-24', '2025-03-02', '2025-03-31', '2025-05-15']),
    );
    assert.equal(inferred.inferredCycleLength, 34);
    // Before Phase 2: count-only → medium. After: range 22 > 14 → low when lengths are known.
    assert.equal(predictionConfidence({ cycleCount: inferred.cycleCount, isIrregular: false }), 'medium');
    assert.equal(
      predictionConfidence({
        cycleCount: inferred.cycleCount,
        isIrregular: false,
        cycleLengths: inferred.cycleGaps,
      }),
      'low',
    );
  });

  it('six alternating 21/45 gaps are NOT high even if the irregular flag is off', () => {
    const inferred = inferCycleStats(
      startsToLogs([
        '2025-01-01',
        '2025-01-22',
        '2025-03-08',
        '2025-03-29',
        '2025-05-13',
        '2025-06-03',
        '2025-07-18',
      ]),
    );
    assert.equal(inferred.cycleCount, 6);
    assert.equal(inferred.inferredCycleLength, 33);
    // Before Phase 2: high. After: range 24 → low. Missing lengths never produce HIGH.
    assert.equal(predictionConfidence({ cycleCount: 6, isIrregular: false }), 'medium');
    assert.equal(
      predictionConfidence({ cycleCount: 6, isIrregular: false, cycleLengths: inferred.cycleGaps }),
      'low',
    );
    assert.equal(predictionConfidence({ cycleCount: 6, isIrregular: true, cycleLengths: inferred.cycleGaps }), 'low');
  });
});

describe('golden E — only 1 historical cycle', () => {
  it('does not infer length; forecast source is stored/default; confidence low', () => {
    const inferred = inferCycleStats(startsToLogs(['2025-03-01']), 28, 5);
    assert.equal(inferred.cycleCount, 0);
    assert.equal(inferred.inferredCycleLength, null);
    const averages = resolveForecastAverages({ avgCycleLength: 28, avgPeriodLength: 5 }, inferred);
    assert.equal(averages.source, 'default');
    assert.equal(averages.usedCycleLength, 28);
    assert.equal(predictionConfidence({ cycleCount: 0 }), 'low');
  });
});

describe('golden F — only 2 period starts (one gap)', () => {
  it('one gap is not enough to personalize (needs cycleCount >= 2)', () => {
    const inferred = inferCycleStats(startsToLogs(['2025-01-01', '2025-01-29']), 32, 6);
    assert.equal(inferred.cycleCount, 1);
    assert.equal(inferred.inferredCycleLength, null);
    const averages = resolveForecastAverages({ avgCycleLength: 32, avgPeriodLength: 6 }, inferred);
    assert.equal(averages.source, 'user');
    assert.equal(averages.usedCycleLength, 32);
    assert.equal(predictionConfidence({ cycleCount: 1 }), 'low');
  });
});

describe('golden G — 6 completed gaps', () => {
  it('confidence becomes high at cycleCount 6 only when lengths are consistent', () => {
    const starts = [];
    let d = '2024-01-01';
    for (let i = 0; i < 7; i += 1) {
      starts.push(d);
      d = addDays(d, 28);
    }
    const inferred = inferCycleStats(startsToLogs(starts));
    assert.equal(inferred.cycleCount, 6);
    assert.equal(inferred.inferredCycleLength, 28);
    // Before Phase 2: count-only high without lengths. After: missing lengths → medium.
    assert.equal(predictionConfidence({ cycleCount: 6 }), 'medium');
    assert.equal(predictionConfidence({ cycleCount: 6, cycleLengths: inferred.cycleGaps }), 'high');
  });
});

describe('golden H — spotting around period', () => {
  it('spotting never starts a period; trailing spotting does not extend the bleed range', () => {
    const inferred = inferCycleStats(
      logs([
        ['2025-03-01', 'spotting'],
        ['2025-03-02', 'medium'],
        ['2025-03-03', 'medium'],
        ['2025-03-04', 'light'],
        ['2025-03-05', 'spotting'],
      ]),
    );
    assert.deepEqual(inferred.periodStarts, ['2025-03-02']);
    assert.deepEqual(inferred.periodRanges[0], {
      start: '2025-03-02',
      end: '2025-03-04',
      lengthDays: 3,
      source: 'logged',
    });
  });
});

describe('golden I — one-day mistaken bleed', () => {
  it('a single bleed day becomes a period start but is excluded from period-length average', () => {
    const inferred = inferCycleStats(
      logs([
        ['2025-01-01', 'medium'],
        ...bleed('2025-01-29', 5),
        ...bleed('2025-02-26', 5),
      ]),
    );
    assert.deepEqual(inferred.periodStarts, ['2025-01-01', '2025-01-29', '2025-02-26']);
    assert.equal(inferred.avgPeriodLength, 5);
    assert.equal(inferred.inferredCycleLength, 28);
  });
});

describe('golden J/K — long and short outliers', () => {
  it('60-day gap is dropped from forecast average; 28-day gaps remain', () => {
    const inferred = inferCycleStats(
      startsToLogs(['2025-01-01', '2025-01-29', '2025-03-30', '2025-04-27']),
    );
    assert.equal(daysBetween('2025-01-29', '2025-03-30'), 60);
    assert.equal(inferred.inferredCycleLength, 28);
    assert.equal(inferred.cycleCount, 2);
  });

  it('15-day gap is dropped; remaining 28-day gaps still infer 28', () => {
    const inferred = inferCycleStats(
      startsToLogs(['2025-01-01', '2025-01-16', '2025-02-13', '2025-03-13']),
    );
    assert.equal(daysBetween('2025-01-01', '2025-01-16'), 15);
    assert.equal(inferred.inferredCycleLength, 28);
  });
});

describe('golden L — historical correction of current run', () => {
  it('logging an earlier bleed day rewinds lastPeriodStart', () => {
    const next = pickLastPeriodStart(
      '2025-03-03',
      logs([
        ['2025-03-02', 'medium'],
        ['2025-03-03', 'medium'],
        ['2025-03-01', 'light'],
      ]),
    );
    assert.equal(next, '2025-03-01');
  });
});

describe('golden M — timezone / date-key identity', () => {
  it('toDateKey uses UTC civil parts so midnight UTC Date does not shift the day', () => {
    assert.equal(toDateKey(new Date('2026-03-01T00:00:00.000Z')), '2026-03-01');
    assert.equal(toDateKey('2026-03-01T12:00:00.000Z'), '2026-03-01');
  });

  it('engine today is Asia/Tbilisi, not Date#toISOString', () => {
    const isoUtc = new Date('2026-03-01T20:30:00.000Z');
    const tbilisi = todayInTimeZone('Asia/Tbilisi', isoUtc);
    const utcIsoDay = isoUtc.toISOString().slice(0, 10);
    assert.equal(tbilisi, '2026-03-02');
    assert.equal(utcIsoDay, '2026-03-01');
  });
});

describe('golden N — DST / civil-day arithmetic', () => {
  it('addDays across EU DST spring-forward stays on civil calendar', () => {
    assert.equal(addDays('2026-03-28', 1), '2026-03-29');
    assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  });
});

describe('golden O — pregnancy-sized gap', () => {
  it('a 280-day silence is not averaged in as a huge cycle', () => {
    const inferred = inferCycleStats(
      startsToLogs(['2024-01-01', '2024-01-29', '2024-02-26', '2024-12-02']),
    );
    assert.ok(daysBetween('2024-02-26', '2024-12-02') > 45);
    assert.equal(inferred.inferredCycleLength, 28);
    assert.equal(inferred.lastPeriodStart, '2024-12-02');
  });
});

describe('golden P — period start/end edit', () => {
  it('End Period does not synthesize missing bleed days', () => {
    const existing = startsToLogs(['2025-03-01'], 3);
    const inferred = inferCycleStats(existing);
    const plan = planEndPeriod({
      ranges: inferred.periodRanges,
      logs: existing,
      endDate: '2025-03-05',
    });
    assert.deepEqual(plan.fill, []);
    assert.ok(plan.unlogged.includes('2025-03-04'));
    assert.ok(plan.unlogged.includes('2025-03-05'));
  });

  it('shortening end clears later bleed; fill only writes days without period flow', () => {
    const existing = startsToLogs(['2025-03-01'], 5);
    const inferred = inferCycleStats(existing);
    const end = planEndPeriod({
      ranges: inferred.periodRanges,
      logs: existing,
      endDate: '2025-03-03',
    });
    assert.deepEqual(end.clear, ['2025-03-03', '2025-03-04', '2025-03-05']);
    const fill = planFillRange('2025-03-01', '2025-03-05', existing, 'medium');
    assert.deepEqual(fill.fill, []);
  });
});

describe('golden Q — missing daily logs (period-only tracking)', () => {
  it('averages from period starts even when non-bleed days are absent', () => {
    const inferred = inferCycleStats(
      logs([
        ['2025-01-01', 'medium'],
        ['2025-01-29', 'medium'],
        ['2025-02-26', 'medium'],
      ]),
    );
    assert.equal(inferred.inferredCycleLength, 28);
    assert.equal(inferred.avgPeriodLength, 5);
  });
});

describe('golden R — overlapping / idempotent start', () => {
  it('starting a period on an already-bleeding day is a no-op', () => {
    const plan = planStartPeriod('2025-03-01', 'medium');
    assert.equal(plan.alreadyLogged, true);
    assert.equal(plan.flow, 'medium');
  });

  it('future dates are rejected against engine today', () => {
    assert.throws(() => assertCycleDateKey('2099-01-01', '2026-03-01'), /მომავალი/);
  });
});

describe('golden — one-day logging gap stays one period', () => {
  it('a skipped bleed day does not move LMP or invent a second start', () => {
    const rows = logs([
      ['2025-03-01', 'medium'],
      ['2025-03-02', 'medium'],
      ['2025-03-04', 'medium'],
      ['2025-03-05', 'medium'],
    ]);
    const inferred = inferCycleStats(rows);
    assert.deepEqual(inferred.periodStarts, ['2025-03-01']);
    assert.equal(inferred.periodRanges[0].end, '2025-03-05');
    assert.equal(inferred.lastPeriodStart, '2025-03-01');
    assert.equal(pickLastPeriodStart('2025-03-01', rows), '2025-03-01');
  });
});

describe('golden — overlay logged vs predicted', () => {
  it('logged light/medium/heavy clears predicted; spotting does not become period', () => {
    const pred = buildPredictions({
      lastPeriodStart: '2025-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
    });
    const marked = overlayLogsOnCalendar(pred.calendar, [
      { date: '2025-03-01', flow: 'medium', symptoms: [], moods: [] },
      { date: '2025-03-06', flow: 'spotting', symptoms: [], moods: [] },
    ]);
    assert.equal(marked['2025-03-01'].predicted, false);
    assert.equal(marked['2025-03-01'].period, true);
    assert.equal(marked['2025-03-02'].predicted, true);
    assert.equal(marked['2025-03-06'].period, false);
    assert.equal(marked['2025-03-06'].logged, true);
  });
});

describe('golden — phases and late-period alert', () => {
  it('day 1 is period; ovulation cycle day is length − 13', () => {
    const p = detectCyclePhase({
      lastPeriodStart: '2025-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      today: '2025-03-01',
    });
    assert.equal(p.day, 1);
    assert.equal(p.phase, 'period');
    const ov = detectCyclePhase({
      lastPeriodStart: '2025-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      today: '2025-03-15',
    });
    assert.equal(ov.day, 15);
    assert.equal(ov.phase, 'ovulation');
    const after = detectCyclePhase({
      lastPeriodStart: '2025-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      today: '2025-03-16',
    });
    assert.equal(after.phase, 'fertile');
  });

  it('low-history late alert waits until 45 days since last FLOW', () => {
    const one = logs([['2025-01-01', 'medium']]);
    const inferred = inferCycleStats(one);
    const tooSoon = buildCycleAlerts({
      profile: { mode: 'TRACK_PERIOD', conditions: [] },
      logs: one,
      predictions: { nextPeriodStart: '2025-01-29', confidence: 'low' },
      inferred,
      today: '2025-02-12',
    });
    assert.equal(daysBetween('2025-01-01', '2025-02-12'), 42);
    assert.equal(tooSoon.some((a) => a.messageKa.includes('გვიანია')), false);
    const late = buildCycleAlerts({
      profile: { mode: 'TRACK_PERIOD', conditions: [] },
      logs: one,
      predictions: { nextPeriodStart: '2025-01-29', confidence: 'low' },
      inferred,
      today: '2025-02-15',
    });
    assert.equal(daysBetween('2025-01-01', '2025-02-15'), 45);
    assert.ok(late.some((a) => a.messageKa.includes('გვიანია')));
    assert.doesNotMatch(late.find((a) => a.messageKa.includes('გვიანია')).messageKa, /ორსულ/);
  });
});

describe('golden — AI prompt current minimization', () => {
  it('includes allowlisted last-7-day symptoms and omits sex tags and notes', () => {
    const prompt = buildCycleAiUserPrompt({
      profile: {
        mode: 'TRACK_PERIOD',
        lastPeriodStart: '2025-03-01',
        avgCycleLength: 28,
        avgPeriodLength: 5,
        isIrregular: false,
        conditions: [],
      },
      logs: [
        {
          date: '2025-03-02',
          flow: 'medium',
          symptoms: ['unprotected', 'cramps'],
          moods: [],
          notes: 'secret journal',
          sexualActivity: true,
          libido: 4,
        },
      ],
      predictions: { confidence: 'low', nextPeriodStart: '2025-03-29', ovulationDate: '2025-03-15', fertileWindow: { start: '2025-03-10', end: '2025-03-16' } },
      pregnancy: null,
      user: { age: 30 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'default' },
      today: '2025-03-02',
    });
    assert.equal(prompt.includes('unprotected'), false);
    assert.match(prompt, /cramps|კრუნჩხვები/);
    assert.equal(prompt.includes('secret journal'), false);
    assert.equal(prompt.includes('libido'), false);
    assert.equal(prompt.includes('sexualActivity'), false);
  });
});
