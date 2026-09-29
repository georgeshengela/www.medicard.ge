/**
 * Mailer core: template → render → suppression / kill-switch / idempotency checks → Resend → EmailLog.
 *
 * Guarantees
 *   - Kill switch: feature flag `email` (admin მოდულები or #/email) stops every send.
 *   - Per-template switch: EmailTemplate.enabled.
 *   - Suppressed addresses (hard bounce / complaint) never receive anything, transactional
 *     included — a password-reset code to a dead or complaining mailbox helps no one and hurts
 *     the sending domain. Admin can lift a suppression in #/email.
 *   - `idempotencyKey` is claimed in EmailLog (unique) before sending and passed to Resend as
 *     Idempotency-Key, so welcome / account_deleted go out at most once.
 *   - Logs hold sha256 + masked address only; no bodies, no codes, no health data.
 */
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../prisma.js';
import { isFeatureEnabled } from '../featureFlags.js';
import { hashEmail, isDeliverableEmail, maskEmail, normalizeEmail } from './address.js';
import { CAMPAIGN_VARS, DEFAULT_TEMPLATES, SITE_URL, emailLang, mergeTemplate, renderEmail } from './templates.js';
import { getUserLanguage } from '../i18n.js';
import { createResendTransport } from './transport.js';
import { unsubscribeUrl } from './preferences.js';

export const EMAIL_FEATURE = 'email';
const TEMPLATE_TTL_MS = 30_000;
const isMissingTable = (error) => /Email(Log|Template|Suppression|Campaign)|42P01|P2021|does not exist/i.test(String(error?.message || error?.code || ''));

let defaultTransport = null;
export function getDefaultTransport() {
  if (!defaultTransport) defaultTransport = createResendTransport({ apiKey: env.RESEND_API_KEY });
  return defaultTransport;
}

export function emailConfig() {
  return {
    resendConfigured: Boolean(env.RESEND_API_KEY),
    webhookConfigured: Boolean(env.RESEND_WEBHOOK_SECRET),
    from: env.RESEND_FROM,
    replyTo: env.EMAIL_REPLY_TO,
  };
}

/** Variables every template may use. Never add health data here. */
export function commonVars({ fullName, lang = 'ka' } = {}) {
  const first = String(fullName || '').trim().split(/\s+/)[0] || '';
  const generic = !first || /^medicard$/i.test(first);
  return {
    name: generic ? (emailLang(lang) === 'en' ? 'friend' : 'მეგობარო') : first.slice(0, 40),
    appUrl: SITE_URL,
    supportEmail: env.EMAIL_REPLY_TO || 'support@medicard.ge',
    appStoreUrl: env.APP_STORE_URL || `${SITE_URL}/#download`,
    playStoreUrl: env.PLAY_STORE_URL || `${SITE_URL}/#download`,
  };
}

/* ───────── Templates (code default + DB override, cached) ───────── */
let templateCache = { at: 0, rows: null };

export async function loadTemplateRows({ db = prisma, fresh = false } = {}) {
  if (!fresh && templateCache.rows && Date.now() - templateCache.at < TEMPLATE_TTL_MS) return templateCache.rows;
  try {
    const rows = await db.emailTemplate.findMany();
    templateCache = { at: Date.now(), rows };
    return rows;
  } catch (error) {
    if (!isMissingTable(error)) console.warn('[email] template read failed — using defaults', error?.message);
    return [];
  }
}

export function resetEmailCachesForTests() {
  templateCache = { at: 0, rows: null };
  defaultTransport = null;
}
export const invalidateTemplateCache = () => { templateCache = { at: 0, rows: null }; };

export async function resolveTemplate(key, { db = prisma, rows, lang = 'ka' } = {}) {
  const list = rows || (await loadTemplateRows({ db }));
  return mergeTemplate(key, list.find((r) => r.key === key), lang);
}

export async function listTemplates({ db = prisma } = {}) {
  const rows = await loadTemplateRows({ db, fresh: true });
  return Object.keys(DEFAULT_TEMPLATES).map((key) => mergeTemplate(key, rows.find((r) => r.key === key)));
}

/* ───────── Suppression ───────── */
export async function isSuppressed(toHash, { db = prisma } = {}) {
  try {
    return Boolean(await db.emailSuppression.findUnique({ where: { toHash } }));
  } catch (error) {
    if (isMissingTable(error)) return false;
    throw error;
  }
}

export async function suppressedHashes(hashes, { db = prisma } = {}) {
  if (!hashes.length) return new Set();
  try {
    const rows = await db.emailSuppression.findMany({ where: { toHash: { in: hashes } }, select: { toHash: true } });
    return new Set(rows.map((r) => r.toHash));
  } catch (error) {
    if (isMissingTable(error)) return new Set();
    throw error;
  }
}

/* ───────── Log ───────── */
async function createLog(db, data) {
  try {
    return await db.emailLog.create({ data: { id: randomUUID(), ...data } });
  } catch (error) {
    if (error?.code === 'P2002') return 'duplicate';
    if (isMissingTable(error)) return null;
    throw error;
  }
}

async function updateLog(db, id, data) {
  if (!id) return;
  try {
    await db.emailLog.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
  } catch (error) {
    if (!isMissingTable(error)) console.warn('[email] log update failed', error?.message);
  }
}

const shortError = (error) => String(error?.code && error.code !== 'PROVIDER_ERROR' ? `${error.code}: ${error.message}` : error?.message || error).slice(0, 300);

/**
 * Sends one templated email.
 * @returns {Promise<{ status: 'sent'|'skipped'|'failed', reason?: string, providerId?: string, logId?: string }>}
 * Throws only for failures when `throwOnError` (password reset keeps its old contract).
 */
export async function sendEmail({
  to,
  templateKey,
  vars = {},
  userId = null,
  category,
  idempotencyKey = null,
  content = null,
  allowedVars = null,
  previewUnsubscribeUrl = '',
  subjectPrefix = '',
  ignoreTemplateSwitch = false,
  throwOnError = false,
  // Support replies (#/support): own sender, threading headers (In-Reply-To / References).
  from = null,
  replyTo = null,
  extraHeaders = null,
  // Recipient language ('ka' | 'en'). Omitted: the stored language of `userId` (Georgian when unknown).
  lang = undefined,
} = {}, {
  db = prisma,
  transport = getDefaultTransport(),
  featureEnabled = (key) => isFeatureEnabled(key),
} = {}) {
  const email = normalizeEmail(to);
  if (!isDeliverableEmail(email)) return { status: 'skipped', reason: 'undeliverable' };

  const language = emailLang(lang ?? (userId && db === prisma ? await getUserLanguage(userId) : 'ka'));
  const en = language === 'en';
  const template = await resolveTemplate(templateKey, { db, lang: language });
  if (!template && !content) throw new Error(`Unknown email template: ${templateKey}`);
  const cat = category || template?.category || 'transactional';

  if (!(await featureEnabled(EMAIL_FEATURE))) {
    if (throwOnError) throw Object.assign(new Error(en ? 'Sending email is paused for now.' : 'ელფოსტის გაგზავნა დროებით შეჩერებულია.'), { code: 'EMAIL_DISABLED', status: 503 });
    return { status: 'skipped', reason: 'disabled' };
  }
  if (template && !template.enabled && !ignoreTemplateSwitch) {
    if (throwOnError) throw Object.assign(new Error(en ? 'This email is turned off for now.' : 'ეს წერილი დროებით გამორთულია.'), { code: 'TEMPLATE_DISABLED', status: 503 });
    return { status: 'skipped', reason: 'template_disabled' };
  }
  if (!transport?.configured) {
    console.warn(`[email] RESEND_API_KEY missing — ${templateKey} to ${maskEmail(email)} not sent`);
    return { status: 'skipped', reason: 'not_configured' };
  }

  const toHash = hashEmail(email);
  const allowed = allowedVars || template?.vars || CAMPAIGN_VARS;
  const unsub = cat === 'marketing' && userId ? unsubscribeUrl(userId, { lang: language }) : '';
  const rendered = renderEmail({ content: content || template, vars: { ...commonVars({ lang: language }), ...vars }, allowed, category: cat, unsubscribeUrl: unsub || previewUnsubscribeUrl, lang: language });
  const subject = `${subjectPrefix}${rendered.subject}`;
  const base = { userId, toHash, toMasked: maskEmail(email), templateKey, category: cat, subject: subject.slice(0, 200) };

  if (await isSuppressed(toHash, { db })) {
    await createLog(db, { ...base, status: 'suppressed', error: 'SUPPRESSED', idempotencyKey });
    return { status: 'skipped', reason: 'suppressed' };
  }

  const log = await createLog(db, { ...base, status: 'queued', idempotencyKey });
  if (log === 'duplicate') return { status: 'skipped', reason: 'duplicate' };
  const logId = log?.id || null;

  const headers = { ...(extraHeaders || {}) };
  if (cat === 'marketing' && unsub) {
    headers['List-Unsubscribe'] = `<${unsub}>, <mailto:${env.EMAIL_REPLY_TO || 'support@medicard.ge'}?subject=unsubscribe>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  try {
    const result = await transport.send({
      from: from || env.RESEND_FROM,
      to: email,
      subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: replyTo || env.EMAIL_REPLY_TO || undefined,
      headers,
      tags: [{ name: 'template', value: String(templateKey).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256) }],
    }, { idempotencyKey: idempotencyKey || logId || undefined });
    await updateLog(db, logId, { status: 'sent', providerId: result?.id || null });
    return { status: 'sent', providerId: result?.id || null, logId };
  } catch (error) {
    await updateLog(db, logId, { status: 'failed', error: shortError(error) });
    if (throwOnError) throw error;
    return { status: 'failed', reason: shortError(error), logId };
  }
}

/* ───────── Triggers ───────── */

/**
 * Welcome email after sign-up. Fire-and-forget: returns immediately, never throws, never delays
 * the sign-up response. Once per user ever (EmailLog idempotency key welcome:<userId>).
 */
export function queueWelcomeEmail(user, deps = {}, { schedule = setImmediate, lang } = {}) {
  if (!user?.id || !isDeliverableEmail(user.email)) return false;
  // The sign-up request's language (opts.lang / user.lang); otherwise the stored account language.
  const language = lang ?? user.lang ?? user.language ?? undefined;
  const promise = new Promise((resolve) => {
    schedule(() => {
      sendEmail({
        to: user.email,
        templateKey: 'welcome',
        vars: commonVars({ fullName: user.fullName, lang: language }),
        userId: user.id,
        idempotencyKey: `welcome:${user.id}`,
        lang: language,
      }, deps)
        .then((result) => {
          if (result.status === 'failed') console.warn('[email] welcome failed', result.reason);
          resolve(result);
        })
        .catch((error) => {
          console.warn('[email] welcome error', error?.message || error);
          resolve({ status: 'failed', reason: error?.message || String(error) });
        });
    });
  });
  queueWelcomeEmail.lastRun = promise;
  return true;
}

/**
 * Confirmation after the account was deleted. Call with values captured BEFORE deletion, only
 * after the deletion committed. Not linked to the (deleted) user id; never throws.
 */
export function queueAccountDeletedEmail({ userId, email, fullName, lang = 'ka' }, deps = {}, { schedule = setImmediate } = {}) {
  if (!isDeliverableEmail(email)) return false;
  const promise = new Promise((resolve) => {
    schedule(() => {
      sendEmail({
        to: email,
        templateKey: 'account_deleted',
        vars: commonVars({ fullName, lang }),
        userId: null,
        idempotencyKey: userId ? `account_deleted:${userId}` : null,
        lang,
      }, deps)
        .then(resolve)
        .catch((error) => {
          console.warn('[email] account_deleted error', error?.message || error);
          resolve({ status: 'failed', reason: error?.message || String(error) });
        });
    });
  });
  queueAccountDeletedEmail.lastRun = promise;
  return true;
}

/**
 * Password reset code (signature unchanged for passwordReset.js). Without RESEND_API_KEY it keeps
 * the old behaviour: log the code to the console and return { id: 'dev-log' }. Failures throw.
 */
export async function sendPasswordResetCode({ to, code, fullName, lang = 'ka' }, deps = {}) {
  const transport = deps.transport || getDefaultTransport();
  if (!transport?.configured) {
    console.log(`[email] password reset code for ${to}: ${code}`);
    return { id: 'dev-log' };
  }
  const result = await sendEmail({
    to,
    templateKey: 'password_reset',
    vars: { ...commonVars({ fullName, lang }), code: String(code), minutes: '10' },
    throwOnError: true,
    lang,
  }, { ...deps, transport });
  if (result.status === 'skipped' && result.reason === 'suppressed') {
    console.warn(`[email] password reset to suppressed address ${maskEmail(to)} not sent`);
  }
  return { id: result.providerId || null, status: result.status, reason: result.reason };
}
