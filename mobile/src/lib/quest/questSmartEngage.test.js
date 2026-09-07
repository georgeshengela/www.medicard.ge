'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  progressBucket,
  remainingMeaningful,
  pickBestQuestSmartCandidate,
  revalidateQuestSmart,
  crossedQuestProgressThreshold,
  weatherAnalyticsKey,
  QUEST_SMART_REASON,
  QUEST_SMART_TEMPLATE_KEYS,
  scoreQuestSmartCandidate,
  pickQuestCopyVariant,
} = require('./questSmartEngage.js');

function move(overrides = {}) {
  return {
    id: 'q1',
    key: 'daily_steps',
    progressType: 'STEPS',
    status: 'ACTIVE',
    progress: 4000,
    target: 5000,
    progressPercent: 80,
    targetSource: 'PERSONALIZED',
    difficulty: 'NORMAL',
    periodKey: '2026-09-06',
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    now: new Date('2026-09-06T14:00:00'),
    daily: [move()],
    weekly: [],
    weather: null,
    openedRecently: false,
    loggedPain: false,
    frequency: 'balanced',
    preferredHour: null,
    hasQuestHistory: true,
    ...overrides,
  };
}

describe('questSmartEngage progress helpers', () => {
  it('maps progress buckets without exact steps', () => {
    assert.equal(progressBucket(49), 'LT_50');
    assert.equal(progressBucket(50), 'P50_74');
    assert.equal(progressBucket(75), 'P75_79');
    assert.equal(progressBucket(80), 'P80_89');
    assert.equal(progressBucket(90), 'P90_99');
    assert.equal(progressBucket(100), 'COMPLETE');
  });

  it('remainingMeaningful uses max(250, target*0.05)', () => {
    assert.equal(remainingMeaningful(4990, 5000), false); // 10 < 250
    assert.equal(remainingMeaningful(4740, 5000), true); // 260 >= 250
    assert.equal(remainingMeaningful(9600, 10000), false); // 400 < 500 (5%)
    assert.equal(remainingMeaningful(9400, 10000), true);
  });

  it('detects threshold crossings 50/75/80/90/100', () => {
    assert.equal(crossedQuestProgressThreshold(49, 50), true);
    assert.equal(crossedQuestProgressThreshold(79, 80), true);
    assert.equal(crossedQuestProgressThreshold(80, 81), false);
    assert.equal(crossedQuestProgressThreshold(99, 100), true);
  });
});

describe('QUEST_NEAR_COMPLETE eligibility', () => {
  it('accepts 80–99% before 20:00 with meaningful remaining', () => {
    const best = pickBestQuestSmartCandidate(baseInput({ daily: [move({ progress: 4200, target: 5000, progressPercent: 84 })] }));
    assert.equal(best?.type, 'QUEST_NEAR_COMPLETE');
    assert.ok(best.score >= 78);
  });

  it('suppresses at 79%, 100%, trivial remaining, evening, pain, recent open', () => {
    assert.equal(
      pickBestQuestSmartCandidate(baseInput({ daily: [move({ progressPercent: 79, progress: 3950, target: 5000 })] }))?.type ===
        'QUEST_NEAR_COMPLETE',
      false,
    );
    assert.equal(
      pickBestQuestSmartCandidate(baseInput({ daily: [move({ progressPercent: 100, progress: 5000, target: 5000 })] }))?.type,
      undefined,
    );
    assert.equal(
      pickBestQuestSmartCandidate(baseInput({ daily: [move({ progress: 4990, target: 5000, progressPercent: 99.8 })] }))?.type ===
        'QUEST_NEAR_COMPLETE',
      false,
    );
    assert.equal(
      pickBestQuestSmartCandidate(baseInput({ now: new Date('2026-09-06T20:00:00'), daily: [move()] }))?.type ===
        'QUEST_NEAR_COMPLETE',
      false,
    );
    assert.equal(pickBestQuestSmartCandidate(baseInput({ loggedPain: true }))?.type === 'QUEST_NEAR_COMPLETE', false);
    assert.equal(pickBestQuestSmartCandidate(baseInput({ openedRecently: true }))?.type === 'QUEST_NEAR_COMPLETE', false);
  });
});

describe('QUEST_GOOD_WEATHER_WINDOW eligibility', () => {
  const goodWx = {
    category: 'good_outdoor',
    severity: 'calm',
    stale: false,
    bestOutdoorWindow: { start: '17:00', end: '18:30', startIso: '2026-09-06T17:00:00.000Z', endIso: '2026-09-06T18:30:00.000Z' },
  };

  it('requires active movement + outdoor-safe window + progress < 90%', () => {
    const best = pickBestQuestSmartCandidate(
      baseInput({
        now: new Date('2026-09-06T15:00:00'),
        daily: [move({ progressPercent: 40, progress: 2000, target: 5000 })],
        weather: goodWx,
      }),
    );
    assert.equal(best?.type, 'QUEST_GOOD_WEATHER_WINDOW');
  });

  it('suppresses rain / severe / no window / >=90% / no quest', () => {
    assert.notEqual(
      pickBestQuestSmartCandidate(
        baseInput({
          daily: [move({ progressPercent: 40, progress: 2000 })],
          weather: { category: 'rainy', severity: 'caution', stale: false, bestOutdoorWindow: null },
        }),
      )?.type,
      'QUEST_GOOD_WEATHER_WINDOW',
    );
    assert.notEqual(
      pickBestQuestSmartCandidate(
        baseInput({
          daily: [move({ progressPercent: 40, progress: 2000 })],
          weather: { category: 'storm', severity: 'avoid', stale: false, bestOutdoorWindow: goodWx.bestOutdoorWindow },
        }),
      )?.type,
      'QUEST_GOOD_WEATHER_WINDOW',
    );
    assert.notEqual(
      pickBestQuestSmartCandidate(
        baseInput({
          daily: [move({ progressPercent: 92, progress: 4600, target: 5000 })],
          weather: goodWx,
        }),
      )?.type,
      'QUEST_GOOD_WEATHER_WINDOW',
    );
    assert.equal(pickBestQuestSmartCandidate(baseInput({ daily: [], weather: goodWx })), null);
  });
});

describe('QUEST_COMEBACK eligibility', () => {
  it('fires for COMEBACK assignment in midday window', () => {
    const best = pickBestQuestSmartCandidate(
      baseInput({
        now: new Date('2026-09-06T12:00:00'),
        daily: [move({ targetSource: 'COMEBACK', progressPercent: 5, progress: 200, target: 4000 })],
      }),
    );
    assert.equal(best?.type, 'QUEST_COMEBACK');
    assert.equal(best.comebackMode, true);
  });

  it('suppresses after open / progress / non-comeback', () => {
    assert.notEqual(
      pickBestQuestSmartCandidate(
        baseInput({
          openedRecently: true,
          daily: [move({ targetSource: 'COMEBACK', progressPercent: 5, progress: 200, target: 4000 })],
        }),
      )?.type,
      'QUEST_COMEBACK',
    );
    assert.notEqual(
      pickBestQuestSmartCandidate(baseInput({ daily: [move({ targetSource: 'PERSONALIZED' })] }))?.type,
      'QUEST_COMEBACK',
    );
  });
});

describe('QUEST_MORNING_PLAN eligibility', () => {
  it('suppresses rare frequency and late morning / progress', () => {
    assert.notEqual(
      pickBestQuestSmartCandidate(
        baseInput({
          frequency: 'rare',
          now: new Date('2026-09-06T09:00:00'),
          daily: [move({ progressPercent: 0, progress: 0 })],
        }),
      )?.type,
      'QUEST_MORNING_PLAN',
    );
    assert.notEqual(
      pickBestQuestSmartCandidate(
        baseInput({
          now: new Date('2026-09-06T11:00:00'),
          daily: [move({ progressPercent: 0, progress: 0 })],
        }),
      )?.type,
      'QUEST_MORNING_PLAN',
    );
    assert.notEqual(
      pickBestQuestSmartCandidate(
        baseInput({
          now: new Date('2026-09-06T09:00:00'),
          daily: [move({ progressPercent: 45, progress: 2000 })],
        }),
      )?.type,
      'QUEST_MORNING_PLAN',
    );
  });

  it('allows balanced morning with history and no progress', () => {
    const best = pickBestQuestSmartCandidate(
      baseInput({
        frequency: 'balanced',
        now: new Date('2026-09-06T08:00:00'),
        daily: [move({ progressPercent: 0, progress: 0, target: 5000 })],
        hasQuestHistory: true,
      }),
    );
    assert.equal(best?.type, 'QUEST_MORNING_PLAN');
  });
});

describe('QUEST_WEEKLY_PROGRESS eligibility', () => {
  const week = {
    id: 'w1',
    key: 'weekly_steps',
    progressType: 'STEPS',
    status: 'ACTIVE',
    progress: 28000,
    target: 35000,
    progressPercent: 80,
    periodKey: '2026-W36',
  };

  it('only weekends before 19:00 at >=75%', () => {
    assert.equal(
      pickBestQuestSmartCandidate(
        baseInput({
          now: new Date('2026-09-05T15:00:00'), // Saturday
          daily: [move({ progressPercent: 10, progress: 500 })],
          weekly: [week],
        }),
      )?.type,
      'QUEST_WEEKLY_PROGRESS',
    );
    assert.notEqual(
      pickBestQuestSmartCandidate(
        baseInput({
          now: new Date('2026-09-04T15:00:00'), // Friday
          daily: [move({ progressPercent: 10, progress: 500 })],
          weekly: [week],
        }),
      )?.type,
      'QUEST_WEEKLY_PROGRESS',
    );
    assert.notEqual(
      pickBestQuestSmartCandidate(
        baseInput({
          now: new Date('2026-09-06T19:00:00'), // Sunday 19:00
          daily: [move({ progressPercent: 10, progress: 500 })],
          weekly: [week],
        }),
      )?.type,
      'QUEST_WEEKLY_PROGRESS',
    );
    assert.notEqual(
      pickBestQuestSmartCandidate(
        baseInput({
          now: new Date('2026-09-05T15:00:00'),
          daily: [move({ progressPercent: 10, progress: 500 })],
          weekly: [{ ...week, progressPercent: 74, progress: 25900 }],
        }),
      )?.type,
      'QUEST_WEEKLY_PROGRESS',
    );
  });
});

describe('single best candidate selection', () => {
  it('picks one type when multiple could qualify — near-complete beats weather', () => {
    const best = pickBestQuestSmartCandidate(
      baseInput({
        now: new Date('2026-09-06T15:00:00'),
        daily: [move({ progress: 4300, target: 5000, progressPercent: 86 })],
        weather: {
          category: 'excellent_outdoor',
          severity: 'calm',
          stale: false,
          bestOutdoorWindow: {
            start: '17:00',
            end: '18:30',
            startIso: '2026-09-06T17:00:00.000Z',
            endIso: '2026-09-06T18:30:00.000Z',
          },
        },
      }),
    );
    assert.equal(best?.type, 'QUEST_NEAR_COMPLETE');
  });
});

describe('revalidation reason codes', () => {
  it('near-complete cancels on evening / complete / trivial / recent open', () => {
    const payload = { templateKey: QUEST_SMART_TEMPLATE_KEYS.QUEST_NEAR_COMPLETE };
    assert.equal(
      revalidateQuestSmart(payload, {
        now: new Date('2026-09-06T20:05:00'),
        daily: [move()],
        weekly: [],
      }).reason,
      QUEST_SMART_REASON.QUEST_EVENING_PRESSURE_BLOCK,
    );
    assert.equal(
      revalidateQuestSmart(payload, {
        now: new Date('2026-09-06T15:00:00'),
        daily: [move({ status: 'COMPLETED', progressPercent: 100 })],
        weekly: [],
      }).reason,
      QUEST_SMART_REASON.QUEST_ALREADY_COMPLETE,
    );
    assert.equal(
      revalidateQuestSmart(payload, {
        now: new Date('2026-09-06T15:00:00'),
        openedRecently: true,
        daily: [move()],
        weekly: [],
      }).reason,
      QUEST_SMART_REASON.QUEST_APP_RECENTLY_OPENED,
    );
  });

  it('comeback cancels after user returns', () => {
    assert.equal(
      revalidateQuestSmart(
        { templateKey: QUEST_SMART_TEMPLATE_KEYS.QUEST_COMEBACK },
        {
          now: new Date('2026-09-06T15:00:00'),
          daily: [move({ targetSource: 'COMEBACK', progressPercent: 50, progress: 2000 })],
          weekly: [],
        },
      ).reason,
      QUEST_SMART_REASON.QUEST_COMEBACK_ALREADY_RESOLVED,
    );
  });

  it('weather window cancels when unsafe or missing', () => {
    assert.equal(
      revalidateQuestSmart(
        { templateKey: QUEST_SMART_TEMPLATE_KEYS.QUEST_GOOD_WEATHER_WINDOW },
        {
          now: new Date('2026-09-06T15:00:00'),
          daily: [move({ progressPercent: 40, progress: 2000 })],
          weekly: [],
          weather: { category: 'storm', severity: 'avoid', stale: false, bestOutdoorWindow: null },
        },
      ).reason,
      QUEST_SMART_REASON.QUEST_WEATHER_UNSAFE,
    );
  });
});

describe('privacy + copy stability', () => {
  it('weather analytics never expose GPS / exact temp', () => {
    assert.equal(weatherAnalyticsKey(null), 'NONE');
    assert.equal(
      weatherAnalyticsKey({
        category: 'good_outdoor',
        stale: false,
        bestOutdoorWindow: { start: '17:00', end: '18:30' },
      }),
      'GOOD_WINDOW',
    );
  });

  it('copy rotation is stable per user/day/type', () => {
    const variants = ['a', 'b', 'c'];
    const a = pickQuestCopyVariant(variants, 'u1', '2026-09-06', 'QUEST_NEAR_COMPLETE');
    const b = pickQuestCopyVariant(variants, 'u1', '2026-09-06', 'QUEST_NEAR_COMPLETE');
    assert.equal(a, b);
  });

  it('scoring is explainable and does not invent questFatigue', () => {
    const scored = scoreQuestSmartCandidate('QUEST_NEAR_COMPLETE', {
      progressBucket: 'P80_89',
      progressPercent: 88,
      preferredWindow: true,
    });
    assert.ok(scored.score > 78);
    assert.ok(scored.reasons.some((r) => r.includes('+10') || r.includes('+8')));
  });
});
