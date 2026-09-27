import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCEPTED_PUSH_SEGMENTS,
  CAMPAIGN_MAX_AGE_MS,
  PUSH_SEGMENTS,
  campaignPayload,
  nextPushCampaign,
  normalizePushSegment,
  processPushCampaigns,
  queuePushCampaign,
  runPushCampaign,
  segmentTokenWhere,
} from './pushCampaigns.js';

const NOW = new Date('2026-09-28T10:00:00Z');
const tok = (i) => `ExponentPushToken[device-${String(i).padStart(3, '0')}]`;

/** In-memory stand-in for the two Prisma models the worker touches. */
function fakeDb({ tokens = 0, campaigns = [] } = {}) {
  const tokenRows = Array.from({ length: tokens }, (_, i) => ({ id: `t${String(i).padStart(4, '0')}`, token: tok(i), active: true }));
  const updates = [];
  const deactivated = [];
  const rows = campaigns.map((c) => ({ ...c }));
  return {
    tokenRows,
    updates,
    deactivated,
    rows,
    pushToken: {
      count: async () => tokenRows.filter((r) => r.active).length,
      findMany: async ({ where, take }) => {
        const gt = where.id?.gt;
        return tokenRows.filter((r) => r.active && (!gt || r.id > gt)).slice(0, take).map(({ id, token }) => ({ id, token }));
      },
      updateMany: async ({ where }) => {
        for (const row of tokenRows) if (where.token.in.includes(row.token)) row.active = false;
        deactivated.push(...where.token.in);
      },
    },
    pushCampaign: {
      create: async ({ data }) => {
        const row = { id: `c${rows.length + 1}`, createdAt: NOW, sentCount: 0, failedCount: 0, ...data };
        rows.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        updates.push(structuredClone(data));
        const row = rows.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
      findMany: async ({ where }) => rows.filter((r) => where.status.in.includes(r.status)),
    },
  };
}

function expoFetch({ stale = [], statuses = [] } = {}) {
  const calls = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const impl = async (url, options) => {
    if (url.includes('getReceipts')) return { ok: true, json: async () => ({ data: {} }) };
    const messages = JSON.parse(options.body);
    calls.push(messages.map((m) => m.to));
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setImmediate(resolve));
    inFlight -= 1;
    const status = statuses.length ? statuses.shift() : 200;
    if (status !== 200) return { ok: false, status, headers: { get: () => null }, json: async () => ({}) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: messages.map((m, i) => (stale.includes(m.to)
          ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }
          : { status: 'ok', id: `ticket-${m.to}-${i}` })),
      }),
    };
  };
  return { impl, calls, get maxInFlight() { return maxInFlight; } };
}

const queued = (extra = {}) => ({
  id: 'c1',
  title: 'Hi',
  body: 'Test',
  segment: 'ALL',
  status: 'QUEUED',
  targetCount: 0,
  sentCount: 0,
  failedCount: 0,
  createdAt: NOW,
  data: { payload: { route: '/home' }, progress: { v: 2, asOf: NOW.toISOString(), cursor: null } },
  ...extra,
});

describe('push campaign segments', () => {
  it('offers activity, platform and goal segments instead of packages', () => {
    assert.deepEqual(PUSH_SEGMENTS, ['ALL', 'ACTIVE_7D', 'ACTIVE_30D', 'PLATFORM_IOS', 'PLATFORM_ANDROID', 'GOAL_MEDICATIONS', 'GOAL_NUTRITION', 'GOAL_CYCLE', 'GOAL_GENERAL']);
    for (const legacy of ['FREE', 'STANDARD', 'ULTIMATE', 'ACTIVE']) {
      assert.ok(ACCEPTED_PUSH_SEGMENTS.includes(legacy));
      assert.equal(normalizePushSegment(legacy), 'ALL');
    }
    assert.equal(normalizePushSegment('platform_ios'), 'PLATFORM_IOS');
    assert.equal(normalizePushSegment('VIP'), null);
  });

  it('builds token filters from AppActivity, platform and onboarding goal', () => {
    const all = segmentTokenWhere('ALL', NOW);
    assert.equal(all.active, true);
    assert.deepEqual(all.user, { status: { not: 'BLOCKED' } });
    assert.deepEqual(all.createdAt, { lte: NOW });

    const week = segmentTokenWhere('ACTIVE_7D', NOW);
    assert.equal(week.user.appActivities.some.lastAt.gte.toISOString(), '2026-09-21T10:00:00.000Z');
    const month = segmentTokenWhere('ACTIVE_30D', NOW);
    assert.equal(month.user.appActivities.some.lastAt.gte.toISOString(), '2026-08-29T10:00:00.000Z');

    assert.deepEqual(segmentTokenWhere('PLATFORM_ANDROID', NOW).platform, { equals: 'android', mode: 'insensitive' });
    assert.deepEqual(segmentTokenWhere('GOAL_CYCLE', NOW).user.healthProfile, {
      is: { extraAnswers: { path: ['primaryGoal'], equals: 'cycle' } },
    });
    assert.deepEqual(segmentTokenWhere('STANDARD', NOW), all);
  });

  it('reads the admin payload from new and legacy rows', () => {
    assert.deepEqual(campaignPayload({ data: { payload: { a: '1' }, deliveries: [] } }), { a: '1' });
    assert.deepEqual(campaignPayload({ data: { a: '1', tickets: [], deliveries: [] } }), { a: '1' });
  });
});

describe('queuePushCampaign', () => {
  it('queues and returns immediately without sending', async () => {
    const db = fakeDb({ tokens: 3 });
    let kicked = 0;
    const campaign = await queuePushCampaign({ title: 'Hi', body: 'Test', segment: 'FREE', adminId: 'a1' }, { db, now: NOW, kick: () => { kicked += 1; } });
    assert.equal(campaign.status, 'QUEUED');
    assert.equal(campaign.segment, 'ALL');
    assert.equal(campaign.targetCount, 3);
    assert.equal(campaign.data.progress.v, 2);
    assert.equal(kicked, 1);
  });

  it('fails right away when the segment has no devices', async () => {
    const db = fakeDb({ tokens: 0 });
    let kicked = 0;
    const campaign = await queuePushCampaign({ title: 'Hi', body: 'Test', segment: 'ALL' }, { db, now: NOW, kick: () => { kicked += 1; } });
    assert.equal(campaign.status, 'FAILED');
    assert.equal(kicked, 0);
  });
});

describe('runPushCampaign', () => {
  it('sends in parallel waves, saves progress after each wave and deactivates stale tokens', async () => {
    const db = fakeDb({ tokens: 10, campaigns: [queued({ targetCount: 10 })] });
    const fetch = expoFetch({ stale: [tok(4)] });
    const result = await runPushCampaign(db.rows[0], { db, fetchImpl: fetch.impl, sleep: async () => {}, concurrency: 2, chunkSize: 2, receiptWaitMs: 0, logEvent: () => {} });
    assert.equal(result.sent, 9);
    assert.equal(result.failed, 1);
    assert.equal(fetch.calls.length, 5);
    assert.equal(fetch.maxInFlight, 2);
    assert.deepEqual(db.deactivated, [tok(4)]);
    const counts = db.updates.filter((u) => 'sentCount' in u).map((u) => u.sentCount + u.failedCount);
    assert.deepEqual(counts, [4, 8, 10, 10]);
    const last = db.rows[0];
    assert.equal(last.status, 'SENT');
    assert.equal(last.data.progress.done, true);
    assert.equal(last.data.progress.cursor, 't0009');
    assert.equal(last.data.payload.route, '/home');
  });

  it('resumes after a restart from the saved cursor', async () => {
    const campaign = queued({ status: 'SENDING', sentCount: 6, targetCount: 10, data: { payload: {}, progress: { v: 2, asOf: NOW.toISOString(), cursor: 't0005' } } });
    const db = fakeDb({ tokens: 10, campaigns: [campaign] });
    const fetch = expoFetch();
    const result = await runPushCampaign(db.rows[0], { db, fetchImpl: fetch.impl, sleep: async () => {}, receiptWaitMs: 0, logEvent: () => {} });
    assert.deepEqual(fetch.calls.flat(), [tok(6), tok(7), tok(8), tok(9)]);
    assert.equal(result.sent, 10);
  });

  it('retries 429/5xx with backoff before counting a chunk as failed', async () => {
    const db = fakeDb({ tokens: 2, campaigns: [queued()] });
    const fetch = expoFetch({ statuses: [503, 429] });
    const waits = [];
    const result = await runPushCampaign(db.rows[0], { db, fetchImpl: fetch.impl, sleep: async (ms) => { waits.push(ms); }, receiptWaitMs: 0, logEvent: () => {} });
    assert.deepEqual(waits, [1000, 2000]);
    assert.equal(result.sent, 2);
    assert.equal(result.failed, 0);
  });

  it('marks the campaign FAILED when nothing was accepted', async () => {
    const db = fakeDb({ tokens: 2, campaigns: [queued()] });
    const fetch = expoFetch({ statuses: [500, 500, 500, 500] });
    const result = await runPushCampaign(db.rows[0], { db, fetchImpl: fetch.impl, sleep: async () => {}, receiptWaitMs: 0, logEvent: () => {} });
    assert.equal(result.failed, 2);
    assert.equal(db.rows[0].status, 'FAILED');
  });

  it('stops without finishing when the lease moved to another instance', async () => {
    const db = fakeDb({ tokens: 4, campaigns: [queued()] });
    const fetch = expoFetch();
    const result = await runPushCampaign(db.rows[0], { db, fetchImpl: fetch.impl, keepLease: async () => false, logEvent: () => {} });
    assert.equal(result.paused, true);
    assert.equal(fetch.calls.length, 0);
    assert.equal(db.rows[0].status, 'SENDING');
  });
});

describe('nextPushCampaign / processPushCampaigns', () => {
  it('never resends rows from the old synchronous sender and expires stale queues', async () => {
    const old = new Date(NOW.getTime() - CAMPAIGN_MAX_AGE_MS - 1000);
    const db = fakeDb({
      campaigns: [
        { id: 'legacy', status: 'SENDING', createdAt: old, data: { tickets: [] } },
        queued({ id: 'stale', createdAt: old }),
        queued({ id: 'fresh' }),
      ],
    });
    const next = await nextPushCampaign({ db, now: NOW });
    assert.equal(next.id, 'fresh');
    assert.equal(db.rows.find((r) => r.id === 'legacy').status, 'SENDING');
    const stale = db.rows.find((r) => r.id === 'stale');
    assert.equal(stale.status, 'FAILED');
    assert.equal(stale.data.progress.reason, 'EXPIRED');
  });

  it('drains queued campaigns only while holding the lease', async () => {
    const db = fakeDb({ tokens: 3, campaigns: [queued({ createdAt: new Date() })] });
    const fetch = expoFetch();
    const skipped = await processPushCampaigns({ db, fetchImpl: fetch.impl, lease: async () => false, logEvent: () => {} });
    assert.equal(skipped.skipped, 'lease');
    const done = await processPushCampaigns({ db, fetchImpl: fetch.impl, sleep: async () => {}, receiptWaitMs: 0, lease: async () => true, logEvent: () => {} });
    assert.equal(done.processed, 1);
    assert.equal(db.rows[0].status, 'SENT');
    assert.equal(db.rows[0].sentCount, 3);
  });
});
