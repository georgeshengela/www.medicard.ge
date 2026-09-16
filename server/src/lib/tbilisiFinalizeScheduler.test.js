import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { finalizeSchedulerConfigured } from './tbilisiMoves/schedulerPolicy.js';

describe('Tbilisi finalize scheduler flag', () => {
  it('is off until the prepared cron sets TBILISI_MOVES_FINALIZE_SCHEDULED', () => {
    assert.equal(finalizeSchedulerConfigured({}), false);
    assert.equal(finalizeSchedulerConfigured({ TBILISI_MOVES_FINALIZE_SCHEDULED: 'true' }), true);
  });
});
