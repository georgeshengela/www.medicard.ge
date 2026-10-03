import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { keysForWrite } from './queryInvalidation.ts';
import { CYCLE_QUERY_KEYS } from './cycleQueryKeys.ts';

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
  it('every cycle write refreshes the cycle screens and Home', () => {
    const writes: Array<[string, string]> = [
      ['PUT', '/api/cycle/logs/2026-10-03'], // day log, journal notes ride on it
      ['DELETE', '/api/cycle/logs/2026-10-03'],
      ['PUT', '/api/cycle/period'], // start / end / fill
      ['PUT', '/api/cycle/period/days'], // month editor
      ['POST', '/api/cycle/last-period'],
      ['PUT', '/api/cycle/profile'], // mode, privacy, partner sharing, reminders
      ['POST', '/api/cycle/tags'],
      ['PATCH', '/api/cycle/tags/t1'],
      ['DELETE', '/api/cycle/tags/t1'],
      ['PUT', '/api/cycle/pregnancy/2026-10-03'],
      ['PUT', '/api/cycle/pregnancy/care-plan/visit-1'],
      ['PUT', '/api/cycle/postpartum'],
      ['PUT', '/api/cycle/postpartum/bleed-classifications'],
      ['DELETE', '/api/cycle/postpartum/bleed-classifications'],
      ['POST', '/api/cycle/share'],
      ['PATCH', '/api/cycle/share'],
      ['DELETE', '/api/cycle/share'],
      ['POST', '/api/cycle/wipe'],
    ];
    for (const [method, path] of writes) {
      assert.deepEqual(keysForWrite(method, path).sort(), ['cycle', 'home'], `${method} ${path}`);
    }
  });
  it('cycle reads and read-like cycle POSTs never invalidate (no reload loops)', () => {
    assert.deepEqual(keysForWrite('GET', '/api/cycle/observation-trends'), []);
    assert.deepEqual(keysForWrite('GET', '/api/cycle/prediction-history'), []);
    assert.deepEqual(keysForWrite('GET', '/api/cycle/doctor-summary?includeNotes=1'), []);
    assert.deepEqual(keysForWrite('POST', '/api/cycle/insights'), []);
    // A partner's share screen accepts on every focus — must not reload anything of theirs.
    assert.deepEqual(keysForWrite('POST', '/api/cycle/share/ABCD1234/accept'), []);
  });
  it('every cached cycle read sits under the key a cycle write invalidates', () => {
    const invalidated = keysForWrite('PUT', '/api/cycle/logs/2026-10-03');
    for (const key of Object.values(CYCLE_QUERY_KEYS)) {
      assert.ok(invalidated.includes(key[0]), `${key.join('/')} is refreshed by cycle writes`);
    }
  });
});
