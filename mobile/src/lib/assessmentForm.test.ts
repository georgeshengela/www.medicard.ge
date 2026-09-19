import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('assessment legal name prefill', () => {
  it('uses user.fullName from the auth user object', () => {
    const text = readFileSync(join(here, 'assessmentForm.ts'), 'utf8');
    assert.match(text, /legalName: extra\.legalName \|\| user\.fullName \|\| user\.name \|\| ''/);
    assert.match(text, /fullName\?: string/);
  });
});
