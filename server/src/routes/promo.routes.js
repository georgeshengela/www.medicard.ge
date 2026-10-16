/**
 * medicard.ge/promo — the influencer portal API (/api/promo). Influencer accounts are their own (email + password,
 * httpOnly SameSite=Strict session cookie on /api/promo), never a consumer health account. Writes also refuse a
 * foreign Origin. Health data never appears here: the dashboard shows counts and days only.
 */
import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/error.js';
import { t } from '../lib/i18n.js';
import { isFeatureEnabled, featureDisabledMessage } from '../lib/featureFlags.js';
import { unlinkStoredUpload } from '../lib/privateUploads.js';
import { sendEmail } from '../lib/email/mailer.js';
import { commonVars } from '../lib/email/mailer.js';
import { notifyOwner } from '../lib/director/service.js';
import * as store from '../lib/influencer/store.js';
import { sendInfluencerPhoto, storeInfluencerPhoto } from '../lib/influencer/photo.js';
import {
  CODE_PROBLEMS, PASSWORD_MIN, SOCIAL_KEYS, cleanName, formatGel, normalizeEmail, normalizePhone, normalizeSocial,
  passwordProblem, validatePayoutDetails,
} from '../lib/influencer/rules.js';

export const promoRouter = Router();

const COOKIE = 'mc_promo';
const COOKIE_PATH = '/api/promo';
const PORTAL_URL = 'https://medicard.ge/promo';

function readCookie(req, name) {
  const header = String(req.headers.cookie || '');
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function setSessionCookie(req, res, token) {
  const secure = req.secure || process.env.NODE_ENV === 'production';
  res.append('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=${store.SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`);
}

function clearSessionCookie(req, res) {
  const secure = req.secure || process.env.NODE_ENV === 'production';
  res.append('Set-Cookie', `${COOKIE}=; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`);
}

/** Director Telegram notice — production only, so local test servers on the main DB never ping the owner. */
function ownerNotice(text) {
  if (process.env.NODE_ENV !== 'production') return;
  void notifyOwner(text).catch(() => undefined);
}

const fail = (req, res, status, ka, en, extra = {}) => res.status(status).json({ error: t(req, ka, en), ...extra });

promoRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  // A write from another site never carries the Strict cookie; refuse a foreign Origin as well.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.get('origin');
    if (origin) {
      let host = '';
      try {
        host = new URL(origin).host;
      } catch {
        host = '';
      }
      if (host !== req.get('host')) return fail(req, res, 403, 'მოთხოვნა უარყოფილია.', 'Request refused.', { code: 'BAD_ORIGIN' });
    }
  }
  return next();
});

const limiter = (windowMs, limit) => rateLimit({
  windowMs,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: (req) => ({ error: t(req, 'ძალიან ბევრი მცდელობა. სცადე მოგვიანებით.', 'Too many attempts. Please try again later.'), code: 'RATE_LIMITED' }),
});
const signupLimiter = limiter(60 * 60_000, 8);
const signinLimiter = limiter(15 * 60_000, 15);
const resetLimiter = limiter(60 * 60_000, 8);
const writeLimiter = limiter(10 * 60_000, 80);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 30 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(String(file.mimetype || '').toLowerCase());
    cb(ok ? null : Object.assign(new Error('ატვირთე JPEG, PNG ან WEBP ფოტო.'), { status: 400, messageEn: 'Upload a JPEG, PNG or WEBP photo.', expose: true }), ok);
  },
});

/** Writes that the module switch can stop: sign-up, own code, payout request. Sign-in and reading stay open. */
async function programOn(req, res, next) {
  if (await isFeatureEnabled('influencers')) return next();
  return res.status(503).json({ error: await featureDisabledMessage('influencers', undefined, req.lang), code: 'FEATURE_DISABLED', feature: 'influencers' });
}

async function authed(req, res, next) {
  const token = readCookie(req, COOKIE);
  const session = token ? await store.sessionFromToken(token) : null;
  if (!session) return fail(req, res, 401, 'შედი ანგარიშში.', 'Please sign in.', { code: 'PROMO_AUTH' });
  if (session.influencer.status === 'BLOCKED') {
    await store.deleteSession(token);
    clearSessionCookie(req, res);
    return fail(req, res, 403, 'ანგარიში დაბლოკილია. მოგვწერე support@medicard.ge-ზე.', 'This account is blocked. Write to support@medicard.ge.', { code: 'PROMO_BLOCKED' });
  }
  req.influencer = session.influencer;
  req.promoSessionId = session.sessionId;
  req.promoToken = token;
  return next();
}

/** Socials from a form; Instagram and TikTok are required, the rest optional. Returns { socials } or { field }. */
function readSocials(body, { requireMain = true } = {}) {
  const socials = {};
  for (const key of SOCIAL_KEYS) {
    const value = normalizeSocial(key, body?.[key]);
    if (value === null) return { field: key };
    if (value) socials[key] = value;
  }
  if (requireMain && !socials.instagram) return { field: 'instagram', missing: true };
  if (requireMain && !socials.tiktok) return { field: 'tiktok', missing: true };
  return { socials };
}

const SOCIAL_MESSAGES = {
  instagram: ['Instagram-ის სახელი არასწორია. ჩაწერე მაგ. @nino.be ან პროფილის ბმული.', 'That Instagram name looks wrong. Use e.g. @nino.be or the profile link.'],
  tiktok: ['TikTok-ის სახელი არასწორია. ჩაწერე მაგ. @nino.be ან პროფილის ბმული.', 'That TikTok name looks wrong. Use e.g. @nino.be or the profile link.'],
  facebook: ['Facebook-ის ბმული არასწორია.', 'That Facebook link looks wrong.'],
  youtube: ['YouTube-ის არხი არასწორია.', 'That YouTube channel looks wrong.'],
  other: ['ბმული არასწორია.', 'That link looks wrong.'],
};

function socialFail(req, res, check) {
  if (check.missing) {
    return fail(req, res, 400, check.field === 'instagram' ? 'Instagram სავალდებულოა.' : 'TikTok სავალდებულოა.', check.field === 'instagram' ? 'Instagram is required.' : 'TikTok is required.', { field: check.field });
  }
  const [ka, en] = SOCIAL_MESSAGES[check.field] || SOCIAL_MESSAGES.other;
  return fail(req, res, 400, ka, en, { field: check.field });
}

async function emailInfluencer(influencer, { title, message, titleEn, messageEn }) {
  const lang = influencer.lang === 'en' ? 'en' : 'ka';
  try {
    await sendEmail({
      to: influencer.email,
      templateKey: 'promo_notice',
      vars: { ...commonVars({ fullName: influencer.displayName || influencer.fullName, lang }), title: lang === 'en' ? titleEn : title, message: lang === 'en' ? messageEn : message, portalUrl: PORTAL_URL },
      lang,
    });
  } catch (error) {
    console.warn('[promo] notice email failed', error?.message);
  }
}
export { emailInfluencer };

/* ───────────── public ───────────── */

promoRouter.get('/program', asyncHandler(async (_req, res) => {
  res.json(await store.publicProgram());
}));

// The invite page (/i/CODE) shows who invited: an approved influencer's public name and photo, nothing else.
promoRouter.get('/public/code/:code', asyncHandler(async (req, res) => {
  const row = await store.resolveInfluencerCode(req.params.code);
  if (row && row.status === 'ACTIVE') return res.json({ kind: 'influencer', name: row.displayName, photo: Boolean(row.photoKey), code: row.code });
  if (row) return res.json({ kind: 'influencer', name: null, photo: false, code: row.code });
  return res.status(404).json({ error: t(req, 'კოდი ვერ მოიძებნა.', 'Code not found.') });
}));

promoRouter.get('/public/photo/:code', asyncHandler(async (req, res) => {
  const row = await store.resolveInfluencerCode(req.params.code);
  if (!row || row.status !== 'ACTIVE' || !row.photoKey) return res.status(404).json({ error: t(req, 'ფოტო ვერ მოიძებნა.', 'Photo not found.') });
  return sendInfluencerPhoto(res, row.photoKey, { publicCache: true });
}));

/* ───────────── account ───────────── */

promoRouter.post('/signup', signupLimiter, programOn, upload.single('photo'), asyncHandler(async (req, res) => {
  const program = await store.publicProgram();
  if (!program.signupOpen) return fail(req, res, 403, 'ახალი რეგისტრაცია ახლა დახურულია.', 'New sign-ups are closed right now.', { code: 'SIGNUP_CLOSED' });
  const b = req.body || {};
  const fullName = cleanName(b.fullName, { min: 3, max: 80 });
  if (!fullName || !/\S+\s+\S+/.test(fullName)) return fail(req, res, 400, 'ჩაწერე სახელი და გვარი.', 'Enter your first and last name.', { field: 'fullName' });
  const displayName = cleanName(b.displayName || fullName, { min: 2, max: 40 });
  if (!displayName) return fail(req, res, 400, 'საჯარო სახელი 2–40 სიმბოლოა.', 'The public name needs 2–40 characters.', { field: 'displayName' });
  const email = normalizeEmail(b.email);
  if (!email) return fail(req, res, 400, 'ელფოსტა არასწორია.', 'That email address is not valid.', { field: 'email' });
  const phone = normalizePhone(b.phone);
  if (!phone) return fail(req, res, 400, 'ტელეფონის ნომერი არასწორია. მაგ. 555 12 34 56.', 'That phone number is not valid. For example +995 555 12 34 56.', { field: 'phone' });
  const pw = passwordProblem(b.password);
  if (pw) return fail(req, res, 400, pw.ka, pw.en, { field: 'password' });
  const socialCheck = readSocials(b);
  if (!socialCheck.socials) return socialFail(req, res, socialCheck);
  if (String(b.adult) !== '1') return fail(req, res, 400, 'პროგრამაში მონაწილეობა 18 წლიდან შეიძლება.', 'You must be 18 or older to join.', { field: 'adult' });
  if (String(b.terms) !== '1') return fail(req, res, 400, 'დაეთანხმე პროგრამის წესებს.', 'Please accept the program rules.', { field: 'terms' });
  if (!req.file?.buffer?.length) return fail(req, res, 400, 'პროფილის ფოტო სავალდებულოა.', 'A profile photo is required.', { field: 'photo' });
  const existing = await store.findInfluencerByEmail(email);
  if (existing) return fail(req, res, 409, 'ამ ელფოსტით ანგარიში უკვე არსებობს. შედი ან აღადგინე პაროლი.', 'An account with this email already exists. Sign in or reset your password.', { field: 'email', code: 'EMAIL_TAKEN' });
  let photoKey;
  try {
    photoKey = await storeInfluencerPhoto(req.file.buffer);
  } catch {
    return fail(req, res, 400, 'ფოტო ვერ დამუშავდა. აირჩიე სხვა ფოტო.', 'We could not process this photo. Please choose another one.', { field: 'photo' });
  }
  let created;
  try {
    created = await store.createInfluencer({ email, password: b.password, fullName, displayName, phone, socials: socialCheck.socials, photoKey, lang: req.lang });
  } catch (error) {
    await unlinkStoredUpload(photoKey).catch(() => undefined);
    throw error;
  }
  const token = await store.createSession(created.id);
  setSessionCookie(req, res, token);
  ownerNotice(`🌟 ახალი ინფლუენსერი: ${displayName}${socialCheck.socials.instagram ? ` (instagram.com/${socialCheck.socials.instagram})` : ''} — კოდი ${created.code}. განსახილველია: ადმინი → ინფლუენსერები.`);
  return res.status(201).json({ ok: true });
}));

promoRouter.post('/signin', signinLimiter, asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const row = email ? await store.findInfluencerByEmail(email) : null;
  const ok = row ? await store.verifyPassword(row, req.body?.password) : false;
  if (!ok) return fail(req, res, 401, 'ელფოსტა ან პაროლი არასწორია.', 'Wrong email or password.', { code: 'BAD_CREDENTIALS' });
  if (row.status === 'BLOCKED') return fail(req, res, 403, 'ანგარიში დაბლოკილია. მოგვწერე support@medicard.ge-ზე.', 'This account is blocked. Write to support@medicard.ge.', { code: 'PROMO_BLOCKED' });
  const token = await store.createSession(row.id);
  setSessionCookie(req, res, token);
  return res.json({ ok: true });
}));

promoRouter.post('/signout', asyncHandler(async (req, res) => {
  await store.deleteSession(readCookie(req, COOKIE));
  clearSessionCookie(req, res);
  res.json({ ok: true });
}));

promoRouter.post('/password/forgot', resetLimiter, asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const row = email ? await store.findInfluencerByEmail(email) : null;
  // Same answer either way: the form never tells whether an address has an account.
  if (row && row.status !== 'BLOCKED') {
    const code = await store.startPasswordReset(row.id);
    if (code) {
      const lang = row.lang === 'en' ? 'en' : 'ka';
      try {
        const result = await sendEmail({
          to: row.email,
          templateKey: 'promo_code',
          vars: { ...commonVars({ fullName: row.displayName || row.fullName, lang }), code, minutes: String(store.RESET_MINUTES) },
          lang,
          ignoreTemplateSwitch: true,
        });
        if (result?.status === 'skipped' && process.env.NODE_ENV !== 'production') console.log(`[promo] reset code for ${row.email}: ${code}`);
      } catch (error) {
        console.warn('[promo] reset email failed', error?.message);
      }
    }
  }
  res.json({ ok: true });
}));

promoRouter.post('/password/reset', resetLimiter, asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const row = email ? await store.findInfluencerByEmail(email) : null;
  const pw = passwordProblem(req.body?.password);
  if (pw) return fail(req, res, 400, pw.ka, pw.en, { field: 'password' });
  const ok = row && row.status !== 'BLOCKED' ? await store.consumePasswordReset(row.id, req.body?.code) : false;
  if (!ok) return fail(req, res, 400, 'კოდი არასწორია ან ვადა გაუვიდა. მოითხოვე ახალი.', 'The code is wrong or expired. Ask for a new one.', { field: 'code', code: 'BAD_CODE' });
  await store.setPassword(row.id, req.body.password);
  await store.deleteOtherSessions(row.id, null);
  const token = await store.createSession(row.id);
  setSessionCookie(req, res, token);
  res.json({ ok: true });
}));

/* ───────────── signed in ───────────── */

promoRouter.get('/me', authed, asyncHandler(async (req, res) => {
  const data = await store.dashboard(req.influencer.id);
  const program = await store.publicProgram();
  res.json({ ...data, program: { on: program.on, signupOpen: program.signupOpen } });
}));

promoRouter.patch('/me', writeLimiter, authed, asyncHandler(async (req, res) => {
  const b = req.body || {};
  const patch = {};
  if (b.displayName !== undefined) {
    const displayName = cleanName(b.displayName, { min: 2, max: 40 });
    if (!displayName) return fail(req, res, 400, 'საჯარო სახელი 2–40 სიმბოლოა.', 'The public name needs 2–40 characters.', { field: 'displayName' });
    patch.displayName = displayName;
  }
  if (b.phone !== undefined) {
    const phone = normalizePhone(b.phone);
    if (!phone) return fail(req, res, 400, 'ტელეფონის ნომერი არასწორია.', 'That phone number is not valid.', { field: 'phone' });
    patch.phone = phone;
  }
  if (SOCIAL_KEYS.some((key) => b[key] !== undefined)) {
    const merged = { ...(req.influencer.socials || {}), ...Object.fromEntries(SOCIAL_KEYS.filter((k) => b[k] !== undefined).map((k) => [k, b[k]])) };
    const check = readSocials(merged);
    if (!check.socials) return socialFail(req, res, check);
    patch.socials = check.socials;
  }
  if (b.lang === 'ka' || b.lang === 'en') patch.lang = b.lang;
  await store.updateProfile(req.influencer.id, patch);
  res.json({ ok: true });
}));

promoRouter.post('/me/photo', writeLimiter, authed, upload.single('photo'), asyncHandler(async (req, res) => {
  if (!req.file?.buffer?.length) return fail(req, res, 400, 'ფოტო არ არის მიმაგრებული.', 'No photo was attached.', { field: 'photo' });
  let photoKey;
  try {
    photoKey = await storeInfluencerPhoto(req.file.buffer);
  } catch {
    return fail(req, res, 400, 'ფოტო ვერ დამუშავდა. აირჩიე სხვა ფოტო.', 'We could not process this photo. Please choose another one.', { field: 'photo' });
  }
  const { previousPhotoKey } = await store.updateProfile(req.influencer.id, { photoKey });
  if (previousPhotoKey && previousPhotoKey !== photoKey) await unlinkStoredUpload(previousPhotoKey).catch(() => undefined);
  res.status(201).json({ ok: true });
}));

promoRouter.get('/me/photo', authed, asyncHandler(async (req, res) => {
  if (!req.influencer.photoKey) return fail(req, res, 404, 'ფოტო ვერ მოიძებნა.', 'Photo not found.');
  return sendInfluencerPhoto(res, req.influencer.photoKey);
}));

promoRouter.post('/me/password', writeLimiter, authed, asyncHandler(async (req, res) => {
  const row = await store.findInfluencerByEmail(req.influencer.email);
  if (!(await store.verifyPassword(row, req.body?.current))) return fail(req, res, 400, 'ახლანდელი პაროლი არასწორია.', 'Your current password is wrong.', { field: 'current' });
  const pw = passwordProblem(req.body?.password);
  if (pw) return fail(req, res, 400, pw.ka, pw.en, { field: 'password' });
  await store.setPassword(req.influencer.id, req.body.password);
  await store.deleteOtherSessions(req.influencer.id, req.promoSessionId);
  res.json({ ok: true });
}));

promoRouter.get('/code/check', authed, asyncHandler(async (req, res) => {
  const check = await store.customCodeAvailability(req.influencer.id, req.query.code);
  const text = check.problem ? CODE_PROBLEMS[check.problem] : null;
  res.json({ code: check.code, ok: !check.problem, problem: check.problem, message: text ? t(req, text.ka, text.en) : null, nextAt: check.nextAt || null });
}));

promoRouter.post('/code', writeLimiter, authed, programOn, asyncHandler(async (req, res) => {
  if (req.influencer.status === 'SUSPENDED') return fail(req, res, 409, 'ანგარიში შეჩერებულია — კოდის შეცვლა ახლა არ შეიძლება.', 'Your account is paused, so the code cannot be changed now.', { code: 'NOT_ACTIVE' });
  const result = await store.setCustomCode(req.influencer.id, req.body?.code);
  if (result.problem) {
    const text = CODE_PROBLEMS[result.problem];
    return fail(req, res, 409, text.ka, text.en, { field: 'code', code: `CODE_${result.problem}` });
  }
  res.status(201).json({ ok: true, code: result.code });
}));

promoRouter.get('/payout-details', authed, asyncHandler(async (req, res) => {
  res.json({ details: await store.lastPayoutDetails(req.influencer.id) });
}));

promoRouter.post('/payouts', writeLimiter, authed, programOn, asyncHandler(async (req, res) => {
  const { details, problem } = validatePayoutDetails(req.body || {});
  if (problem) return fail(req, res, 400, problem.ka, problem.en, { field: problem.field });
  const payout = await store.requestPayout(req.influencer.id, { details });
  ownerNotice(`💸 გატანის მოთხოვნა: ${req.influencer.displayName} — ${formatGel(payout.amount)} (${details.bank}). დასამუშავებელია: ადმინი → ინფლუენსერები → გატანები.`);
  res.status(201).json({ ok: true, payout });
}));

export const PROMO_PASSWORD_MIN = PASSWORD_MIN;
