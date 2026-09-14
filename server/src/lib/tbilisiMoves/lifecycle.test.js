import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { roundLifecycle, assertCanFinalize } from './lifecycle.js';
import { addDaysYmd, tbilisiMidnight } from './time.js';

function roundFor(date, { status = 'PROVISIONAL', graceHours = 8, resultRevision = 0 } = {}) {
  const openedAt = tbilisiMidnight(date);
  const graceEndsAt = new Date(tbilisiMidnight(addDaysYmd(date, 1)).getTime() + graceHours * 3600 * 1000);
  return { date, status, openedAt, graceEndsAt, resultRevision };
}

describe('tbilisi moves round lifecycle', () => {
  it('keeps the competition day OPEN and blocks finalization', () => {
    const round = roundFor('2026-09-13');
    const noon = new Date(tbilisiMidnight('2026-09-13').getTime() + 12 * 3600 * 1000);
    const life = roundLifecycle(round, noon);
    assert.equal(life.phase, 'OPEN');
    assert.equal(life.canFinalize, false);
    assert.equal(life.blocker, 'DAY_STILL_OPEN');
    assert.throws(() => assertCanFinalize(life), (err) => err.code === 'DAY_STILL_OPEN');
  });

  it('enters GRACE after midnight and still blocks finalization', () => {
    const round = roundFor('2026-09-13');
    const afterMidnight = new Date(tbilisiMidnight('2026-09-14').getTime() + 60 * 1000);
    const life = roundLifecycle(round, afterMidnight);
    assert.equal(life.phase, 'GRACE');
    assert.equal(life.canFinalize, false);
    assert.equal(life.ingestOpen, true);
    assert.throws(() => assertCanFinalize(life), (err) => err.code === 'GRACE_ACTIVE');
  });

  it('is READY exactly at the snapshotted grace deadline', () => {
    const round = roundFor('2026-09-13', { graceHours: 8 });
    const atGrace = new Date(round.graceEndsAt);
    const before = new Date(atGrace.getTime() - 1);
    const after = new Date(atGrace.getTime());
    assert.equal(roundLifecycle(round, before).phase, 'GRACE');
    assert.equal(roundLifecycle(round, before).canFinalize, false);
    assert.equal(roundLifecycle(round, after).phase, 'READY');
    assert.equal(roundLifecycle(round, after).canFinalize, true);
  });

  it('does not treat pause as VOIDED', () => {
    const round = roundFor('2026-09-12');
    const readyAt = new Date(round.graceEndsAt.getTime() + 1000);
    const life = roundLifecycle(round, readyAt);
    assert.equal(life.phase, 'READY');
    assert.notEqual(life.phase, 'VOIDED');
  });

  it('marks FINALIZED rounds as immutable for first publish', () => {
    const round = roundFor('2026-09-12', { status: 'FINALIZED', resultRevision: 1 });
    const life = roundLifecycle(round, new Date(round.graceEndsAt.getTime() + 1000));
    assert.equal(life.phase, 'FINALIZED');
    assert.equal(life.canFinalize, false);
    assert.equal(life.canCorrect, true);
  });
});
