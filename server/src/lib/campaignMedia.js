import path from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';

/**
 * Admin-only campaign media (owner request 2026-10-02): the „გაანათე თბილისი“ plan, posters, stories and print
 * PDFs live in server/private/press/<slug>/ (never in public/) and are served at /press/<slug>/… only to a
 * signed-in admin. Admin #/campaigns (and #/social thumbnails) first call POST /api/admin/campaigns/media-session,
 * which sets a short-lived HttpOnly cookie scoped to /press; images, the plan iframe and PDF links then load
 * like ordinary same-origin files. Everyone else gets a plain 404. Scheduled Metricool posts keep their own
 * copies of the images, so they never depend on these URLs.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PRIVATE_PRESS_ROOT = path.resolve(__dirname, '../../private/press');

export const MEDIA_COOKIE = 'medicard_admin_media';
export const MEDIA_COOKIE_PATH = '/press';
export const MEDIA_SESSION_SECONDS = 2 * 60 * 60;
const SCOPE = 'campaign-media';
const FILE_RE = /^[a-z0-9][a-z0-9._-]{0,120}\.(jpe?g|png|pdf|html)$/i;
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf', html: 'text/html; charset=utf-8' };

/** Campaigns whose media is admin-only. `slug` is the folder and URL segment. */
export const PRIVATE_CAMPAIGNS = [
  {
    id: 'medirun-glow-2026',
    slug: 'medirun-glow',
    brand: 'medirun',
    name: 'გაანათე თბილისი',
    start: '2026-10-05',
    end: '2026-12-31',
    rulesUrl: 'https://medicard.ge/medirun#rules',
    plan: 'plan.html',
    prints: [
      { file: 'pa3-key', name: 'A3 პოსტერი QR-ით', spec: '303×426 მმ, 3 მმ ზედნადებით' },
      { file: 'pa3-teaser', name: 'A3 თიზერი QR-ით', spec: '303×426 მმ, 3 მმ ზედნადებით' },
      { file: 'pa5-tent', name: 'A5 მაგიდის ბარათი', spec: '154×216 მმ, 3 მმ ზედნადებით' },
      { file: 'pst-sticker', name: 'ვიტრინის სტიკერი Ø150 მმ', spec: '156×156 მმ, მრგვალი ამოჭრა' },
      { file: 'pa4-partner', name: 'A4 ფურცელი პარტნიორებისთვის', spec: '210×297 მმ, ოფისის პრინტერისთვის' },
    ],
  },
  // Q4 social calendar (brand/social-q4): module posters + MEDIRUN economy-2 posts. Images only — #/social shows them.
  {
    id: 'medicard-q4-2026',
    slug: 'q4-2026',
    brand: 'medicard',
    name: 'MEDICARD · ოქტომბერი–დეკემბერი',
    start: '2026-10-05',
    end: '2026-12-31',
    rulesUrl: 'https://medicard.ge/medirun#rules',
    plan: null,
    prints: [],
  },
];
const BY_SLUG = new Map(PRIVATE_CAMPAIGNS.map((c) => [c.slug, c]));

export const isPrivateCampaignSlug = (slug) => BY_SLUG.has(String(slug || ''));

/** Absolute path of a campaign file, or null when the name is not a plain file name inside the folder. */
export function campaignFilePath(slug, name) {
  if (!BY_SLUG.has(slug) || !FILE_RE.test(String(name || ''))) return null;
  const dir = path.join(PRIVATE_PRESS_ROOT, slug);
  const file = path.resolve(dir, name);
  if (path.dirname(file) !== dir) return null;
  return file;
}

export const mediaContentType = (file) => TYPES[path.extname(file).slice(1).toLowerCase()] || 'application/octet-stream';

/** What #/campaigns lists: campaign facts and the print files that exist on disk (with sizes). */
export function campaignManifest() {
  return PRIVATE_CAMPAIGNS.map((c) => {
    const base = `/press/${c.slug}/`;
    const size = (name) => { const f = campaignFilePath(c.slug, name); try { return f && existsSync(f) ? statSync(f).size : null; } catch { return null; } };
    return {
      id: c.id, slug: c.slug, brand: c.brand, name: c.name, start: c.start, end: c.end, rulesUrl: c.rulesUrl,
      planUrl: size(c.plan) != null ? base + c.plan : null,
      prints: c.prints
        .map((p) => ({ ...p, pdf: base + `${p.file}.pdf`, preview: base + `${p.file}-preview.jpg`, bytes: size(`${p.file}.pdf`) }))
        .filter((p) => p.bytes != null),
    };
  });
}

export function signMediaSession(adminId) {
  return jwt.sign({ sub: adminId, scope: SCOPE }, env.JWT_SECRET, { expiresIn: MEDIA_SESSION_SECONDS });
}

export function mediaCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: MEDIA_COOKIE_PATH,
    maxAge: MEDIA_SESSION_SECONDS * 1000,
  };
}

export function readCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

/** The admin id when the cookie is a valid, unexpired media session; otherwise null. */
export function verifyMediaSession(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    return payload?.scope === SCOPE && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

const adminSeen = new Map();
async function adminExists(id) {
  const hit = adminSeen.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit.ok;
  const ok = Boolean(await prisma.admin.findUnique({ where: { id }, select: { id: true } }));
  adminSeen.set(id, { at: Date.now(), ok });
  if (adminSeen.size > 40) adminSeen.delete(adminSeen.keys().next().value);
  return ok;
}

function notFound(res) {
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  return res.status(404).type('text/plain').send('Not found');
}

/**
 * GET/HEAD /press/:slug/:file? — only private campaigns; public /press folders fall through to the static site.
 * No valid admin media cookie → 404 (the folder's existence is not confirmed). The old gallery address
 * (/press/<slug>/ or index.html) sends an admin to #/campaigns.
 */
export function campaignMediaGate({ isAdmin = adminExists } = {}) {
  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const m = /^\/press\/([a-z0-9-]+)(?:\/(.*))?$/i.exec(req.path);
    if (!m || !isPrivateCampaignSlug(m[1])) return next();
    try {
      const adminId = verifyMediaSession(readCookie(req.headers.cookie, MEDIA_COOKIE));
      if (!adminId || !(await isAdmin(adminId))) return notFound(res);
      const name = m[2] || '';
      if (name === '' || name === 'index.html') {
        res.set('Cache-Control', 'no-store');
        return res.redirect(302, '/admin/#/campaigns');
      }
      const file = campaignFilePath(m[1], name);
      if (!file || !existsSync(file)) return notFound(res);
      const html = file.endsWith('.html');
      res.set({
        'Content-Type': mediaContentType(file),
        'Cache-Control': html ? 'no-store' : 'private, max-age=600',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'same-origin',
      });
      return res.sendFile(file);
    } catch (error) {
      return next(error);
    }
  };
}
