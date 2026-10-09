import test from 'node:test';
import assert from 'node:assert/strict';
import { presenceCodes } from './sitePresence.js';

test('presence keeps only unique, sorted country codes from the admin geo rows', () => {
  assert.deepEqual(
    presenceCodes([{ code: 'GE', users: 170 }, { code: 'be', users: 4 }, { code: 'US', users: 1 }, { code: 'BE' }, { code: 'xxx' }, null]),
    ['BE', 'GE', 'US'],
  );
  assert.deepEqual(presenceCodes([]), []);
  assert.deepEqual(presenceCodes(undefined), []);
});
