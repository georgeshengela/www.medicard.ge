import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UPLOAD_PACE, pruneSent, uploadWaitMs } from './uploadPace.ts';
import { createRequestBreaker } from '../requestBreaker.ts';

describe('MEDIRUN upload pace', () => {
  it('sends at once while under the limit', () => {
    assert.equal(uploadWaitMs([], 1_000), 0);
    assert.equal(uploadWaitMs(Array.from({ length: 19 }, (_, i) => i * 10), 500), 0);
  });

  it('waits until the oldest counted upload leaves the window', () => {
    const sent = Array.from({ length: 20 }, (_, i) => 1_000 + i * 100); // 1000 … 2900
    assert.equal(uploadWaitMs(sent, 3_000), 1_000 + 10_000 - 3_000);
    assert.equal(uploadWaitMs(sent, 11_000), 0);
  });

  it('forgets uploads older than the window', () => {
    assert.deepEqual(pruneSent([0, 5_000, 12_000], 15_000), [12_000]);
  });

  it('a 60-batch backlog flushed at this pace never trips the request breaker', () => {
    const breaker = createRequestBreaker({ now: () => clock });
    let clock = 0;
    let sent: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      clock += uploadWaitMs(sent, clock);
      const decision = breaker.check('POST', '/api/medipulsi/sessions/abc123/batches');
      assert.equal(decision.ok, true, `batch ${i} refused at ${clock} ms`);
      sent = [...pruneSent(sent, clock), clock];
      clock += 40; // network round trip
    }
    assert.ok(UPLOAD_PACE.limit < 30);
  });
});
