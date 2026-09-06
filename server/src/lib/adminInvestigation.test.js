import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectEnrichmentKeys,
  decisionLifecycle,
  enrichDecisions,
  resolveClientContext,
  telemetryCapability,
} from './clientContext.js';
import {
  APP_VERSION_POLICY,
} from './appVersionPolicy.js';
import {
  assertNoPrivacyFields,
  buildSanitizedTimeline,
  userDecisionNav,
} from './adminUserInvestigation.js';
import { DIRECT_ACTION_KEYS } from './notificationOutcomes.js';

const DECISION = {
  decisionId: 'notif_dec_1',
  userId: 'user-1',
  createdAt: '2026-09-06T10:00:00.000Z',
  result: 'SEND',
};

describe('client context resolution', () => {
  it('prefers NotificationOutcome over AppActivity', () => {
    const client = resolveClientContext(DECISION, {
      outcomes: [{ platform: 'ios', appVersion: '24.0.1' }],
      activities: [{
        userId: 'user-1',
        firstAt: '2026-09-06T10:00:00.000Z',
        lastAt: '2026-09-06T10:00:00.000Z',
        platform: 'android',
        appVersion: '23.0.8',
      }],
    });
    assert.equal(client.platform, 'ios');
    assert.equal(client.appVersion, '24.0.1');
    assert.equal(client.contextSource, 'notification_outcome');
  });

  it('uses nearest AppActivity around the decision, including same-day first/last', () => {
    const client = resolveClientContext(DECISION, {
      outcomes: [],
      activities: [{
        userId: 'user-1',
        firstAt: '2026-09-06T09:50:00.000Z',
        lastAt: '2026-09-06T18:00:00.000Z',
        platform: 'ios',
        appVersion: '24.0.1',
      }],
    });
    assert.equal(client.contextSource, 'nearest_app_activity');
    assert.equal(client.appVersion, '24.0.1');
  });

  it('picks the closer of activity before and after the decision', () => {
    const client = resolveClientContext(DECISION, {
      activities: [
        {
          userId: 'user-1',
          firstAt: '2026-09-05T10:00:00.000Z',
          lastAt: '2026-09-05T10:00:00.000Z',
          platform: 'android',
          appVersion: '23.0.8',
        },
        {
          userId: 'user-1',
          firstAt: '2026-09-06T10:05:00.000Z',
          lastAt: '2026-09-06T10:05:00.000Z',
          platform: 'ios',
          appVersion: '24.0.1',
        },
      ],
    });
    assert.equal(client.platform, 'ios');
    assert.equal(client.appVersion, '24.0.1');
    assert.equal(client.contextSource, 'nearest_app_activity');
  });

  it('falls back to latest AppActivity before the decision when nearest has no client fields', () => {
    const client = resolveClientContext(DECISION, {
      activities: [
        {
          userId: 'user-1',
          firstAt: '2026-09-06T10:01:00.000Z',
          lastAt: '2026-09-06T10:01:00.000Z',
        },
        {
          userId: 'user-1',
          firstAt: '2026-09-04T08:00:00.000Z',
          lastAt: '2026-09-04T08:00:00.000Z',
          platform: 'android',
          appVersion: '23.0.3',
        },
      ],
    });
    assert.equal(client.platform, 'android');
    assert.equal(client.appVersion, '23.0.3');
    assert.equal(client.contextSource, 'latest_app_activity_before');
  });

  it('returns unknown when no matching client context exists', () => {
    const client = resolveClientContext(DECISION, { outcomes: [], activities: [] });
    assert.equal(client.platform, null);
    assert.equal(client.appVersion, null);
    assert.equal(client.contextSource, null);
  });
});

describe('telemetry capability', () => {
  it('marks 23.0.8 as Brain yes / outcome no', () => {
    const cap = telemetryCapability('23.0.8', APP_VERSION_POLICY);
    assert.equal(cap.brainSync, true);
    assert.equal(cap.outcomeSync, false);
    assert.equal(cap.minimumOutcomeSyncVersion, '24.0.0');
  });

  it('marks 24.0.0 as both supported', () => {
    const cap = telemetryCapability('24.0.0');
    assert.equal(cap.brainSync, true);
    assert.equal(cap.outcomeSync, true);
  });

  it('marks unknown version as unknown capability', () => {
    const cap = telemetryCapability(null);
    assert.equal(cap.brainSync, null);
    assert.equal(cap.outcomeSync, null);
  });
});

describe('decision lifecycle', () => {
  it('does not fabricate missing stages', () => {
    const steps = decisionLifecycle({
      createdAt: '2026-09-06T10:00:00.000Z',
      result: 'SEND',
    }, []);
    assert.deepEqual(steps.map((row) => row.key), ['created']);
  });

  it('shows blocked path only', () => {
    const steps = decisionLifecycle({
      createdAt: '2026-09-06T10:00:00.000Z',
      result: 'BLOCKED',
      reason: 'quiet_hours',
    }, []);
    assert.deepEqual(steps.map((row) => row.key), ['created', 'evaluated', 'blocked']);
  });

  it('shows cancelled after revalidation', () => {
    const steps = decisionLifecycle({
      createdAt: '2026-09-06T10:00:00.000Z',
      scheduledAt: '2026-09-06T11:00:00.000Z',
      revalidatedAt: '2026-09-06T11:00:00.000Z',
      result: 'CANCELLED',
      reason: 'already_opened',
    }, []);
    assert.deepEqual(steps.map((row) => row.key), ['created', 'scheduled', 'revalidated', 'cancelled']);
  });

  it('allows actioned without opened', () => {
    const steps = decisionLifecycle({
      createdAt: '2026-09-06T10:00:00.000Z',
      scheduledAt: '2026-09-06T11:00:00.000Z',
      result: 'SEND',
    }, [{ outcome: 'actioned', occurredAt: '2026-09-06T11:01:00.000Z', actionKey: 'medication_taken' }]);
    assert.ok(steps.some((row) => row.key === 'actioned'));
    assert.equal(steps.some((row) => row.key === 'opened'), false);
    assert.equal(DIRECT_ACTION_KEYS.has('medication_taken'), true);
  });
});

describe('enrichment batching', () => {
  it('collects unique ids for a page', () => {
    const keys = collectEnrichmentKeys([
      { decisionId: 'notif_dec_1', userId: 'a' },
      { decisionId: 'notif_dec_2', userId: 'a' },
      { decisionId: 'notif_dec_3', userId: 'b' },
    ]);
    assert.deepEqual(keys.decisionIds, ['notif_dec_1', 'notif_dec_2', 'notif_dec_3']);
    assert.deepEqual(keys.userIds, ['a', 'b']);
  });

  it('paginates without N+1 queries', async () => {
    let outcomeCalls = 0;
    let activityCalls = 0;
    const page = Array.from({ length: 40 }, (_, i) => ({
      decisionId: `notif_dec_${i}`,
      userId: i % 2 ? 'user-a' : 'user-b',
      createdAt: '2026-09-06T10:00:00.000Z',
      result: 'SEND',
    }));
    await enrichDecisions(page, APP_VERSION_POLICY, {
      loadOutcomes: async (ids) => {
        outcomeCalls += 1;
        assert.equal(ids.length, 40);
        return [];
      },
      loadActivities: async (userIds) => {
        activityCalls += 1;
        assert.equal(userIds.length, 2);
        return [];
      },
    });
    assert.equal(outcomeCalls, 1);
    assert.equal(activityCalls, 1);
  });
});

describe('privacy and navigation', () => {
  it('timeline never includes chat text or health values', () => {
    const rows = buildSanitizedTimeline({
      chats: [{ createdAt: '2026-09-06T09:00:00.000Z', messages: [{ content: 'secret' }] }],
      medEvents: [{ occurredAt: '2026-09-06T09:10:00.000Z', medName: 'secret-med' }],
    });
    const leaked = assertNoPrivacyFields(rows);
    assert.deepEqual(leaked, []);
    assert.equal(JSON.stringify(rows).includes('secret'), false);
    assert.equal(rows[0].label, 'მედიკამენტების ფუნქცია გამოიყენეს');
  });

  it('user ↔ decision navigation preserves the other side', () => {
    assert.deepEqual(userDecisionNav('user_to_decision', { decisionId: 'notif_dec_1' }), {
      view: 'decision',
      decisionId: 'notif_dec_1',
    });
    assert.deepEqual(userDecisionNav('decision_to_user', { userId: 'user-1' }), {
      view: 'user',
      userId: 'user-1',
      profileTab: 'notifications',
    });
  });
});
