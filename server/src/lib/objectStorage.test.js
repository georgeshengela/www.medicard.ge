import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { objectStorageConfig, objectStorageConfigured, objectStoragePublicHint } from './objectStorage.js';

describe('objectStorageConfig', () => {
  it('stays on disk until every required env is present', () => {
    assert.equal(objectStorageConfigured({}), false);
    assert.equal(
      objectStorageConfigured({
        S3_BUCKET: 'medicard-uploads',
        S3_ACCESS_KEY_ID: 'id',
        S3_SECRET_ACCESS_KEY: '',
        S3_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
      }),
      false,
    );
  });

  it('reports R2 without printing secrets', () => {
    const env = {
      S3_BUCKET: 'medicard-uploads',
      S3_ACCESS_KEY_ID: 'id',
      S3_SECRET_ACCESS_KEY: 'secret-value-not-logged',
      S3_ENDPOINT: 'https://abc.r2.cloudflarestorage.com',
      S3_REGION: 'auto',
    };
    assert.equal(objectStorageConfigured(env), true);
    const hint = objectStoragePublicHint(objectStorageConfig(env));
    assert.equal(hint.provider, 'r2');
    assert.equal(JSON.stringify(hint).includes('secret-value'), false);
  });
});
