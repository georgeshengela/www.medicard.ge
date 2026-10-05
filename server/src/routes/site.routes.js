import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/error.js';
import { RATE_LIMIT_VALIDATE } from '../lib/rateLimitKey.js';
import { getSitePresence } from '../lib/sitePresence.js';
import { countryNameEn, countryNameKa } from '../lib/geoPlace.js';

/** Public data for the marketing site (no auth). */
export const siteRouter = Router();
const publicLimit = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false, validate: RATE_LIMIT_VALIDATE });

// Front-page world map: ISO codes of countries with at least one MEDICARD user
siteRouter.get('/presence', publicLimit, asyncHandler(async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  const countries = await getSitePresence();
  const names = Object.fromEntries(countries.map((code) => [code, { ka: countryNameKa(code) || countryNameEn(code), en: countryNameEn(code) }]));
  res.json({ countries, names });
}));
