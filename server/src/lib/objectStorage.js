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
