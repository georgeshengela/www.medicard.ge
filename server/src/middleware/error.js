import multer from 'multer';
import { ZodError } from 'zod';
import { AiEngineError } from '../lib/evidencemd.js';
import { env } from '../config/env.js';

export function notFound(req, res) {
  res.status(404).json({ error: 'მოთხოვნილი მისამართი ვერ მოიძებნა.', path: req.originalUrl });
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
export function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'შევსებული მონაცემები არასწორია.',
      fields: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  if (error instanceof AiEngineError) {
    return res.status(error.status).json({ error: error.message, code: 'AI_ENGINE_ERROR' });
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'ფაილი ძალიან დიდია. მაქსიმალური ზომაა 12 მეგაბაიტი.'
        : 'ფაილის ატვირთვა ვერ მოხერხდა.';
    return res.status(400).json({ error: message });
  }

  if (error?.code === 'P2002') {
    return res.status(409).json({ error: 'ასეთი ჩანაწერი უკვე არსებობს.' });
  }
  if (error?.code === 'P2025') {
    return res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა.' });
  }

  console.error('[medicard] Unhandled error:', error);
  return res.status(500).json({
    error: 'სერვერზე მოხდა შეცდომა. გთხოვთ, სცადოთ მოგვიანებით.',
    ...(env.NODE_ENV === 'development' ? { detail: error?.message } : {}),
  });
}

/** Removes the try/catch boilerplate from every async route handler. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
