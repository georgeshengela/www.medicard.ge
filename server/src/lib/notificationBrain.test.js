// Notification Brain on the server: plans instead of runs, honest funnel, admin control (2026-10-11 audit).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildNotificationFunnel, buildTypePerformance, collapseDecisionPlans } from './adminAnalyticsV21.js';
import { BRAIN_FAMILIES, publicBrainConfig, sanitizeBrainConfig } from './notificationBrainConfig.js';
import { sanitizeDecisionInput } from './notificationDecisions.js';
import { classifyDecisionReason, decisionLifecycle } from './clientContext.js';

const T0 = Date.parse('2026-10-11T08:00:00Z');
const at = (min) => new Date(T0 + min * 60_000);
const row = (over) => ({
  decisionId: `notif_dec_${Math.random().toString(36).slice(2)}`,
  userId: 'u1',
  family: 'hydration',
  templateKey: 'engage-hydration',
  result: 'SEND',
  reason: null,
  createdAt: at(0),
  scheduledAt: at(120),
  ...over,
});

describe('Brain decisions → plans', () => {
  it('collapses one plan synced by every run (old phones) into one row and keeps every id', () => {
    const rows = [0, 1, 2, 3, 4].map((m) => row({ createdAt: at(m) }));
    const { plans, aliasOf } = collapseDecisionPlans(rows, T0);
    assert.equal(plans.length, 1);
    assert.equal(plans[0].ids.length, 5);
    for (const r of rows) assert.equal(aliasOf.get(r.decisionId), plans[0].decisionId);
    assert.equal(plans[0].decisionId, rows[4].decisionId, 'the latest run carries the id the notification had');
  });

  it('marks a plan replaced when a later run touched the same slot before its time', () => {
    const first = row({ createdAt: at(0), scheduledAt: at(24 * 60) });
    const moved = row({ createdAt: at(60), scheduledAt: at(25 * 60) });
    const { plans } = collapseDecisionPlans([first, moved], T0);
    const byId = new Map(plans.map((p) => [p.decisionId, p]));
    assert.equal(byId.get(first.decisionId).superseded, true);
    assert.equal(byId.get(moved.decisionId).superseded, false);
  });

  it('does not mark a plan replaced by one made after it fired', () => {
    const fired = row({ createdAt: at(0), scheduledAt: at(30) });
    const next = row({ createdAt: at(90), scheduledAt: at(180) });
    const { plans } = collapseDecisionPlans([fired, next], T0 + 200 * 60_000);
    assert.equal(plans.find((p) => p.decisionId === fired.decisionId).superseded, false);
  });

  it('counts the funnel on plans: planned, due, delivered (incl. outcomes on older ids), opened', () => {
    const runs = [0, 1, 2].map((m) => row({ createdAt: at(m), scheduledAt: at(30) }));
    const blocked = row({ result: 'BLOCKED', reason: 'user recently active', scheduledAt: null, family: 'checkin', templateKey: 'engage-checkin-mid' });
    const cancelled = row({ result: 'CANCELLED', reason: 'hydration_goal_near', family: 'stepsQuiet', templateKey: 'engage-steps-quiet', scheduledAt: at(600) });
    const pending = row({ family: 'reengage', templateKey: 'engage-reengage-2', scheduledAt: at(48 * 60) });
    const outcomes = [
      { decisionId: runs[0].decisionId, outcome: 'delivered', actionKey: '', occurredAt: at(30) },
      { decisionId: runs[2].decisionId, outcome: 'opened', actionKey: 'open', occurredAt: at(35) },
    ];
    const f = buildNotificationFunnel([...runs, blocked, cancelled, pending], outcomes, { now: T0 + 60 * 60_000 });
    assert.equal(f.rawRows, 6);
    assert.equal(f.evaluated, 4);
    assert.equal(f.scheduled, 3);
    assert.equal(f.due, 1);
    assert.equal(f.pending, 1);
    assert.equal(f.delivered, 1);
    assert.equal(f.opened, 1);
    assert.equal(f.suppressed, 1);
    assert.equal(f.cancelled, 1);
    assert.equal(f.people, 1);
  });

  it('attributes outcomes of plans made before the period to their family', () => {
    const types = buildTypePerformance(
      [row({})],
      [{ decisionId: 'notif_dec_old', outcome: 'opened', actionKey: 'open', occurredAt: at(10) }],
      null,
      null,
      { familyById: new Map([['notif_dec_old', 'reengage']]) },
    ).types;
    assert.equal(types.find((t) => t.family === 'reengage')?.opened, 1);
  });
});

describe('Brain admin control', () => {
  it('keeps only known families and a 1–4 ceiling', () => {
    const clean = sanitizeBrainConfig({ paused: 'yes', off: ['checkin', 'nope', 'checkin', 'sleep'], maxPerDay: 9 });
    assert.deepEqual(clean, { paused: false, off: ['checkin', 'sleep'], maxPerDay: null });
    assert.deepEqual(publicBrainConfig({ paused: true, off: ['weekly'], maxPerDay: 2, updatedBy: 'admin-id' }), { paused: true, off: ['weekly'], maxPerDay: 2 });
  });

  it('lists every family the phone can plan', () => {
    for (const family of ['checkin', 'morning', 'sleep', 'hydration', 'stepsQuiet', 'weatherWellness', 'questSmart', 'weekly', 'feature', 'insight', 'achievement', 'chat', 'question', 'unfinished', 'visitFollowup', 'reengage', 'birthday']) {
      assert.ok(BRAIN_FAMILIES.includes(family), family);
    }
  });
});

describe('decision rows from the phone', () => {
  it('accepts a cancellation of a plan and tags the new reasons', () => {
    const cancelled = sanitizeDecisionInput({ id: 'notif_dec_x', family: 'hydration', decision: 'CANCELLED', reason: 'no_longer_needed', scheduledAt: at(30).toISOString() });
    assert.equal(cancelled.result, 'CANCELLED');
    assert.deepEqual(classifyDecisionReason('admin_off'), ['admin']);
    assert.deepEqual(classifyDecisionReason('same_kind_today'), ['daily_cap']);
    assert.deepEqual(classifyDecisionReason('window_passed'), ['quiet_hours']);
    const steps = decisionLifecycle({ result: 'CANCELLED', createdAt: at(0), scheduledAt: at(30), updatedAt: at(20), reason: 'no_longer_needed' });
    assert.equal(steps.at(-1).key, 'cancelled');
    assert.equal(+new Date(steps.at(-1).at), +at(20));
  });
});
