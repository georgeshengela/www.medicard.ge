import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { objectStorageConfigured, putObject } from './objectStorage.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const UPLOAD_DIR = path.join(rootDir, 'uploads');

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};

/**
 * Persists an upload and returns the storage key (`/uploads/<uuid>.ext`).
 * That key is not a public URL. Bytes are served only from `GET /api/files/:filename`
 * after owner auth. With S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY
 * set (Cloudflare R2) the bytes go to the bucket; otherwise to local disk, which on Render
 * is ephemeral — every deploy or restart loses them (warned at startup).
 */
export async function saveUpload(buffer, mimeType) {
  const filename = `${randomUUID()}${EXTENSIONS[mimeType] ?? '.bin'}`;
  const key = `/uploads/${filename}`;
  if (objectStorageConfigured()) {
    await putObject(key, buffer, mimeType || 'application/octet-stream');
    return key;
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return key;
}
