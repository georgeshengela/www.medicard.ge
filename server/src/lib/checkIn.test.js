import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAwardRef, STEPS_GOAL_POINTS } from './checkIn.js';

describe('normalizeAwardRef', () => {
  it('trims and keeps short goal ids', () => {
    assert.equal(normalizeAwardRef('  goal-123  '), 'goal-123');
  });

  it('rejects empty refs', () => {
    assert.equal(normalizeAwardRef(''), '');
    assert.equal(normalizeAwardRef('   '), '');
    assert.equal(normalizeAwardRef(null), '');
  });

  it('caps length so the unique ledger key stays bounded', () => {
    assert.equal(normalizeAwardRef('x'.repeat(100)).length, 80);
  });
});

describe('STEPS_GOAL_POINTS', () => {
  it('awards 3 points per completed goal', () => {
    assert.equal(STEPS_GOAL_POINTS, 3);
  });
});
