import test from 'node:test';
import assert from 'node:assert/strict';
import { updatePromptForClient } from './updatePrompt.js';

test('no row: the automatic card is on and nobody is asked', () => {
  assert.deepEqual(updatePromptForClient({ enabled: true, belowVersion: null, promptId: null }, '1.0.0.21.0'), { auto: true, ask: null });
});

test('only versions below the target are asked, with the request id', () => {
  const prompt = { enabled: true, belowVersion: '1.0.0.21.32', promptId: 'up-1' };
  assert.deepEqual(updatePromptForClient(prompt, '1.0.0.21.0').ask, { id: 'up-1', version: '1.0.0.21.32' });
  assert.equal(updatePromptForClient(prompt, '1.0.0.21.32').ask, null);
  assert.equal(updatePromptForClient(prompt, '1.0.0.22.0').ask, null);
});

test('switched off in admin: no card and no request', () => {
  assert.deepEqual(updatePromptForClient({ enabled: false, belowVersion: '1.0.0.21.32', promptId: 'up-1' }, '1.0.0.21.0'), { auto: false, ask: null });
});
