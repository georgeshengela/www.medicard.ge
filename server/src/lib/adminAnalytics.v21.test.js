import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAppVersion,
  compareAppVersions,
  isAppVersionBelow,
} from './appVersion.js';
import {
  sanitizeOutcomeInput,
  mapNotificationActionKey,
  outcomeFromActionKey,
  medianMs,
  DIRECT_ACTION_KEYS,
} from './notificationOutcomes.js';
import { sanitizeProductEventInput } from './productEvents.js';
import { sanitizeDoseEventInput } from './medicationDoseEvents.js';
import { sanitizePermissionStatus } from './notificationPermission.js';
import {
  rateVisible,
  buildNotificationFunnel,
  buildTypePerformance,
  outcomeLatency,
  RATE_MIN_DENOMINATOR,
  countOrphanOutcomes,
  weeklyReportMetrics,
} from './adminAnalyticsV21.js';
import { parseAnalyticsRange, tbilisiYmd } from './adminAnalyticsRange.js';

describe('app version parsing', () => {
  it('parses Expo versions and compares them', () => {
    assert.deepEqual(parseAppVersion('24.0.0'), { raw: '24.0.0', major: 24, minor: 0, patch: 0 });
    assert.equal(compareAppVersions('23.0.3', '24.0.0') < 0, true);
    assert.equal(isAppVersionBelow('23.0.2', '23.0.3'), true);
    assert.equal(isAppVersionBelow('24.0.0', '23.0.3'), false);
    assert.equal(parseAppVersion('nope'), null);
  });
});

describe('notification outcome sanitizer', () => {
  it('drops rows without notif_dec_ and never keeps title/body/health', () => {
    assert.equal(sanitizeOutcomeInput({ id: 'x', outcome: 'opened' }, 'u1'), null);
    const row = sanitizeOutcomeInput({
      decisionId: 'notif_dec_1',
      outcome: 'actioned',
      actionKey: 'medication_taken',
      title: 'secret',
      body: 'secret',
      ml: 2000,
    }, 'u1');
    assert.equal(row.decisionId, 'notif_dec_1');
    assert.equal(row.actionKey, 'medication_taken');
    assert.equal(row.title, undefined);
    assert.equal(row.body, undefined);
    assert.equal(row.ml, undefined);
  });

  it('maps lock-screen actions and allows action without open', () => {
    assert.equal(mapNotificationActionKey('TAKE'), 'medication_taken');
    assert.equal(outcomeFromActionKey('medication_taken'), 'actioned');
    assert.equal(DIRECT_ACTION_KEYS.has('medication_taken'), true);
    const funnel = buildNotificationFunnel(
      [{ decisionId: 'notif_dec_1', result: 'SEND', scheduledAt: new Date(), family: 'hydration' }],
      [{ decisionId: 'notif_dec_1', outcome: 'actioned', actionKey: 'hydration_logged', occurredAt: new Date() }],
    );
    assert.equal(funnel.actioned, 1);
    assert.equal(funnel.opened, 0);
    assert.equal(funnel.delivered, 1);
    assert.equal(funnel.directActioned, 1);
  });

  it('rejects future timestamps and unknown actioned without key', () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    assert.equal(sanitizeOutcomeInput({ decisionId: 'notif_dec_1', outcome: 'opened', occurredAt: future }, 'u1'), null);
    assert.equal(sanitizeOutcomeInput({ decisionId: 'notif_dec_1', outcome: 'actioned' }, 'u1'), null);
  });
});

describe('rates and latency', () => {
  it('hides percentages for tiny denominators and handles zero', () => {
    assert.equal(rateVisible(1, 0).hidden, true);
    assert.equal(rateVisible(1, RATE_MIN_DENOMINATOR - 1).hidden, true);
    assert.equal(rateVisible(2, 10).value, 20);
  });

  it('uses earliest occurredAt for out-of-order latency', () => {
    const t0 = new Date('2026-09-06T10:00:00Z');
    const t1 = new Date('2026-09-06T10:05:00Z');
    const latency = outcomeLatency([
      { decisionId: 'notif_dec_1', outcome: 'opened', occurredAt: t1 },
      { decisionId: 'notif_dec_1', outcome: 'delivered', occurredAt: t0 },
      { decisionId: 'notif_dec_1', outcome: 'actioned', occurredAt: t0 },
    ]);
    assert.equal(latency.deliveredToOpenedMedianMs, 5 * 60_000);
    assert.equal(latency.deliveredToActionedMedianMs, 0);
  });

  it('median ignores negative gaps', () => {
    assert.equal(medianMs([-5, 10, 20]), 15);
    assert.equal(medianMs([]), null);
  });
});

describe('type performance and orphans', () => {
  it('computes per-family rates and previous-period delta', () => {
    const now = new Date();
    const current = buildTypePerformance(
      [{ decisionId: 'notif_dec_a', family: 'hydration', result: 'SEND', scheduledAt: now }],
      [{ decisionId: 'notif_dec_a', outcome: 'opened', actionKey: 'open', occurredAt: now }],
      [{ decisionId: 'notif_dec_b', family: 'hydration', result: 'SEND', scheduledAt: now }],
      [],
    );
    assert.equal(current.types[0].opened, 1);
    assert.equal(current.types[0].delta.opened.show, false);
  });
});

describe('weekly report / dose / permission sanitizers', () => {
  it('keeps only kind + entity id', () => {
    const row = sanitizeProductEventInput({
      kind: 'weekly_report_opened',
      weekKey: '2026-08-31',
      title: 'secret',
    }, 'u1');
    assert.equal(row.kind, 'weekly_report_opened');
    assert.equal(row.entityId, '2026-08-31');
    assert.equal(row.title, undefined);
  });

  it('stores dose status without a name field', () => {
    const row = sanitizeDoseEventInput({
      medicationId: 'med-1',
      date: '2026-09-06',
      time: '08:00',
      status: 'taken',
      source: 'notification',
      name: 'Aspirin',
    }, 'u1');
    assert.equal(row.status, 'taken');
    assert.equal(row.name, undefined);
  });

  it('normalizes permission transitions', () => {
    assert.equal(sanitizePermissionStatus('granted'), 'enabled');
    assert.equal(sanitizePermissionStatus('denied'), 'disabled');
    assert.equal(sanitizePermissionStatus('provisional'), 'provisional');
    assert.equal(sanitizePermissionStatus('nope'), null);
  });
});

describe('orphan outcomes and weekly attribution', () => {
  it('counts outcomes whose decisionId is missing', () => {
    assert.equal(
      countOrphanOutcomes(
        [{ decisionId: 'notif_dec_1' }],
        [
          { decisionId: 'notif_dec_1', outcome: 'opened' },
          { decisionId: 'notif_dec_missing', outcome: 'actioned' },
        ],
      ),
      1,
    );
  });

  it('attributes weekly opens to generated reports and Brain SEND separately', () => {
    const metrics = weeklyReportMetrics(
      [
        { kind: 'weekly_report_generated' },
        { kind: 'weekly_report_opened' },
      ],
      [
        { family: 'weekly', result: 'SEND' },
        { family: 'weekly', result: 'SEND' },
        { family: 'weekly', result: 'BLOCKED' },
      ],
    );
    assert.equal(metrics.generated, 1);
    assert.equal(metrics.opened, 1);
    assert.equal(metrics.sent, 2);
    assert.equal(metrics.openRate.hidden, true);
    assert.equal(metrics.notificationOpenRate.hidden, true);
    const enough = weeklyReportMetrics(
      Array.from({ length: 6 }, () => ({ kind: 'weekly_report_generated' })).concat(
        Array.from({ length: 3 }, () => ({ kind: 'weekly_report_opened' })),
      ),
      Array.from({ length: 10 }, () => ({ family: 'weekly', result: 'SEND' })),
    );
    assert.equal(enough.openRate.value, 50);
    assert.equal(enough.notificationOpenRate.value, 30);
  });
});

describe('timezone boundary for activity days', () => {
  it('keeps today as a Tbilisi calendar day', () => {
    const now = new Date('2026-09-06T01:30:00+04:00');
    const range = parseAnalyticsRange({ range: 'today' }, now);
    assert.equal(range.fromYmd, '2026-09-06');
    assert.equal(tbilisiYmd(now), '2026-09-06');
    const beforeMidnight = new Date('2026-09-05T23:30:00+04:00');
    assert.equal(tbilisiYmd(beforeMidnight), '2026-09-05');
  });
});
