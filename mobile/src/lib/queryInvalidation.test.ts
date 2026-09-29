import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { keysForWrite } from './queryInvalidation.ts';

describe('keysForWrite', () => {
  it('reads never invalidate', () => {
    assert.deepEqual(keysForWrite('GET', '/api/medications'), []);
  });
  it('a medication write refreshes medications and Home', () => {
    assert.deepEqual(keysForWrite('POST', '/api/medications/abc/doses?x=1').sort(), ['home', 'medications']);
  });
  it('a device health sync never invalidates (would re-read and re-sync in a loop)', () => {
    assert.deepEqual(keysForWrite('POST', '/api/health-metrics/sync'), []);
  });
  it('does not match a longer sibling prefix', () => {
    assert.deepEqual(keysForWrite('POST', '/api/medicationsx'), []);
  });
  it('read-like POSTs never invalidate (would loop with the screen that calls them)', () => {
    assert.deepEqual(keysForWrite('POST', '/api/cycle/insights'), []);
    assert.deepEqual(keysForWrite('POST', '/api/nutrition/estimate'), []);
    assert.deepEqual(keysForWrite('POST', '/api/quests/timezone'), []);
    assert.deepEqual(keysForWrite('POST', '/api/cycle/profile'), ['cycle', 'home']);
  });
  it('Medi answers refresh records', () => {
    assert.deepEqual(keysForWrite('POST', '/api/ai/query'), ['records']);
    assert.deepEqual(keysForWrite('POST', '/api/ai-consent'), []);
  });
});
