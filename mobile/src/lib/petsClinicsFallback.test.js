import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const clinics = JSON.parse(readFileSync(join(here, 'petsClinicsFallback.json'), 'utf8'));

describe('pets clinic fallback', () => {
  it('ships the Dogdog listing so the hub is not empty before the API exists', () => {
    assert.equal(clinics.length, 9);
    assert.equal(clinics[0].name, 'ვეტერინარი გამოძახებით');
    assert.ok(clinics.every((row) => row.phones?.length && row.hours));
  });
});
