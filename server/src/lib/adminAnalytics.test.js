import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysYmd,
  deltaSafe,
  enumerateYmds,
  fillDaySeries,
  parseAnalyticsRange,
  rateSafe,
  tbilisiYmd,
  tbilisiMidnight,
} from './adminAnalyticsRange.js';
import { sanitizeDecisionInput } from './notificationDecisions.js';
import { METRIC_DEFINITIONS } from './adminAnalyticsRange.js';
import { featureShareOfActive } from './adminCommandCenter.js';

describe('parseAnalyticsRange', () => {
  const now = new Date('2026-09-06T12:00:00+04:00');

  it('uses inclusive Tbilisi days for 7d and a matching previous window', () => {
    const range = parseAnalyticsRange({ range: '7d' }, now);
    assert.equal(range.fromYmd, '2026-08-31');
    assert.equal(range.toYmd, '2026-09-06');
    assert.equal(range.dayCount, 7);
    assert.equal(range.prevFromYmd, '2026-08-24');
    assert.equal(range.prevToYmd, '2026-08-30');
    assert.equal(range.timezone, 'Asia/Tbilisi');
    assert.deepEqual(range.days[0], '2026-08-31');
    assert.deepEqual(range.days[6], '2026-09-06');
  });

  it('keeps today as a single-day range compared to yesterday', () => {
    const range = parseAnalyticsRange({ range: 'today' }, now);
    assert.equal(range.fromYmd, '2026-09-06');
    assert.equal(range.toYmd, '2026-09-06');
    assert.equal(range.prevFromYmd, '2026-09-05');
    assert.equal(range.prevToYmd, '2026-09-05');
    assert.equal(range.fromDt.toISOString(), tbilisiMidnight('2026-09-06').toISOString());
  });

  it('expands 30d to one point per day, not a single bucket', () => {
    const range = parseAnalyticsRange({ range: '30d' }, now);
    assert.equal(range.dayCount, 30);
    assert.equal(range.days.length, 30);
    assert.equal(range.fromYmd, '2026-08-08');
  });

  it('rejects inverted custom ranges', () => {
    assert.throws(
      () => parseAnalyticsRange({ range: 'custom', from: '2026-09-06', to: '2026-09-01' }, now),
      /from must be on or before to/,
    );
  });
});

describe('deltaSafe / rateSafe', () => {
  it('hides percentage noise when both sides are tiny', () => {
    const hidden = deltaSafe(1, 0);
    assert.equal(hidden.show, false);
    assert.equal(hidden.pct, null);
    const shown = deltaSafe(12, 8);
    assert.equal(shown.show, true);
    assert.equal(shown.abs, 4);
    assert.equal(shown.pct, 50);
  });

  it('returns null rates when the denominator is zero', () => {
    assert.equal(rateSafe(3, 0), null);
    assert.equal(rateSafe(1, 4), 25);
  });
});

describe('day series', () => {
  it('fills missing days with zero instead of dropping them', () => {
    const days = enumerateYmds('2026-09-04', '2026-09-06');
    const series = fillDaySeries(days, [{ createdAt: '2026-09-05T10:00:00+04:00' }], (row) =>
      tbilisiYmd(new Date(row.createdAt)),
    );
    assert.deepEqual(series, [
      { day: '2026-09-04', count: 0 },
      { day: '2026-09-05', count: 1 },
      { day: '2026-09-06', count: 0 },
    ]);
  });

  it('adds calendar days without crossing month bugs', () => {
    assert.equal(addDaysYmd('2026-08-31', 1), '2026-09-01');
  });
});

describe('sanitizeDecisionInput', () => {
  it('drops decisions without a notif_dec_ id and never keeps free text vars', () => {
    assert.equal(sanitizeDecisionInput({ id: 'x', family: 'hydration' }), null);
    const row = sanitizeDecisionInput({
      id: 'notif_dec_abc',
      family: 'hydration',
      decision: 'SKIP',
      reason: 'hydration_target_reached',
      vars: { ml: 2000 },
      userPrompt: 'secret',
    });
    assert.equal(row.result, 'BLOCKED');
    assert.equal(row.reason, 'hydration_target_reached');
    assert.equal(row.vars, undefined);
    assert.equal(row.userPrompt, undefined);
  });
});

describe('metric definitions', () => {
  it('documents every command-center KPI against a real source', () => {
    assert.match(METRIC_DEFINITIONS.activeToday, /AppActivity/);
    assert.match(METRIC_DEFINITIONS.newUsers, /User\.createdAt/);
    assert.match(METRIC_DEFINITIONS.mediConversations, /ChatSession/);
    assert.match(METRIC_DEFINITIONS.notificationsDelivered, /PushEvent/);
  });
});

describe('feature share of active users', () => {
  it('uses the same user grain and cannot exceed 100%', () => {
    const share = featureShareOfActive(
      ['feat-only', 'shared', 'shared'],
      ['shared', 'active-only'],
    );
    assert.equal(share.amongActive, 1);
    assert.equal(share.activeUsers, 2);
    assert.equal(share.pctOfActive, 50);
    assert.ok(share.pctOfActive <= 100);
  });
});
