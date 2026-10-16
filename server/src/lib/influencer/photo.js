import { existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { getObject, objectStorageConfigured } from '../objectStorage.js';
import { filenameFromStoredUrl, resolveUploadPath } from '../privateUploads.js';
import { saveUpload } from '../storage.js';

/** Square, re-encoded profile photo (strips EXIF/GPS, bounds the size), stored like every private upload (R2). */
export async function storeInfluencerPhoto(buffer) {
  const jpeg = await sharp(buffer, { limitInputPixels: 60_000_000, failOn: 'error' })
    .rotate()
    .resize(720, 720, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
  return saveUpload(jpeg, 'image/jpeg');
}

/** Streams a stored photo. `publicCache` only for approved influencers' public photo on the invite page. */
export async function sendInfluencerPhoto(res, key, { publicCache = false } = {}) {
  const filename = filenameFromStoredUrl(key);
  const notFound = () => res.status(404).json({ error: 'ფოტო ვერ მოიძებნა.' });
  if (!filename) return notFound();
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', publicCache ? 'public, max-age=3600' : 'private, no-store');
  if (objectStorageConfigured()) {
    let object = null;
    try {
      object = await getObject(`/uploads/${filename}`);
    } catch {
      object = null;
    }
    if (object?.body) {
      Readable.fromWeb(object.body).on('error', () => res.destroy()).pipe(res);
      return undefined;
    }
  }
  const abs = resolveUploadPath(filename);
  if (!abs || !existsSync(abs)) {
    res.removeHeader('Content-Type');
    return notFound();
  }
  return res.sendFile(abs);
}
