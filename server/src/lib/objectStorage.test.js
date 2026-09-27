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

describe('object storage client', () => {
  const config = { bucket: 'medicard-uploads', accessKeyId: 'AKID', secretAccessKey: 'secret-value-not-logged', endpoint: 'https://abc.r2.cloudflarestorage.com', region: 'auto' };

  it('signs a path-style SigV4 request without leaking the secret', async () => {
    const { signObjectRequest } = await import('./objectStorage.js');
    const signed = signObjectRequest({ method: 'PUT', key: '/uploads/a.jpg', config, body: Buffer.from('x'), contentType: 'image/jpeg', now: new Date('2026-09-27T10:00:00Z') });
    assert.equal(signed.url, 'https://abc.r2.cloudflarestorage.com/medicard-uploads/uploads/a.jpg');
    assert.equal(signed.headers['x-amz-date'], '20260927T100000Z');
    assert.match(signed.headers.authorization, /^AWS4-HMAC-SHA256 Credential=AKID\/20260927\/auto\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
    assert.equal(JSON.stringify(signed).includes('secret-value'), false);
  });

  it('put / get / delete go through fetch; 404 reads as missing', async () => {
    const { putObject, getObject, deleteObject } = await import('./objectStorage.js');
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push([init.method, url]);
      return new Response(init.method === 'GET' ? null : '', { status: init.method === 'GET' ? 404 : 200 });
    };
    assert.equal(await putObject('/uploads/a.jpg', Buffer.from('x'), 'image/jpeg', { config, fetchImpl }), true);
    assert.equal(await getObject('/uploads/a.jpg', { config, fetchImpl }), null);
    assert.equal(await deleteObject('/uploads/a.jpg', { config, fetchImpl }), true);
    assert.deepEqual(calls.map((c) => c[0]), ['PUT', 'GET', 'DELETE']);
  });
});
