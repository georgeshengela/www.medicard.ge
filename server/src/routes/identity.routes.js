import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { applyPrivateCache } from '../lib/cycleShare.js';
import { saveUpload } from '../lib/storage.js';
import { servePrivateUpload, unlinkStoredUpload } from '../lib/privateUploads.js';
import { avatarUrl, canViewAvatar, getAvatar, getOrCreateQr, qrLink, removeAvatar, rotateQr, setAvatar } from '../lib/identity.js';

/** Mounted at /api/identity: /avatar (own photo), /avatars/:userId (view with a check), /qr (own personal QR). */
export const identityRouter = Router();
identityRouter.use(requireAuth);
identityRouter.use((_req, res, next) => {
  applyPrivateCache(res);
  next();
});

const writeLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, validate: false, message: { error: 'ძალიან ბევრი მცდელობა. სცადე მოგვიანებით.', code: 'RATE_LIMITED' } });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(String(file.mimetype || '').toLowerCase());
    cb(ok ? null : Object.assign(new Error('ატვირთე JPEG, PNG ან WEBP ფოტო.'), { status: 400 }), ok);
  },
});

identityRouter.get('/avatar/me', asyncHandler(async (req, res) => {
  const row = await getAvatar(req.user.id);
  res.json({ avatarUrl: avatarUrl(req.user.id, row?.updatedAt) });
}));

identityRouter.post('/avatar', writeLimiter, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file?.buffer?.length) return res.status(400).json({ error: 'ფოტო არ არის მიმაგრებული.' });
  let buffer;
  try {
    // Square crop, re-encoded: strips EXIF/GPS and bounds the size.
    buffer = await sharp(req.file.buffer, { limitInputPixels: 60_000_000, failOn: 'error' }).rotate().resize(512, 512, { fit: 'cover', position: 'attention' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  } catch {
    return res.status(400).json({ error: 'ფოტო ვერ დამუშავდა. აირჩიე სხვა ფოტო.' });
  }
  const key = await saveUpload(buffer, 'image/jpeg');
  const { updatedAt, previousKey } = await setAvatar(req.user.id, key);
  if (previousKey) await unlinkStoredUpload(previousKey);
  res.status(201).json({ avatarUrl: avatarUrl(req.user.id, updatedAt) });
}));

identityRouter.delete('/avatar', writeLimiter, asyncHandler(async (req, res) => {
  const key = await removeAvatar(req.user.id);
  if (key) await unlinkStoredUpload(key);
  res.json({ avatarUrl: null });
}));

identityRouter.get('/avatars/:userId', asyncHandler(async (req, res) => {
  const targetId = String(req.params.userId);
  const row = await getAvatar(targetId);
  const allowed = row ? await canViewAvatar(req.user.id, targetId, req.query.qr ? String(req.query.qr) : null) : false;
  if (!row || !allowed) return res.status(404).json({ error: 'ფოტო ვერ მოიძებნა.' });
  req.params.filename = String(row.fileKey).split('/').pop();
  return servePrivateUpload(req, res, { findOwner: async () => ({ ok: true }) });
}));

identityRouter.get('/qr/me', asyncHandler(async (req, res) => {
  const token = await getOrCreateQr(req.user.id);
  res.json({ token, link: qrLink(token) });
}));

identityRouter.post('/qr/rotate', writeLimiter, asyncHandler(async (req, res) => {
  const token = await rotateQr(req.user.id);
  res.json({ token, link: qrLink(token) });
}));
