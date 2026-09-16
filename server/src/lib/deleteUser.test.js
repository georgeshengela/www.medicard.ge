import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'deleteUser.js'), 'utf8');

describe('account-deletion SMS retention', () => {
  it('redacts SmsLog content instead of only nulling userId', () => {
    assert.match(src, /export const SMS_LOG_REDACTED_CONTENT = '\[redacted\]'/);
    assert.match(src, /smsLogAccountDeletePatch\(\)/);
    assert.match(src, /content: SMS_LOG_REDACTED_CONTENT/);
    assert.doesNotMatch(
      src,
      /smsLog\.updateMany\(\{ where: \{ userId \}, data: \{ userId: null \} \}\)/,
    );
  });
});
