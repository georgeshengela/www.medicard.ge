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
 * after owner auth. Swap this module for S3 / R2 later — callers keep storing the key.
 */
export async function saveUpload(buffer, mimeType) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}${EXTENSIONS[mimeType] ?? '.bin'}`;
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}
