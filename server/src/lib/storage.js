import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
 * Persists an upload to local disk and returns the storage key (`/uploads/<uuid>.ext`).
 * That key is not a public URL. Bytes are served only from `GET /api/files/:filename`
 * after owner auth. Optional S3/R2: set S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID,
 * S3_SECRET_ACCESS_KEY (see objectStorage.js). Until those exist, this host writes
 * Render ephemeral disk — photos vanish on restart.
 */
export async function saveUpload(buffer, mimeType) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}${EXTENSIONS[mimeType] ?? '.bin'}`;
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}
