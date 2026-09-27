import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isExpoPushToken,
  normalizePushTickets,
  tallyPushTickets,
  tokenPreview,
  stringifyPushData,
  applyPushReceipts,
  sendExpoPush,
  sendExpoChunk,
  isTransientPushStatus,
  pushRetryDelayMs,
} from './push.js';

describe('isExpoPushToken', () => {
  it('accepts both Expo token prefixes', () => {
    assert.equal(isExpoPushToken('ExponentPushToken[abc123]'), true);
    assert.equal(isExpoPushToken('ExpoPushToken[xyz]'), true);
    assert.equal(isExpoPushToken('ExponentPushToken[]'), false);
    assert.equal(isExpoPushToken('fcm-token'), false);
    assert.equal(isExpoPushToken(''), false);
  });
});

describe('normalizePushTickets', () => {
  it('keeps an array of tickets', () => {
    const tickets = normalizePushTickets({
      data: [
        { status: 'ok', id: 'a' },
        { status: 'error', message: 'nope' },
      ],
    });
    assert.equal(tickets.length, 2);
    assert.equal(tickets[0].id, 'a');
  });

  it('wraps a single ticket object — Expo does this for one recipient', () => {
    const tickets = normalizePushTickets({ data: { status: 'ok', id: 'solo' } });
    assert.deepEqual(tickets, [{ status: 'ok', id: 'solo' }]);
  });

  it('returns empty for missing or junk data', () => {
    assert.deepEqual(normalizePushTickets({}), []);
    assert.deepEqual(normalizePushTickets({ data: 'nope' }), []);
    assert.deepEqual(normalizePushTickets(null), []);
  });
});

describe('tallyPushTickets', () => {
  it('counts ok vs error', () => {
    assert.deepEqual(
      tallyPushTickets([{ status: 'ok' }, { status: 'OK' }, { status: 'error' }]),
      { sent: 2, failed: 1 },
    );
  });

  it('uses fallback when Expo accepted the request but returned no tickets', () => {
    assert.deepEqual(tallyPushTickets([], { fallbackSent: 2 }), { sent: 2, failed: 0 });
    assert.deepEqual(tallyPushTickets([], { fallbackFailed: 3 }), { sent: 0, failed: 3 });
  });
});

describe('tokenPreview', () => {
  it('truncates long tokens', () => {
    const token = 'ExponentPushToken[abcdefghijklmnop]';
    const preview = tokenPreview(token);
    assert.ok(preview.startsWith('ExponentPushToken[ab'));
    assert.ok(preview.includes('…'));
    assert.ok(!preview.includes('jklmnop'));
  });
});

describe('sendExpoPush', () => {
  it('counts a single-object Expo ticket as sent', async () => {
    const result = await sendExpoPush(
      ['ExponentPushToken[device-one]'],
      { title: 'Hi', body: 'Test' },
      {
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ data: { status: 'ok', id: 'ticket-1' } }),
        }),
      },
    );
    assert.equal(result.sent, 1);
    assert.equal(result.failed, 0);
    assert.equal(result.tickets[0].id, 'ticket-1');
    assert.equal(result.deliveries[0].status, 'ok');
  });

  it('counts HTTP 200 with no ticket body as delivered', async () => {
    const result = await sendExpoPush(
      ['ExponentPushToken[a]', 'ExponentPushToken[b]'],
      { title: 'Hi', body: 'Test' },
      {
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({}),
        }),
      },
    );
    assert.equal(result.sent, 2);
    assert.equal(result.failed, 0);
  });

  it('retries a 429 once, then counts the chunk as sent', async () => {
    const statuses = [429, 200];
    const waits = [];
    const result = await sendExpoPush(
      ['ExponentPushToken[a]'],
      { title: 'Hi', body: 'Test' },
      {
        sleep: async (ms) => { waits.push(ms); },
        fetchImpl: async () => {
          const status = statuses.shift();
          return { ok: status === 200, status, headers: { get: () => '2' }, json: async () => (status === 200 ? { data: { status: 'ok', id: 't' } } : {}) };
        },
      },
    );
    assert.deepEqual(waits, [2000]);
    assert.equal(result.sent, 1);
  });

  it('still throws after retries on network failure so outbox callers retry later', async () => {
    let calls = 0;
    await assert.rejects(
      sendExpoPush(['ExponentPushToken[a]'], { title: 'Hi', body: 'Test' }, {
        sleep: async () => {},
        fetchImpl: async () => { calls += 1; throw new Error('socket hang up'); },
      }),
      /socket hang up/,
    );
    assert.equal(calls, 4);
  });

  it('ignores junk tokens', async () => {
    const result = await sendExpoPush(['nope', ''], { title: 'Hi', body: 'Test' });
    assert.deepEqual(result, { sent: 0, failed: 0, tickets: [], deliveries: [] });
  });
});

describe('stringifyPushData', () => {
  it('stringifies nested values for iOS APNs', () => {
    assert.deepEqual(stringifyPushData({ campaignId: 'abc', qa: true, n: 1 }), {
      campaignId: 'abc',
      qa: 'true',
      n: '1',
    });
  });
});

describe('applyPushReceipts', () => {
  it('marks a ticket-ok delivery as failed when the receipt errors', () => {
    const result = applyPushReceipts(
      [{ tokenPreview: 'ExponentPushToken[ab…z]', status: 'ok', ticketId: 't1', error: null }],
      { t1: { status: 'error', message: 'DeviceNotRegistered', details: { error: 'DeviceNotRegistered' } } },
    );
    assert.equal(result.sent, 0);
    assert.equal(result.failed, 1);
    assert.equal(result.deliveries[0].error, 'DeviceNotRegistered');
  });
});

describe('push retry policy', () => {
  it('treats only 429 and 5xx as transient', () => {
    assert.equal(isTransientPushStatus(429), true);
    assert.equal(isTransientPushStatus(503), true);
    assert.equal(isTransientPushStatus(400), false);
    assert.equal(isTransientPushStatus(undefined), false);
  });

  it('backs off exponentially, honours Retry-After, caps at 30 s', () => {
    assert.deepEqual([0, 1, 2].map((a) => pushRetryDelayMs(a)), [1000, 2000, 4000]);
    assert.equal(pushRetryDelayMs(0, '5'), 5000);
    assert.equal(pushRetryDelayMs(10), 30000);
  });

  it('reports DeviceNotRegistered tokens and ticket ids per chunk', async () => {
    const result = await sendExpoChunk(['ExponentPushToken[a]', 'ExponentPushToken[b]'], { title: 'Hi', body: 'x' }, {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ status: 'ok', id: 't1' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }] }),
      }),
    });
    assert.deepEqual(result.stale, ['ExponentPushToken[b]']);
    assert.deepEqual(result.ticketTokens, [['t1', 'ExponentPushToken[a]']]);
    assert.equal(result.sent, 1);
    assert.equal(result.failed, 1);
  });
});
