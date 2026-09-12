import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { UPLOAD_DIR } from './storage.js';
import { prisma } from './prisma.js';
import { applyPrivateCache } from './cycleShare.js';

/** UUID + allowed extension written by saveUpload. */
export const PRIVATE_UPLOAD_FILENAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif|pdf|bin)$/i;

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  bin: 'application/octet-stream',
};

export function parseUploadFilename(raw) {
  if (raw == null) return null;
  let value = String(raw);
  if (value.includes('\0')) return null;
  for (let i = 0; i < 2; i += 1) {
    if (!/%[0-9a-f]{2}/i.test(value)) break;
    try {
      value = decodeURIComponent(value);
    } catch {
      return null;
    }
    if (value.includes('\0')) return null;
  }
  value = value.replace(/\\/g, '/');
  if (value.includes('..') || value.includes('/') || value.includes('\\') || value.includes('\0')) {
    return null;
  }
  if (!PRIVATE_UPLOAD_FILENAME_RE.test(value)) return null;
  return value;
}

export function resolveUploadPath(filename, uploadDir = UPLOAD_DIR) {
  const safe = parseUploadFilename(filename);
  if (!safe) return null;
  const root = path.resolve(uploadDir);
  const abs = path.resolve(root, safe);
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  if (rel.split(path.sep).length !== 1) return null;
  return abs;
}

export function filenameFromStoredUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const cleaned = imageUrl.split('?')[0].replace(/\\/g, '/');
  const base = cleaned.split('/').pop() || '';
  return parseUploadFilename(base);
}

export function storedUrlCandidates(filename) {
  const safe = parseUploadFilename(filename);
  if (!safe) return [];
  return [`/uploads/${safe}`, `/api/files/${safe}`];
}

export function mimeForFilename(filename) {
  const safe = parseUploadFilename(filename);
  if (!safe) return 'application/octet-stream';
  const ext = safe.split('.').pop()?.toLowerCase() || 'bin';
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

export function applyPrivateFileHeaders(res, { filename, mime }) {
  applyPrivateCache(res);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  return res;
}

/** Legacy public mount — never serves bytes. UUID is not authorization. */
export function denyLegacyPublicUploads(_req, res) {
  applyPrivateCache(res);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(401).json({ error: 'ავტორიზაცია საჭიროა.' });
}

export async function findOwnedMedicalUpload(userId, filename, db = prisma) {
  const urls = storedUrlCandidates(filename);
  if (!userId || urls.length === 0) return null;
  return db.medicalRecord.findFirst({
    where: { userId, imageUrl: { in: urls } },
    select: { id: true },
  });
}

export async function authorizePrivateUpload({
  userId,
  filename,
  findOwner = findOwnedMedicalUpload,
  uploadDir = UPLOAD_DIR,
}) {
  const parsed = parseUploadFilename(filename);
  if (!parsed) {
    return { ok: false, status: 400, error: 'ფაილის იდენტიფიკატორი არასწორია.' };
  }
  const abs = resolveUploadPath(parsed, uploadDir);
  if (!abs) {
    return { ok: false, status: 400, error: 'ფაილის იდენტიფიკატორი არასწორია.' };
  }
  if (!userId) {
    return { ok: false, status: 401, error: 'ავტორიზაცია საჭიროა. გთხოვთ, შეხვიდეთ სისტემაში.' };
  }
  const owner = await findOwner(userId, parsed);
  if (!owner) {
    return { ok: false, status: 404, error: 'ფაილი ვერ მოიძებნა.' };
  }
  if (!existsSync(abs)) {
    return { ok: false, status: 404, error: 'ფაილი ვერ მოიძებნა.' };
  }
  return { ok: true, status: 200, abs, filename: parsed, mime: mimeForFilename(parsed) };
}

export async function servePrivateUpload(req, res, options = {}) {
  const result = await authorizePrivateUpload({
    userId: req.user?.id,
    filename: req.params?.filename,
    findOwner: options.findOwner,
    uploadDir: options.uploadDir,
  });
  if (!result.ok) {
    applyPrivateCache(res);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const body = { error: result.error };
    if (JSON.stringify(body).includes(':/') || JSON.stringify(body).toLowerCase().includes('uploads\\')) {
      return res.status(result.status).json({ error: 'ფაილი ვერ მოიძებნა.' });
    }
    return res.status(result.status).json(body);
  }
  applyPrivateFileHeaders(res, { filename: result.filename, mime: result.mime });
  return res.sendFile(result.abs, (err) => {
    if (!err) return;
    if (!res.headersSent) {
      applyPrivateCache(res);
      res.status(404).json({ error: 'ფაილი ვერ მოიძებნა.' });
    }
  });
}

export async function unlinkStoredUpload(imageUrl, uploadDir = UPLOAD_DIR) {
  const filename = filenameFromStoredUrl(imageUrl);
  if (!filename) return false;
  const abs = resolveUploadPath(filename, uploadDir);
  if (!abs) return false;
  try {
    await unlink(abs);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    console.error('[uploads] unlink failed');
    return false;
  }
}
