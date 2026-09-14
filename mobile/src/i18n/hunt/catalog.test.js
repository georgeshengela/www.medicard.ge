import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { huntCopy } from './catalog.js';

describe('hunt catalog', () => {
  it('covers ka/en/fr/ru without raw keys', () => {
    for (const loc of ['ka', 'en', 'fr', 'ru']) {
      const copy = huntCopy(loc);
      assert.equal(copy.title, 'Medi Hunt');
      assert.match(copy.startHunt, /\S/);
      assert.doesNotMatch(copy.huntBody, /Nightingale/);
      assert.ok(copy.takeCapsule.length > 2);
      assert.ok(copy.pauseAction.length > 2);
    }
  });
});
