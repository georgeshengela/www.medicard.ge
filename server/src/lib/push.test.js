import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isExpoPushToken,
  normalizePushTickets,
  tallyPushTickets,
  tokenPreview,
  sendExpoPush,
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

  it('ignores junk tokens', async () => {
    const result = await sendExpoPush(['nope', ''], { title: 'Hi', body: 'Test' });
    assert.deepEqual(result, { sent: 0, failed: 0, tickets: [], deliveries: [] });
  });
});
