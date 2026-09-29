/**
 * Request / account language (ka | en).
 *
 * The app, the web portal and the site send `X-Medicard-Lang`. Anything a person reads that the
 * server writes — API error messages, AI answers, pushes, emails — follows it. Georgian stays the
 * default: a missing or unknown header is Georgian, and so is every account that never chose.
 *
 * Background senders (push, email) have no request, so the last language an account used is kept
 * in "User"."language" (raw SQL; the Prisma field is @ignore, like emailMarketingOptIn).
 */
import { prisma } from './prisma.js';

export const LANGS = Object.freeze(['ka', 'en']);

/** 'en' for any English tag (en, en-US, EN_gb), 'ka' for Georgian; null when not a language we serve. */
export function parseLang(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (/^en\b|^en[-_]/.test(raw) || raw === 'en') return 'en';
  if (/^ka\b|^ka[-_]/.test(raw) || raw === 'ka') return 'ka';
  return null;
}

/** Normalise to one of LANGS (default Georgian). */
export function normalizeLang(value) {
  return parseLang(value) ?? 'ka';
}

/** Express middleware: sets req.lang ('ka' | 'en') and req.langExplicit. */
export function langMiddleware(req, _res, next) {
  const explicit = parseLang(req.headers?.['x-medicard-lang']) ?? parseLang(req.query?.lang);
  req.lang = explicit ?? 'ka';
  req.langExplicit = Boolean(explicit);
  next();
}

/** Language of a request, a lang string, or an object with `.lang`. */
export function langOf(source) {
  if (!source) return 'ka';
  if (typeof source === 'string') return normalizeLang(source);
  if (typeof source.lang === 'string') return normalizeLang(source.lang);
  return 'ka';
}

/**
 * Pick the copy for a request/language: `t(req, 'ქართული', 'English')`.
 * @template T
 * @param {unknown} source req | 'ka' | 'en'
 * @param {T} kaValue
 * @param {T} enValue
 * @returns {T}
 */
export function t(source, kaValue, enValue) {
  return langOf(source) === 'en' ? enValue : kaValue;
}

export function isEnglish(source) {
  return langOf(source) === 'en';
}

/** BCP-47 locale for toLocale*String on the server. */
export function dateLocaleFor(source) {
  return langOf(source) === 'en' ? 'en-GB' : 'ka-GE';
}

/**
 * Appended to AI system prompts. Prompts are written in Georgian and often say "answer in Georgian";
 * this line overrides that for English users. Empty for Georgian.
 */
export function aiLanguageDirective(source) {
  if (langOf(source) !== 'en') return '';
  return [
    'RESPONSE LANGUAGE: English.',
    'The person uses the app in English. Write every user-facing word of your reply in clear, natural, warm English,',
    'even where the instructions above say to answer in Georgian or show Georgian examples.',
    'Keep the same structure, safety rules and JSON keys; translate only the human-readable text.',
    'Keep medicine brand names as written; Georgian place names may be given in their usual English spelling.',
  ].join(' ');
}

const remembered = new Map();
const REMEMBER_MAX = 50_000;

/** Save the language an account is using (at most one write per account per process and change). */
export function rememberUserLanguage(userId, lang) {
  const id = String(userId || '');
  const value = parseLang(lang);
  if (!id || !value || remembered.get(id) === value) return;
  if (remembered.size > REMEMBER_MAX) remembered.clear();
  remembered.set(id, value);
  prisma
    .$executeRaw`UPDATE "User" SET "language" = ${value} WHERE "id" = ${id} AND "language" IS DISTINCT FROM ${value}`
    .catch(() => {
      // Column not installed yet or DB hiccup: try again on a later request.
      remembered.delete(id);
    });
}

/** Stored language of one account (Georgian when unknown). */
export async function getUserLanguage(userId) {
  const map = await getUserLanguages([userId]);
  return map.get(String(userId)) ?? 'ka';
}

/** Map userId → 'ka' | 'en' for background senders. Missing ids / column → Georgian. */
export async function getUserLanguages(userIds) {
  const ids = [...new Set((userIds || []).map((id) => String(id || '')).filter(Boolean))];
  const out = new Map();
  if (!ids.length) return out;
  try {
    const rows = await prisma.$queryRaw`SELECT "id", "language" FROM "User" WHERE "id" = ANY(${ids}::text[])`;
    for (const row of rows) out.set(String(row.id), normalizeLang(row.language));
  } catch {
    /* column missing before install — everyone reads Georgian */
  }
  for (const id of ids) if (!out.has(id)) out.set(id, remembered.get(id) ?? 'ka');
  return out;
}
