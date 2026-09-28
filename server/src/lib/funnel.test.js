import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  ACCOUNT_EVENTS, FUNNEL_EVENT_NAMES, MAX_BATCH, batchSchema, buildFunnelReport, ingestFunnelEvents, installHashOf,
  linkInstallToUser, parseFunnelDays, sanitizeFunnelEvent, sourceKey,
} from './funnel.js';
import { funnelStatements } from '../../scripts/install-funnel.mjs';
import { optionalUserId } from '../routes/funnel.routes.js';
import jwt from 'jsonwebtoken';

const now = new Date('2026-09-28T10:00:00Z');
const at = (iso) => new Date(iso);

describe('funnel allow-list', () => {
  it('accepts every known event with its enum props', () => {
    const ok = [
      { name: 'app_first_open', props: { source: 'utm', utmSource: 'Instagram', utmCampaign: 'launch_1' } },
      { name: 'signup_completed', props: { method: 'phone' } },
      { name: 'onboarding_step_viewed', props: { stepKey: 'o2-goal' } },
      { name: 'onboarding_step_completed', props: { stepKey: 'notifications' } },
      { name: 'onboarding_completed', props: { primaryGoal: 'cycle' } },
      { name: 'first_health_action', props: { type: 'checkin_manual' } },
      { name: 'price_alert_opened' },
      { name: 'health_passport_created', props: {} },
      { name: 'referral_shared' },
    ];
    assert.equal(ok.length, FUNNEL_EVENT_NAMES.length);
    for (const e of ok) assert.ok(sanitizeFunnelEvent(e, { now, signedIn: true }), e.name);
    assert.equal(sanitizeFunnelEvent(ok[0], { now }).props.utmSource, 'instagram');
  });

  it('rejects unknown names, extra props, free text and health values', () => {
    const bad = [
      { name: 'weight_logged', props: { kg: 81 } },
      { name: 'first_health_action', props: { type: 'medication', medName: 'Metformin' } },
      { name: 'first_health_action', props: { type: 'insulin' } },
      { name: 'onboarding_completed', props: { primaryGoal: 'lose 10kg fast' } },
      { name: 'app_first_open', props: { source: 'utm', utmSource: 'has spaces and text' } },
      { name: 'price_alert_opened', props: { productId: 'p1' } },
      { name: 'signup_completed', props: { method: 'email' }, email: 'a@b.ge' },
      { name: 'app_first_open', props: { source: 'organic', utmCampaign: 'x'.repeat(300) } },
      null,
      'app_first_open',
    ];
    for (const e of bad) assert.equal(sanitizeFunnelEvent(e, { now, signedIn: true }), null, JSON.stringify(e)?.slice(0, 60));
  });

  it('keeps account events for signed-in requests only', () => {
    for (const name of ACCOUNT_EVENTS) {
      const props = name === 'signup_completed' ? { method: 'email' } : name === 'onboarding_completed' ? { primaryGoal: 'general' } : name === 'first_health_action' ? { type: 'meal' } : {};
      assert.equal(sanitizeFunnelEvent({ name, props }, { now, signedIn: false }), null, name);
    }
    assert.ok(sanitizeFunnelEvent({ name: 'app_first_open', props: { source: 'organic' } }, { now, signedIn: false }));
  });

  it('clamps future timestamps and drops stale ones', () => {
    const future = sanitizeFunnelEvent({ name: 'app_first_open', props: { source: 'organic' }, at: '2026-10-05T00:00:00Z' }, { now });
    assert.equal(future.createdAt.getTime(), now.getTime());
    assert.equal(sanitizeFunnelEvent({ name: 'app_first_open', props: { source: 'organic' }, at: '2026-07-01T00:00:00Z' }, { now }), null);
    assert.equal(sanitizeFunnelEvent({ name: 'app_first_open', props: { source: 'organic' }, at: 'nope' }, { now }), null);
  });

  it('caps the batch and requires an install id', () => {
    const event = { name: 'app_first_open', props: { source: 'organic' } };
    assert.equal(batchSchema.safeParse({ installId: 'inst_abcdef12', events: Array(MAX_BATCH).fill(event) }).success, true);
    assert.equal(batchSchema.safeParse({ installId: 'inst_abcdef12', events: Array(MAX_BATCH + 1).fill(event) }).success, false);
    assert.equal(batchSchema.safeParse({ installId: 'x', events: [event] }).success, false);
    assert.equal(batchSchema.safeParse({ installId: 'inst_abcdef12', events: [] }).success, false);
  });

  it('hashes install ids and never keeps the raw id', () => {
    assert.equal(installHashOf('short'), null);
    assert.match(installHashOf('inst_abcdef12'), /^[a-f0-9]{64}$/);
    assert.equal(installHashOf('inst_abcdef12'), installHashOf(' inst_abcdef12 '));
    assert.notEqual(installHashOf('inst_abcdef12'), installHashOf('inst_abcdef13'));
  });

  it('parses the admin period', () => {
    assert.equal(parseFunnelDays('7'), 7);
    assert.equal(parseFunnelDays('90'), 90);
    assert.equal(parseFunnelDays('365'), 30);
    assert.equal(parseFunnelDays(undefined), 30);
  });
});

function fakeDb() {
  const calls = [];
  const tag = (kind) => async (strings, ...values) => {
    calls.push({ kind, sql: strings.join('?'), values });
    return 1;
  };
  return { calls, $executeRaw: tag('exec') };
}

describe('funnel ingest and linking', () => {
  it('stores valid events, rejects the rest, and links the install after sign-in', async () => {
    const db = fakeDb();
    const result = await ingestFunnelEvents({
      userId: 'u1',
      installId: 'inst_abcdef12',
      events: [
        { name: 'signup_completed', props: { method: 'email' } },
        { name: 'weight_logged', props: { kg: 80 } },
      ],
      meta: { platform: 'ios', appVersion: '1.0.0.14.0' },
    }, { db, now });
    assert.deepEqual({ accepted: result.accepted, rejected: result.rejected, linked: result.linked }, { accepted: 1, rejected: 1, linked: 1 });
    const insert = db.calls.find((c) => c.sql.includes('INSERT INTO "FunnelEvent"'));
    assert.match(insert.sql, /ON CONFLICT DO NOTHING/);
    assert.ok(insert.values.includes('u1') && insert.values.includes(installHashOf('inst_abcdef12')));
    assert.ok(!insert.values.includes('inst_abcdef12'), 'raw install id must not be stored');
    const link = db.calls.find((c) => c.sql.startsWith('UPDATE "FunnelEvent"'));
    assert.match(link.sql, /"userId" IS NULL/);
    assert.deepEqual(link.values, ['u1', installHashOf('inst_abcdef12')]);
  });

  it('anonymous batches never link and drop account events', async () => {
    const db = fakeDb();
    const result = await ingestFunnelEvents({
      installId: 'inst_abcdef12',
      events: [{ name: 'app_first_open', props: { source: 'invite' } }, { name: 'first_health_action', props: { type: 'meal' } }],
    }, { db, now });
    assert.equal(result.accepted, 1);
    assert.equal(result.linked, 0);
    assert.equal(db.calls.filter((c) => c.sql.startsWith('UPDATE')).length, 0);
    assert.equal(await linkInstallToUser(null, 'h', { db }), 0);
  });

  it('reports installed:false when the table is not there yet', async () => {
    const db = { $executeRaw: async () => { throw Object.assign(new Error('relation "FunnelEvent" does not exist'), { code: 'P2010' }); } };
    const result = await ingestFunnelEvents({ installId: 'inst_abcdef12', events: [{ name: 'app_first_open', props: { source: 'organic' } }] }, { db, now });
    assert.equal(result.installed, false);
  });

  it('resolves the optional user from a user token only', async () => {
    const secret = 'test-secret';
    const db = { user: { findUnique: async ({ where }) => (where.id === 'u1' ? { id: 'u1', status: 'ACTIVE' } : where.id === 'b1' ? { id: 'b1', status: 'BLOCKED' } : null) } };
    const req = (token) => ({ headers: token ? { authorization: `Bearer ${token}` } : {} });
    assert.equal(await optionalUserId(req(jwt.sign({ sub: 'u1' }, secret)), { db, secret }), 'u1');
    assert.equal(await optionalUserId(req(jwt.sign({ sub: 'b1' }, secret)), { db, secret }), null);
    assert.equal(await optionalUserId(req(jwt.sign({ sub: 'u1', role: 'admin' }, secret)), { db, secret }), null);
    assert.equal(await optionalUserId(req('garbage'), { db, secret }), null);
    assert.equal(await optionalUserId(req(null), { db, secret }), null);
  });
});

describe('funnel report', () => {
  const ev = (name, userId, installHash, props, iso) => ({ name, userId, installHash, props, createdAt: at(iso) });
  const periodEvents = [
    ev('app_first_open', 'u1', 'h1', { source: 'utm', utmSource: 'instagram', utmCampaign: 'launch' }, '2026-09-25T08:00:00Z'),
    ev('app_first_open', 'u2', 'h2', { source: 'invite' }, '2026-09-25T09:00:00Z'),
    ev('app_first_open', null, 'h3', { source: 'organic' }, '2026-09-26T09:00:00Z'),
    ev('signup_completed', 'u1', 'h1', { method: 'email' }, '2026-09-25T08:05:00Z'),
    ev('signup_completed', 'u2', 'h2', { method: 'phone' }, '2026-09-25T09:05:00Z'),
    ev('onboarding_step_viewed', 'u1', 'h1', { stepKey: 'o1-gender' }, '2026-09-25T08:06:00Z'),
    ev('onboarding_step_completed', 'u1', 'h1', { stepKey: 'o1-gender' }, '2026-09-25T08:07:00Z'),
    ev('onboarding_step_viewed', 'u2', 'h2', { stepKey: 'o1-gender' }, '2026-09-25T09:06:00Z'),
    ev('onboarding_completed', 'u1', 'h1', { primaryGoal: 'nutrition' }, '2026-09-25T08:10:00Z'),
    ev('first_health_action', 'u1', 'h1', { type: 'meal' }, '2026-09-25T12:00:00Z'),
    ev('referral_shared', 'u1', 'h1', {}, '2026-09-26T12:00:00Z'),
  ];
  const cohortEvents = periodEvents.filter((e) => e.userId);
  const report = buildFunnelReport({
    periodEvents,
    cohortEvents,
    activityRows: [{ userId: 'u1', date: '2026-09-26' }],
    days: 7,
    today: '2026-09-28',
  });

  it('counts each step with conversion from the previous one', () => {
    assert.deepEqual(report.steps.map((s) => s.count), [3, 2, 2, 1, 1, 1]);
    assert.equal(report.steps[1].fromPrevious, 66.7);
    assert.equal(report.steps[3].fromPrevious, 50);
    assert.equal(report.steps[5].eligible, 2);
  });

  it('splits by source and by door (primaryGoal)', () => {
    const utm = report.sources.find((s) => s.key === 'utm:instagram/launch');
    assert.deepEqual([utm.installs, utm.signups, utm.activated, utm.d1], [1, 1, 1, 1]);
    assert.equal(report.sources.find((s) => s.key === 'organic').signups, 0);
    const nutrition = report.goals.find((g) => g.goal === 'nutrition');
    assert.deepEqual([nutrition.users, nutrition.activated, nutrition.actions.meal, nutrition.d1Rate], [1, 1, 1, 100]);
    assert.equal(sourceKey({ source: 'bogus' }), 'unknown');
  });

  it('shows onboarding drop-off and feature events', () => {
    const gender = report.onboarding.find((s) => s.stepKey === 'o1-gender');
    assert.deepEqual([gender.viewed, gender.completed, gender.completionRate], [2, 1, 50]);
    assert.equal(report.features.find((f) => f.name === 'referral_shared').users, 1);
    assert.equal(report.trend.installs.length, 7);
  });
});

describe('funnel install script', () => {
  it('ships only additive statements on the funnel table', () => {
    const sql = readFileSync(new URL('../../prisma/20260928-funnel.sql', import.meta.url), 'utf8');
    assert.ok(funnelStatements(sql).length >= 5);
    assert.throws(() => funnelStatements('DROP TABLE "FunnelEvent";'));
    assert.throws(() => funnelStatements('CREATE TABLE IF NOT EXISTS "User" (id TEXT);'));
    const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
    // release runs `npm run db:install` (see installChain.test.js); the chain holds the script.
    assert.match(pkg.scripts['db:install'], /install-funnel\.mjs/);
    assert.match(readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8'), /^model FunnelEvent \{/m);
  });
});
