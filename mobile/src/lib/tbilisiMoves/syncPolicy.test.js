import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { backoffMs, classifySyncError, shouldSubmitForUser } from './syncPolicy.js';

describe('tbilisi moves sync policy', () => {
  it('does not retry validation or source conflicts', () => {
    assert.equal(classifySyncError({ status: 409, code: 'SOURCE_CONFLICT' }).retry, false);
    assert.equal(classifySyncError({ status: 400, code: 'INTERVAL_OUT_OF_DAY' }).retry, false);
    assert.equal(classifySyncError({ status: 409, code: 'NOT_ENROLLED' }).retry, false);
    assert.equal(classifySyncError({ status: 401 }).kind, 'unauthorized');
  });

  it('retries transient failures with bounded backoff', () => {
    assert.equal(classifySyncError({ status: 503, code: 'SCHEMA_NOT_READY' }).retry, false);
    assert.equal(classifySyncError({ status: 0 }).retry, true);
    assert.equal(classifySyncError({ status: 502 }).retry, true);
    assert.equal(backoffMs(0), 1000);
    assert.equal(backoffMs(3), 8000);
  });

  it('never submits a queued reading under another account', () => {
    assert.equal(shouldSubmitForUser('a', 'a'), true);
    assert.equal(shouldSubmitForUser('a', 'b'), false);
    assert.equal(shouldSubmitForUser('a', null), false);
  });
});
