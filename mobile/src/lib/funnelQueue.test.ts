import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createFunnelQueue, installSourceFromUrl, parseQueue, type SendResult } from './funnelQueue.ts';

function harness(results: SendResult[] = [], account: { id: string | null } = { id: null }) {
  let stored: string | null = null;
  const batches: Array<Array<{ name: string; props?: Record<string, string>; at: string }>> = [];
  const q = createFunnelQueue({
    load: async () => stored,
    save: async (raw) => { stored = raw; },
    send: async (events) => {
      batches.push(events);
      return results.shift() ?? 'ok';
    },
    currentAccount: () => account.id,
    now: () => Date.parse('2026-09-28T10:00:00Z'),
    batchSize: 2,
    maxQueue: 5,
  });
  return { q, batches, stored: () => stored, account };
}

describe('funnel queue', () => {
  it('persists events and sends them in capped batches', async () => {
    const h = harness();
    for (const step of ['o1-gender', 'o2-goal', 'o3-birthdate']) await h.q.enqueue('onboarding_step_viewed', { stepKey: step });
    assert.equal(parseQueue(h.stored()).length, 3);
    assert.equal(await h.q.flush(), 3);
    assert.deepEqual(h.batches.map((b) => b.length), [2, 1]);
    assert.equal(h.batches[0][0].at, '2026-09-28T10:00:00.000Z');
    assert.equal('account' in h.batches[0][0], false);
    assert.equal(await h.q.size(), 0);
  });

  it('keeps events offline and retries later', async () => {
    const h = harness(['retry']);
    await h.q.enqueue('app_first_open', { source: 'organic' });
    assert.equal(await h.q.flush(), 0);
    assert.equal(await h.q.size(), 1);
    assert.equal(await h.q.flush(), 1);
    assert.equal(await h.q.size(), 0);
  });

  it('drops a rejected batch so it cannot block the queue', async () => {
    const h = harness(['drop']);
    await h.q.enqueue('price_alert_opened');
    assert.equal(await h.q.flush(), 0);
    assert.equal(await h.q.size(), 0);
  });

  it('never throws when the network call throws', async () => {
    let stored: string | null = null;
    const q = createFunnelQueue({
      load: async () => stored,
      save: async (raw) => { stored = raw; },
      send: async () => { throw new Error('offline'); },
      currentAccount: () => null,
    });
    await q.enqueue('referral_shared');
    assert.equal(await q.flush(), 0);
    assert.equal(await q.size(), 1);
  });

  it('caps the queue and strips free text / values from props', async () => {
    const h = harness();
    for (let i = 0; i < 8; i += 1) await h.q.enqueue('first_health_action', { type: 'meal', note: 'ate pizza with 800 kcal', kg: 81 as unknown as string });
    assert.equal(await h.q.size(), 5);
    const [first] = parseQueue(h.stored());
    assert.deepEqual(first.props, { type: 'meal' });
  });

  it('does not send events recorded under another account', async () => {
    const h = harness([], { id: 'a' });
    await h.q.enqueue('signup_completed', { method: 'email' });
    h.account.id = null;
    await h.q.enqueue('app_first_open', { source: 'organic' });
    h.account.id = 'b';
    assert.equal(await h.q.flush(), 1);
    assert.deepEqual(h.batches.flat().map((e) => e.name), ['app_first_open']);
  });

  it('survives a corrupt stored queue', () => {
    assert.deepEqual(parseQueue('{not json'), []);
    assert.deepEqual(parseQueue('{"a":1}'), []);
  });
});

describe('install source', () => {
  it('reads invite links, utm params and plain launches', () => {
    assert.deepEqual(installSourceFromUrl(null), { source: 'organic' });
    assert.deepEqual(installSourceFromUrl('medicard://'), { source: 'organic' });
    assert.deepEqual(installSourceFromUrl('medicard://invite/ABC234'), { source: 'invite' });
    assert.deepEqual(installSourceFromUrl('https://medicard.ge/i/ABC234'), { source: 'invite' });
    assert.deepEqual(
      installSourceFromUrl('https://medicard.ge/i/ABC234?utm_source=Instagram&utm_medium=reel&utm_campaign=launch_oct'),
      { source: 'utm', utmSource: 'instagram', utmMedium: 'reel', utmCampaign: 'launch_oct' },
    );
    assert.deepEqual(installSourceFromUrl('medicard://pharmacy/product/12'), { source: 'deeplink' });
    assert.deepEqual(installSourceFromUrl('medicard://?utm_source=has%20spaces'), { source: 'organic' });
    assert.deepEqual(installSourceFromUrl('exp+medicard://expo-development-client/?url=http%3A%2F%2F10.0.0.2%3A8081'), { source: 'organic' });
  });
});
