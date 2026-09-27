import { createHash, createHmac } from 'node:crypto';

/**
 * Optional S3-compatible object store (Cloudflare R2 / AWS S3).
 * Callers keep storing `/uploads/<uuid>.ext` keys. Ownership stays in Postgres.
 * Bytes move off Render's ephemeral disk only when all four env vars are set.
 * Never logs access keys.
 */

export function objectStorageConfig(env = process.env) {
  const bucket = String(env.S3_BUCKET || '').trim();
  const accessKeyId = String(env.S3_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(env.S3_SECRET_ACCESS_KEY || '').trim();
  const endpoint = String(env.S3_ENDPOINT || '').trim().replace(/\/$/, '');
  const region = String(env.S3_REGION || 'auto').trim() || 'auto';
  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) return null;
  return { bucket, accessKeyId, secretAccessKey, endpoint, region };
}

export function objectStorageConfigured(env = process.env) {
  return objectStorageConfig(env) != null;
}

export function objectStorageKey(filename) {
  return String(filename || '').replace(/^\/+/, '');
}

export function objectStoragePublicHint(config = objectStorageConfig()) {
  if (!config) return { configured: false, provider: 'disk' };
  let host = 's3';
  try {
    host = new URL(config.endpoint).host;
  } catch {
    host = 's3';
  }
  return {
    configured: true,
    provider: host.includes('r2.cloudflarestorage.com') ? 'r2' : 's3',
    bucket: config.bucket,
    region: config.region,
  };
}

// Minimal S3 SigV4 client (path-style; R2 and S3). No SDK dependency.

const sha256Hex = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
const encodeKey = (key) => key.split('/').map((part) => encodeURIComponent(part)).join('/');

/** Pure: URL and signed headers for one object call. Exported for tests. */
export function signObjectRequest({ method, key, config, body = null, contentType = null, now = new Date() }) {
  const url = new URL(`${config.endpoint}/${encodeURIComponent(config.bucket)}/${encodeKey(objectStorageKey(key))}`);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body ?? '');
  const headers = { host: url.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  if (contentType) headers['content-type'] = contentType;
  const names = Object.keys(headers).sort();
  const canonical = [
    method,
    url.pathname,
    '',
    names.map((n) => `${n}:${String(headers[n]).trim()}\n`).join(''),
    names.join(';'),
    payloadHash,
  ].join('\n');
  const scope = `${day}/${config.region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonical)].join('\n');
  let signingKey = hmac(`AWS4${config.secretAccessKey}`, day);
  for (const part of [config.region, 's3', 'aws4_request']) signingKey = hmac(signingKey, part);
  const signature = createHmac('sha256', signingKey).update(toSign).digest('hex');
  const { host: _host, ...sendHeaders } = headers;
  return {
    url: url.toString(),
    headers: {
      ...sendHeaders,
      authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
    },
  };
}

async function objectCall(method, key, { body = null, contentType = null, config = objectStorageConfig(), fetchImpl = fetch } = {}) {
  if (!config) throw new Error('OBJECT_STORAGE_NOT_CONFIGURED');
  const { url, headers } = signObjectRequest({ method, key, config, body, contentType });
  return fetchImpl(url, { method, headers, body: body ?? undefined, signal: AbortSignal.timeout(30000) });
}

export async function putObject(key, body, contentType, options) {
  const res = await objectCall('PUT', key, { ...options, body, contentType });
  if (!res.ok) throw new Error(`OBJECT_STORAGE_PUT_${res.status}`);
  return true;
}

/** The fetch Response on 200, null on 404. */
export async function getObject(key, options) {
  const res = await objectCall('GET', key, options);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OBJECT_STORAGE_GET_${res.status}`);
  return res;
}

export async function deleteObject(key, options) {
  const res = await objectCall('DELETE', key, options);
  return res.ok || res.status === 404;
}
