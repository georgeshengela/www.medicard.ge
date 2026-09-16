import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeDayHydrationMl } from './hydrationMerge.js';

describe('hydration merge', () => {
  it('takes the stored daily total when Expo has no local taps', () => {
    assert.equal(mergeDayHydrationMl(0, 750), 750);
  });

  it('keeps local taps when they are ahead of the server row', () => {
    assert.equal(mergeDayHydrationMl(500, 250), 500);
  });

  it('ignores a missing server row', () => {
    assert.equal(mergeDayHydrationMl(250, null), 250);
  });
});
