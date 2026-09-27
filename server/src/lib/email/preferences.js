/**
 * Direct-marketing email consent (User.emailMarketingOptIn / emailMarketingOptInAt, raw SQL —
 * the Prisma fields are @ignore so the generated client never depends on these columns).
 * Law 3144: prior explicit consent, off by default, withdrawable at any time (app toggle,
 * one-click unsubscribe link, RFC 8058 List-Unsubscribe-Post). Transactional mail is unaffected.
 *
 * Unsubscribe tokens: `<userId base64url>.<HMAC-SHA256 truncated, base64url>` with a key derived
 * from JWT_SECRET for this purpose only. No expiry — an unsubscribe link must keep working.
 */
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../prisma.js';
import { isDeliverableEmail } from './address.js';
import { SITE_URL } from './templates.js';

const isMissingColumn = (error) => /emailMarketingOptIn|42703|column .* does not exist/i.test(String(error?.message || error?.meta?.message || ''));

function unsubscribeKey(secret = env.JWT_SECRET) {
  return crypto.createHmac('sha256', String(secret)).update('medicard:email-unsubscribe:v1').digest();
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function signUnsubscribeToken(userId, { secret } = {}) {
  const id = String(userId || '');
  if (!id) throw new Error('userId required');
  const mac = crypto.createHmac('sha256', unsubscribeKey(secret)).update(`unsub:${id}`).digest().subarray(0, 18);
  return `${b64url(id)}.${b64url(mac)}`;
}

/** userId for a valid token, else null. Constant-time comparison. */
export function verifyUnsubscribeToken(token, { secret } = {}) {
  const [idPart, macPart, extra] = String(token || '').split('.');
  if (!idPart || !macPart || extra !== undefined || idPart.length > 200) return null;
  let id;
  try { id = Buffer.from(idPart, 'base64url').toString('utf8'); } catch { return null; }
  if (!id || !/^[A-Za-z0-9-]{1,100}$/.test(id)) return null;
  const expected = Buffer.from(signUnsubscribeToken(id, { secret }).split('.')[1]);
  const given = Buffer.from(macPart);
  if (given.length !== expected.length) return null;
  return crypto.timingSafeEqual(given, expected) ? id : null;
}

export function unsubscribeUrl(userId, opts) {
  return `${SITE_URL}/unsubscribe?t=${encodeURIComponent(signUnsubscribeToken(userId, opts))}`;
}

/** { marketingOptIn, optInAt, canReceive } for the app settings screen. */
export async function getEmailPreferences(userId, { db = prisma } = {}) {
  let rows;
  try {
    rows = await db.$queryRaw`SELECT email, "emailMarketingOptIn" AS "optIn", "emailMarketingOptInAt" AS "optInAt" FROM "User" WHERE id = ${userId}`;
  } catch (error) {
    if (!isMissingColumn(error)) throw error;
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    rows = user ? [{ email: user.email, optIn: false, optInAt: null }] : [];
  }
  const row = rows[0];
  if (!row) return null;
  return { marketingOptIn: row.optIn === true, optInAt: row.optInAt || null, canReceive: isDeliverableEmail(row.email) };
}

/** Sets consent; opt-in stamps the time of consent, opt-out clears it. */
export async function setEmailMarketingOptIn(userId, optIn, { db = prisma } = {}) {
  if (optIn) {
    await db.$executeRaw`UPDATE "User" SET "emailMarketingOptIn" = true, "emailMarketingOptInAt" = CURRENT_TIMESTAMP WHERE id = ${userId} AND "emailMarketingOptIn" = false`;
  } else {
    await db.$executeRaw`UPDATE "User" SET "emailMarketingOptIn" = false, "emailMarketingOptInAt" = NULL WHERE id = ${userId} AND "emailMarketingOptIn" = true`;
  }
  return getEmailPreferences(userId, { db });
}

/** One-click unsubscribe. Returns 'ok' | 'invalid' | 'gone'. Idempotent. */
export async function unsubscribeWithToken(token, { db = prisma, secret } = {}) {
  const userId = verifyUnsubscribeToken(token, { secret });
  if (!userId) return 'invalid';
  const changed = await db.$executeRaw`UPDATE "User" SET "emailMarketingOptIn" = false, "emailMarketingOptInAt" = NULL WHERE id = ${userId}`;
  return changed > 0 ? 'ok' : 'gone';
}

const PAGE_COPY = {
  ok: {
    title: 'გამოწერა გაუქმებულია',
    ka: 'მედიქარდი აღარ გამოგიგზავნის სიახლეებსა და რჩევებს ელფოსტით. სერვისული წერილები (მაგ. პაროლის აღდგენა) კვლავ მოვა. თუ გადაიფიქრებ, ჩართე აპში: პროფილი → შეტყობინებები.',
    en: 'You will no longer receive MEDICARD news and tips by email. Service emails (such as password reset codes) still arrive. You can turn it back on in the app: Profile → Notifications.',
  },
  gone: {
    title: 'ანგარიში ვერ მოიძებნა',
    ka: 'ეს ანგარიში აღარ არსებობს, ამიტომ მასზე წერილები აღარ იგზავნება.',
    en: 'This account no longer exists, so no emails are sent to it.',
  },
  invalid: {
    title: 'ბმული არასწორია',
    ka: 'ეს ბმული არასწორია ან დაზიანებულია. გამოწერის გაუქმება შეგიძლია აპშიც: პროფილი → შეტყობინებები, ან მოგვწერე support@medicard.ge.',
    en: 'This link is invalid or incomplete. You can also unsubscribe in the app (Profile → Notifications) or write to support@medicard.ge.',
  },
  error: {
    title: 'დროებითი შეფერხება',
    ka: 'ახლა ვერ მოხერხდა. სცადე ცოტა ხანში ან მოგვწერე support@medicard.ge.',
    en: 'Something went wrong. Please try again shortly or write to support@medicard.ge.',
  },
};

/** Public, bilingual result page in the landing style (self-contained, light + dark). */
export function unsubscribePageHtml(result) {
  const c = PAGE_COPY[result] || PAGE_COPY.invalid;
  const ok = result === 'ok';
  return `<!DOCTYPE html>
<html lang="ka">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<title>${c.title} — მედიქარდი</title>
<link rel="icon" href="/favicon.png">
<style>
  @font-face { font-family: FiraGO; src: url(/fonts/firago/FiraGO-Regular.woff2) format('woff2'); font-display: swap; }
  :root { --bg:#f3f5f6; --card:#ffffff; --ink:#0f172a; --muted:#475569; --teal:#0D9488; --tint:#f0fdfa; }
  @media (prefers-color-scheme: dark) { :root { --bg:#030712; --card:#111827; --ink:#ffffff; --muted:#D1D5DB; --teal:#14B8A6; --tint:#042F2E; } }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px 16px; background:var(--bg); color:var(--ink); font-family:FiraGO,'Noto Sans Georgian','Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  main { width:100%; max-width:480px; background:var(--card); border-radius:22px; padding:32px 28px; }
  .brand { display:flex; align-items:center; gap:10px; text-decoration:none; color:var(--ink); font-weight:700; font-size:18px; margin-bottom:24px; }
  .brand img { border-radius:10px; }
  .badge { width:48px; height:48px; border-radius:14px; background:var(--tint); color:var(--teal); display:flex; align-items:center; justify-content:center; margin-bottom:16px; }
  h1 { font-size:22px; line-height:30px; margin:0 0 12px; }
  p { margin:0 0 14px; line-height:24px; color:var(--muted); font-size:15px; }
  p[lang=en] { font-size:14px; border-top:1px solid rgba(148,163,184,.25); padding-top:14px; margin-top:18px; }
  a.home { display:inline-block; margin-top:8px; color:#fff; background:var(--teal); padding:12px 22px; border-radius:12px; text-decoration:none; font-weight:700; }
</style>
</head>
<body>
<main>
  <a class="brand" href="/"><img src="/icon.png" width="36" height="36" alt="">მედიქარდი</a>
  <div class="badge" aria-hidden="true">${ok
    ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
    : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16.5" x2="12" y2="16.5"/></svg>'}</div>
  <h1>${c.title}</h1>
  <p>${c.ka}</p>
  <p lang="en">${c.en}</p>
  <a class="home" href="/">medicard.ge</a>
</main>
</body>
</html>`;
}
