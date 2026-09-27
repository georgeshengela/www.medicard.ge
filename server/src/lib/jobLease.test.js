import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { acquireJobLease, withJobLease } from './jobLease.js';

describe('job lease', () => {
  it('runs the job only when the lease row comes back', async () => {
    let ran = 0;
    const held = { $queryRaw: async () => [{ holder: 'me' }] };
    const taken = { $queryRaw: async () => [] };
    await withJobLease('x', 1000, async () => { ran += 1; }, { db: held });
    assert.deepEqual(await withJobLease('x', 1000, async () => { ran += 1; }, { db: taken }), { skipped: 'lease' });
    assert.equal(ran, 1);
  });

  it('behaves like a single instance when the table is missing', async () => {
    const missing = { $queryRaw: async () => { throw new Error('relation "JobLease" does not exist'); } };
    assert.equal(await acquireJobLease('x', 1000, { db: missing }), true);
  });

  it('surfaces other database errors', async () => {
    const broken = { $queryRaw: async () => { throw new Error('connection reset'); } };
    await assert.rejects(acquireJobLease('x', 1000, { db: broken }));
  });
});
