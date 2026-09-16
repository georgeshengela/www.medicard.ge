import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAdminSeedAction } from './seedAdminPolicy.js';

describe('resolveAdminSeedAction', () => {
  it('never rotates an existing admin even when ADMIN_PASSWORD is present', () => {
    const withPassword = resolveAdminSeedAction({
      existingAdmin: { id: 'adm-1' },
      nodeEnv: 'production',
      adminPassword: 'present-but-not-printed',
    });
    const withoutPassword = resolveAdminSeedAction({
      existingAdmin: { id: 'adm-1' },
      nodeEnv: 'production',
      adminPassword: '',
    });
    assert.equal(withPassword.action, 'update-name-only');
    assert.equal(withoutPassword.action, 'update-name-only');
  });

  it('aborts a production create when ADMIN_PASSWORD is absent', () => {
    const result = resolveAdminSeedAction({
      existingAdmin: null,
      nodeEnv: 'production',
      adminPassword: '',
    });
    assert.equal(result.action, 'abort');
  });

  it('allows a local create without ADMIN_PASSWORD', () => {
    const result = resolveAdminSeedAction({
      existingAdmin: null,
      nodeEnv: 'development',
      adminPassword: '',
    });
    assert.equal(result.action, 'create');
    assert.equal(result.useBuiltinDevPassword, true);
  });
});

describe('seed.js admin wiring', () => {
  it('uses resolveAdminSeedAction instead of upserting passwordHash', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../prisma/seed.js'), 'utf8');
    assert.match(src, /resolveAdminSeedAction/);
    assert.doesNotMatch(src, /prisma\.admin\.upsert\(/);
  });
});
