import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatCycleDateKa } from './cycleCivilDateKa.js';

describe('formatCycleDateKa', () => {
  it('speaks a civil date in Georgian without shifting the calendar day', () => {
    assert.equal(formatCycleDateKa('2026-09-10'), '10 სექტემბერი 2026');
    assert.equal(formatCycleDateKa('2026-01-01'), '1 იანვარი 2026');
  });

  it('leaves non-civil strings unchanged', () => {
    assert.equal(formatCycleDateKa('not-a-date'), 'not-a-date');
  });
});
