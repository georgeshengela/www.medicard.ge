import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  backoffMs,
  classifySyncError,
  ENROLL_SYNC_BUDGET_MS,
  ignoreGraceDateSensorFailure,
  shouldPromptForCompetitionRead,
  shouldSubmitForUser,
} from './syncPolicy.js';

describe('tbilisi moves sync policy', () => {
  it('does not retry validation or source conflicts', () => {
    assert.equal(classifySyncError({ status: 409, code: 'SOURCE_CONFLICT' }).retry, false);
    assert.equal(classifySyncError({ status: 400, code: 'INTERVAL_OUT_OF_DAY' }).retry, false);
    assert.equal(classifySyncError({ status: 409, code: 'NOT_ENROLLED' }).retry, false);
    assert.equal(classifySyncError({ status: 409, code: 'NO_DISTRICT_FOR_DATE' }).retry, false);
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

  it('never opens a Health permission sheet for district war', () => {
    assert.equal(shouldPromptForCompetitionRead('enroll'), false);
    assert.equal(shouldPromptForCompetitionRead('refresh'), false);
    assert.equal(shouldPromptForCompetitionRead('focus'), false);
    assert.equal(shouldPromptForCompetitionRead('focus', { neverSynced: true }), false);
    assert.equal(shouldPromptForCompetitionRead('foreground'), false);
  });

  it('keeps today accepted when a later grace date fails', () => {
    assert.equal(
      ignoreGraceDateSensorFailure({ dateYmd: '2026-09-14', todayYmd: '2026-09-15', todayAccepted: true }),
      true,
    );
    assert.equal(
      ignoreGraceDateSensorFailure({ dateYmd: '2026-09-15', todayYmd: '2026-09-15', todayAccepted: true }),
      false,
    );
    assert.equal(
      ignoreGraceDateSensorFailure({ dateYmd: '2026-09-14', todayYmd: '2026-09-15', todayAccepted: false }),
      false,
    );
    assert.ok(ENROLL_SYNC_BUDGET_MS >= 8_000 && ENROLL_SYNC_BUDGET_MS <= 15_000);
  });
});
