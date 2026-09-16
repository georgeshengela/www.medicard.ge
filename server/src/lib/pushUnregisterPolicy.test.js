import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../routes/push.routes.js'),
  'utf8',
);

describe('push unregister', () => {
  it('deactivates only the presented token for the authenticated user', () => {
    assert.match(src, /where: \{ token: body.token, userId: req.user.id \}/);
    assert.doesNotMatch(src, /pushToken\.updateMany\(\{[\s\S]*where: \{ userId: req.user.id \}/);
  });
});
