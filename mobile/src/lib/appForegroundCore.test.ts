import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isReturnFromBackground } from './appForegroundCore.ts';

describe('isReturnFromBackground', () => {
  it('fires only when the app really comes back from the background', () => {
    assert.equal(isReturnFromBackground('background', 'active'), true);
    assert.equal(isReturnFromBackground('inactive', 'active'), false); // Face ID, permission sheet, Control Center
    assert.equal(isReturnFromBackground('active', 'background'), false);
    assert.equal(isReturnFromBackground(null, 'active'), false);
  });
});
