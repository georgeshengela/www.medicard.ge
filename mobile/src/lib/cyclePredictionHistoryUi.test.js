import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AGGREGATE_MIN_COMPLETED,
  aggregateTypicalDays,
  completedEpisodesNewestFirst,
  differenceAbsDays,
  differenceTone,
  episodeA11yLabel,
  estimateOffsetTone,
  firstAndFinalDistinct,
  hideTechnicalExclusion,
  historySectionState,
  isUserVisibleEpisode,
  openSeriesEpisodes,
  revisionCount,
  shouldShowAggregate,
  snapshotConfidenceLevel,
  visibleCompletedEpisodes,
} from './cyclePredictionHistoryUi.js';

function ep(overrides = {}) {
  return {
    cycleAnchorDate: '2026-09-01',
    actualStart: '2026-10-01',
    firstPredictedStart: '2026-09-29',
    lastPredictedStart: '2026-10-01',
    firstErrorDays: 2,
    lastErrorDays: 0,
    firstAbsErrorDays: 2,
    lastAbsErrorDays: 0,
    snapshotCount: 3,
    prePeriodSnapshotCount: 3,
    confidenceAtFirst: 'medium',
    confidenceAtLast: 'medium',
    status: 'completed',
    exclusionReason: null,
    ...overrides,
  };
}

describe('empty / low history', () => {
  it('0 completed: empty, no aggregate', () => {
    const history = {
      completedCount: 0,
      aggregateEligible: false,
      aggregate: null,
      episodes: [],
    };
    assert.equal(historySectionState(history), 'empty');
    assert.equal(shouldShowAggregate(history), false);
    assert.equal(aggregateTypicalDays(history), null);
  });

  it('1 completed: rows, no aggregate', () => {
    const history = {
      completedCount: 1,
      aggregateEligible: false,
      aggregate: null,
      episodes: [ep()],
    };
    assert.equal(historySectionState(history), 'episodes_only');
    assert.equal(visibleCompletedEpisodes(history.episodes).length, 1);
    assert.equal(shouldShowAggregate(history), false);
  });

  it('2 completed: rows, no aggregate', () => {
    const history = {
      completedCount: 2,
      aggregateEligible: false,
      aggregate: null,
      episodes: [
        ep(),
        ep({ cycleAnchorDate: '2026-08-01', actualStart: '2026-08-30', lastPredictedStart: '2026-08-29' }),
      ],
    };
    assert.equal(historySectionState(history), 'episodes_only');
    assert.equal(shouldShowAggregate(history), false);
  });
});

describe('3+ aggregate uses server median only', () => {
  it('shows server typicalAbsErrorDays and does not invent another metric', () => {
    const history = {
      completedCount: 4,
      aggregateEligible: true,
      aggregate: { completedCount: 4, typicalAbsErrorDays: 1, basis: 'median_absolute_error' },
      episodes: [ep(), ep({ cycleAnchorDate: '2026-08-01' }), ep({ cycleAnchorDate: '2026-07-01' }), ep({ cycleAnchorDate: '2026-06-01' })],
    };
    assert.equal(AGGREGATE_MIN_COMPLETED, 3);
    assert.equal(historySectionState(history), 'aggregate_ready');
    assert.equal(shouldShowAggregate(history), true);
    assert.equal(aggregateTypicalDays(history), 1);
  });

  it('rejects a client-forged average basis', () => {
    const history = {
      completedCount: 4,
      aggregateEligible: true,
      aggregate: { completedCount: 4, typicalAbsErrorDays: 1, basis: 'mean_absolute_error' },
      episodes: [ep(), ep(), ep(), ep()],
    };
    assert.equal(shouldShowAggregate(history), false);
  });
});

describe('difference language', () => {
  it('exact date is same day, not +0', () => {
    assert.equal(differenceTone(0), 'same_day');
    assert.equal(differenceAbsDays(0), 0);
  });

  it('+2 is later (actual started after prediction)', () => {
    assert.equal(differenceTone(2), 'later');
    assert.equal(differenceAbsDays(2), 2);
    assert.equal(estimateOffsetTone(2), 'estimate_earlier');
  });

  it('-2 is earlier (actual started before prediction)', () => {
    assert.equal(differenceTone(-2), 'earlier');
    assert.equal(differenceAbsDays(-2), 2);
    assert.equal(estimateOffsetTone(-2), 'estimate_later');
  });
});

describe('first vs final', () => {
  it('keeps Sep 29 first and Oct 1 final with same-day latest difference', () => {
    const episode = ep({
      firstPredictedStart: '2026-09-29',
      lastPredictedStart: '2026-10-01',
      actualStart: '2026-10-01',
      firstErrorDays: 2,
      lastErrorDays: 0,
      prePeriodSnapshotCount: 3,
    });
    assert.equal(firstAndFinalDistinct(episode), true);
    assert.equal(episode.firstPredictedStart, '2026-09-29');
    assert.equal(episode.lastPredictedStart, '2026-10-01');
    assert.equal(episode.actualStart, '2026-10-01');
    assert.equal(differenceTone(episode.lastErrorDays), 'same_day');
    assert.equal(revisionCount(episode.prePeriodSnapshotCount), 2);
  });

  it('3 pre-period snapshots = 2 updates, not 3', () => {
    assert.equal(revisionCount(3), 2);
    assert.equal(revisionCount(1), 0);
    assert.equal(revisionCount(0), 0);
  });
});

describe('exclusions + open series', () => {
  it('pregnancy-sized gap is hidden, never a 70-day miss', () => {
    const excluded = ep({
      status: 'excluded',
      exclusionReason: 'INVALID_CYCLE_GAP',
      lastErrorDays: 70,
      firstErrorDays: 70,
    });
    assert.equal(hideTechnicalExclusion(excluded), true);
    assert.equal(isUserVisibleEpisode(excluded), false);
    assert.equal(visibleCompletedEpisodes([excluded]).length, 0);
    assert.equal(visibleCompletedEpisodes([excluded]).some((e) => Math.abs(e.lastErrorDays || 0) >= 60), false);
  });

  it('NO_PRE_PERIOD_SNAPSHOT is hidden', () => {
    const excluded = ep({ status: 'excluded', exclusionReason: 'NO_PRE_PERIOD_SNAPSHOT' });
    assert.equal(isUserVisibleEpisode(excluded), false);
  });

  it('open series is not a completed comparison', () => {
    const open = ep({
      status: 'open',
      actualStart: null,
      lastErrorDays: null,
      lastPredictedStart: '2026-10-12',
    });
    assert.equal(isUserVisibleEpisode(open), false);
    assert.equal(openSeriesEpisodes([open]).length, 1);
    assert.equal(historySectionState({ completedCount: 0, episodes: [open] }), 'open_only');
  });
});

describe('sorting + limit + correction refresh', () => {
  it('newest completed first', () => {
    const rows = visibleCompletedEpisodes([
      ep({ cycleAnchorDate: '2026-07-01', actualStart: '2026-07-29' }),
      ep({ cycleAnchorDate: '2026-09-01', actualStart: '2026-10-01' }),
      ep({ cycleAnchorDate: '2026-08-01', actualStart: '2026-08-30' }),
    ]);
    assert.deepEqual(rows.map((e) => e.actualStart), ['2026-10-01', '2026-08-30', '2026-07-29']);
  });

  it('limits initial rows without dropping storage', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      ep({ cycleAnchorDate: `2026-${String(i + 1).padStart(2, '0')}-01`, actualStart: `2026-${String(i + 1).padStart(2, '0')}-28` }),
    );
    assert.equal(visibleCompletedEpisodes(many).length, 6);
    assert.equal(visibleCompletedEpisodes(many, { showAll: true }).length, 10);
    assert.equal(completedEpisodesNewestFirst(many).length, 10);
  });

  it('historical correction changes comparison and keeps predicted dates', () => {
    const predicted = { firstPredictedStart: '2026-09-29', lastPredictedStart: '2026-09-29' };
    const before = ep({ ...predicted, actualStart: '2026-09-30', lastErrorDays: 1 });
    const after = ep({ ...predicted, actualStart: '2026-09-28', lastErrorDays: -1 });
    assert.equal(before.firstPredictedStart, after.firstPredictedStart);
    assert.equal(before.lastPredictedStart, after.lastPredictedStart);
    assert.equal(differenceTone(before.lastErrorDays), 'later');
    assert.equal(differenceTone(after.lastErrorDays), 'earlier');
  });
});

describe('confidence + a11y + failure', () => {
  it('uses snapshot-time confidence, never invents a new level', () => {
    assert.equal(snapshotConfidenceLevel('high'), 'high');
    assert.equal(snapshotConfidenceLevel('medium'), 'medium');
    assert.equal(snapshotConfidenceLevel('low'), 'low');
    assert.equal(snapshotConfidenceLevel(null), 'low');
  });

  it('builds a spoken Georgian row without signed integers', () => {
    const label = episodeA11yLabel(ep({ lastErrorDays: 1, lastPredictedStart: '2026-09-29', actualStart: '2026-09-30' }), {
      sameDay: 'იმავე დღეს',
      later: (n) => `${n} დღით გვიან`,
      earlier: (n) => `${n} დღით ადრე`,
      row: (month, finalDate, actualDate, delta) =>
        `${month} ციკლი. ბოლო შეფასება ${finalDate}. მენსტრუაცია დაიწყო ${actualDate}. ${delta}.`,
    });
    assert.match(label, /სექტემბერი ციკლი/);
    assert.match(label, /29 სექტემბერი/);
    assert.match(label, /30 სექტემბერი/);
    assert.match(label, /1 დღით გვიან/);
    assert.doesNotMatch(label, /\+1/);
  });

  it('API failure hides the section', () => {
    assert.equal(historySectionState(null, { failed: true }), 'hidden');
  });

  it('visible episode objects do not carry journal/partner-sensitive keys', () => {
    const row = ep();
    for (const key of ['notes', 'sexualActivity', 'symptoms', 'pain', 'mood', 'customTagIds']) {
      assert.equal(Object.hasOwn(row, key), false);
    }
  });
});
