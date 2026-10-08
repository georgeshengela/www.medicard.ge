import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { attachRateLimitHandler, clientIp, RATE_LIMIT_VALIDATE } from '../lib/rateLimitKey.js';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getUsageSafe } from '../lib/usage.js';
import { ensureFreePackageId } from '../lib/packages.js';
import { getAppSettings } from '../lib/settings.js';
import { birthDateAgeError, birthDateInputSchema, birthDateSchema, genderSchema, publicHealthProfile, publicUser } from '../lib/patient.js';
import { requestPasswordReset, resetPasswordWithCode } from '../lib/passwordReset.js';
import { requestPhoneOtp, verifyPhoneOtp } from '../lib/phoneOtp.js';
import { findUserByPhone, phoneTakenPayload } from '../lib/phoneUsers.js';
import { normalizeSmsDestination } from '../lib/sms.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { sessionRenewalFields } from '../lib/sessionRenewal.js';
import { asyncHandler } from '../middleware/error.js';
import { t } from '../lib/i18n.js';
import { claimDailyCheckIn } from '../lib/checkIn.js';
import { recordAppActivityFromRequest } from '../lib/appActivity.js';
import { deleteUserAccount } from '../lib/deleteUser.js';
import { queueAccountDeletedEmail, queueWelcomeEmail } from '../lib/email.js';
import {
  SocialAuthError,
  checkAppleKey,
  exchangeAppleCode,
  packAppleGrant,
  socialWebConfig,
  findIdentity,
  issueAppleNonce,
  readLinkToken,
  resolveSocialIdentity,
  saveIdentity,
  sealSecret,
  signLinkToken,
  DEFAULT_SOCIAL_NAME,
  socialDisplayName,
  unusablePasswordHash,
  verifyAppleIdentity,
  verifyGoogleIdentity,
} from '../lib/socialAuth.js';
import {
  AccountLoginError,
  absorbLogins,
  conflictOptions,
  conflictPayload,
  discardNewBlocker,
  loginMethods,
  readConflictToken,
  realEmail,
  requestEmailAddCode,
  verifyEmailAddCode,
} from '../lib/accountLogins.js';
import { writeAdminAudit } from '../lib/adminAudit.js';

export const authRouter = Router();

/** Georgian mobile numbers: +995 5XX XXX XXX, with or without the country code. */
const georgianPhone = z
  .string()
  .trim()
  .regex(/^(\+995)?5\d{8}$/, 'ტელეფონის ნომერი უნდა იყოს ფორმატში +9955XXXXXXXX')
  .transform((value) => (value.startsWith('+995') ? value : `+995${value}`));

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'სახელი და გვარი სავალდებულოა').max(120),
  email: z.string().trim().toLowerCase().email('ელ-ფოსტის ფორმატი არასწორია'),
  password: z.string().min(8, 'პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს').max(128),
  // No phone here: User.phone is written only after an SMS code check (phone gate, 2026-09-27).
  gender: genderSchema.optional(),
  birthDate: birthDateSchema.optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('ელ-ფოსტის ფორმატი არასწორია'),
  password: z.string().min(1, 'შეიყვანე პაროლი'),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('ელ-ფოსტის ფორმატი არასწორია'),
});

const resetPasswordSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('ელ-ფოსტის ფორმატი არასწორია'),
    code: z.string().trim().regex(/^\d{6}$/, 'კოდი უნდა შედგებოდეს 6 ციფრისგან'),
    password: z.string().min(8, 'პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს').max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'პაროლები არ ემთხვევა.',
    path: ['confirmPassword'],
  });

async function loadUserBundle(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { package: true },
  });
}

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const settings = await getAppSettings();
    if (!settings.allowRegistrations) {
      return res.status(403).json({
        error: t(req, 'რეგისტრაცია დროებით გამორთულია. სცადე მოგვიანებით.', 'Sign-up is paused for now. Please try again later.'),
        code: 'REGISTRATIONS_CLOSED',
      });
    }

    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ error: t(req, 'ამ ელ-ფოსტით მომხმარებელი უკვე რეგისტრირებულია.', 'An account with this email already exists.') });
    }

    const packageId = await ensureFreePackageId();
    const passwordHash = await bcrypt.hash(data.password, 12);
    let user;
    try {
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: data.email,
            fullName: data.fullName,
            gender: data.gender ?? null,
            birthDate: data.birthDate ?? null,
            passwordHash,
            packageId,
            status: 'ACTIVE',
          },
        });
        const bundled = await tx.user.findUnique({
          where: { id: created.id },
          include: { package: true },
        });
        if (!bundled?.id) {
          throw Object.assign(new Error('REGISTER_UNCONFIRMED'), { code: 'REGISTER_UNCONFIRMED' });
        }
        return bundled;
      });
    } catch (err) {
      const target = err?.meta?.target;
      const fields = Array.isArray(target) ? target : target ? [target] : [];
      const hit = (name) => fields.some((field) => String(field).includes(name));
      if (err?.code === 'P2002' && hit('phone')) {
        return res.status(409).json(phoneTakenPayload(req.lang));
      }
      if (err?.code === 'P2002' && hit('email')) {
        return res.status(409).json({ error: t(req, 'ამ ელ-ფოსტით მომხმარებელი უკვე რეგისტრირებულია.', 'An account with this email already exists.') });
      }
      if (err?.code === 'REGISTER_UNCONFIRMED') {
        return res.status(500).json({
          error: t(req, 'ანგარიში ვერ შეიქმნა. სცადე ხელახლა.', 'We could not create your account. Please try again.'),
          code: 'REGISTER_UNCONFIRMED',
        });
      }
      throw err;
    }

    // Fresh connection (Neon pooler) — do not hand out a JWT the next request cannot resolve.
    let confirmed = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      confirmed = await loadUserBundle(user.id);
      if (confirmed?.id) break;
      await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
    }
    if (!confirmed?.id) {
      return res.status(500).json({
        error: t(req, 'ანგარიში ვერ შეიქმნა. სცადე ხელახლა.', 'We could not create your account. Please try again.'),
        code: 'REGISTER_UNCONFIRMED',
      });
    }

    // Fire-and-forget (setImmediate): never delays or fails the sign-up; once per user ever.
    queueWelcomeEmail(confirmed, {}, { lang: req.lang });

    return res.status(201).json({
      token: signToken(confirmed),
      user: publicUser(confirmed),
      usage: await getUsageSafe(confirmed.id),
    });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);

    const found = await prisma.user.findUnique({
      where: { email: data.email },
      include: { package: true },
    });
    const valid = found ? await bcrypt.compare(data.password, found.passwordHash) : false;

    if (!found || !valid) {
      return res.status(401).json({ error: t(req, 'ელ-ფოსტა ან პაროლი არასწორია.', 'The email or password is incorrect.') });
    }

    if (found.status === 'BLOCKED') {
      return res.status(403).json({
        error: t(req, 'შენი ანგარიში დაბლოკილია. დაგვიკავშირდი მხარდაჭერას.', 'Your account is blocked. Please contact support.'),
        code: 'ACCOUNT_BLOCKED',
      });
    }

    return res.json({
      token: signToken(found),
      user: publicUser(found),
      usage: await getUsageSafe(found.id),
    });
  }),
);

// Reset now tells whether an account exists, so checking many addresses is capped per IP.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: RATE_LIMIT_VALIDATE,
  keyGenerator: (req) => `forgot:${clientIp(req)}`,
  handler: attachRateLimitHandler('password-forgot'),
});

authRouter.post(
  '/password/forgot',
  forgotPasswordLimiter,
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await requestPasswordReset(email, req.lang);
    if (result.code === 'EMAIL_NOT_FOUND') {
      return res.status(404).json({ error: result.message, code: result.code });
    }
    return res.json(result);
  }),
);

/**
 * Password reset by SMS (2026-09-29): for accounts that have a verified phone on file.
 * The code proves ownership of the number, so a successful reset signs the person in directly
 * (they may not remember which email the account uses). Purpose RESET keeps these codes apart
 * from sign-in codes. Phone-only accounts have no password — they are sent to SMS sign-in.
 */
const smsResetStartSchema = z.object({ phone: georgianPhone });
const smsResetSchema = z
  .object({
    phone: georgianPhone,
    code: z.string().trim().regex(/^\d{4}$/, 'კოდი უნდა შედგებოდეს 4 ციფრისგან'),
    password: z.string().min(8, 'პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს').max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((d) => d.password === d.confirmPassword, { message: 'პაროლები არ ემთხვევა', path: ['confirmPassword'] });

const phoneNotFound = (req) => ({
  error: t(
    req,
    'ამ ნომრით ანგარიში ვერ მოიძებნა. თუ ანგარიშს ელ-ფოსტით ქმნიდი და ნომერი არ დაგიმატებია, აღადგინე ელ-ფოსტით.',
    'No account uses this number. If you signed up with email and never added a number, reset your password by email.',
  ),
  code: 'PHONE_NOT_FOUND',
});
const phoneLoginAccount = (req) => ({
  error: t(
    req,
    'ეს ანგარიში ტელეფონის ნომრით შედის და პაროლი არ აქვს. შედი SMS კოდით.',
    'This account signs in with a phone number and has no password. Sign in with an SMS code.',
  ),
  code: 'PHONE_LOGIN_ACCOUNT',
});
const isPhoneOnlyAccount = (user) => String(user?.email || '').endsWith('@phone.medicard.ge');

authRouter.post(
  '/password/sms/start',
  forgotPasswordLimiter,
  asyncHandler(async (req, res) => {
    const { phone } = smsResetStartSchema.parse(req.body);
    const user = await findUserByPhone(phone);
    if (!user) return res.status(404).json(phoneNotFound(req));
    if (isPhoneOnlyAccount(user)) return res.status(409).json(phoneLoginAccount(req));
    if (user.status === 'BLOCKED') {
      return res.json({ sent: true, message: t(req, 'თუ ნომერი ანგარიშზეა მიბმული, კოდს მიიღებ რამდენიმე წამში.', 'If this number is linked to an account, you will get a code in a few seconds.') });
    }
    const result = await requestPhoneOtp({ phone, purpose: 'RESET', userId: user.id, lang: req.lang });
    if (!result.ok) return res.status(result.status || 400).json({ error: result.error });
    const { reference: _reference, ...publicResult } = result;
    return res.json(publicResult);
  }),
);

authRouter.post(
  '/password/sms/reset',
  asyncHandler(async (req, res) => {
    const data = smsResetSchema.parse(req.body);
    const user = await findUserByPhone(data.phone);
    if (!user || isPhoneOnlyAccount(user)) {
      return res.status(400).json({ error: t(req, 'კოდი არასწორია ან ვადა გაუვიდა.', 'The code is incorrect or has expired.') });
    }
    const check = await verifyPhoneOtp({ phone: data.phone, code: data.code, purpose: 'RESET', lang: req.lang });
    if (!check.ok) return res.status(check.status || 400).json({ error: check.error });
    if (check.userId && check.userId !== user.id) {
      return res.status(400).json({ error: t(req, 'კოდი არასწორია ან ვადა გაუვიდა.', 'The code is incorrect or has expired.') });
    }
    if (user.status === 'BLOCKED') {
      return res.status(403).json({ error: t(req, 'შენი ანგარიში დაბლოკილია. დაგვიკავშირდი მხარდაჭერას.', 'Your account is blocked. Please contact support.'), code: 'ACCOUNT_BLOCKED' });
    }
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(data.password, 12) },
      });
      await tx.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
      return next;
    });
    return res.json({
      token: signToken(updated),
      user: publicUser(updated),
      usage: await getUsageSafe(updated.id),
    });
  }),
);

authRouter.post(
  '/password/reset',
  asyncHandler(async (req, res) => {
    const data = resetPasswordSchema.parse(req.body);
    const result = await resetPasswordWithCode({
      email: data.email,
      code: data.code,
      password: data.password,
      lang: req.lang,
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({ ok: true, message: t(req, 'პაროლი წარმატებით შეიცვალა. შეგიძლია შეხვიდე ანგარიშში.', 'Your password has been changed. You can sign in now.') });
  }),
);

/**
 * Georgian phone authentication via SMSOffice.ge — 4-digit OTP.
 */
const phoneStartSchema = z.object({ phone: georgianPhone });
const phoneVerifySchema = z.object({
  phone: georgianPhone,
  code: z.string().trim().regex(/^\d{4}$/, 'კოდი უნდა შედგებოდეს 4 ციფრისგან'),
  fullName: z.string().trim().min(2).max(120).optional(),
  gender: genderSchema.optional(),
  birthDate: birthDateSchema.optional(),
});

const phoneLinkStartSchema = z.object({ phone: georgianPhone });
const phoneLinkVerifySchema = z.object({
  phone: georgianPhone,
  code: z.string().trim().regex(/^\d{4}$/, 'კოდი უნდა შედგებოდეს 4 ციფრისგან'),
});

authRouter.post(
  '/phone/start',
  asyncHandler(async (req, res) => {
    const { phone } = phoneStartSchema.parse(req.body);
    const result = await requestPhoneOtp({ phone, purpose: 'AUTH', lang: req.lang });
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ error: result.error });
    }
    return res.json({
      sent: result.sent,
      phone: result.phone,
      message: result.message,
      devCode: result.devCode,
      cooldownSec: result.cooldownSec,
    });
  }),
);

authRouter.post(
  '/phone/verify',
  asyncHandler(async (req, res) => {
    const { phone, code, fullName, gender, birthDate } = phoneVerifySchema.parse(req.body);

    const verified = await verifyPhoneOtp({ phone, code, purpose: 'AUTH', lang: req.lang });
    if (!verified.ok) {
      return res.status(verified.status ?? 400).json({ error: verified.error });
    }

    let user = await findUserByPhone(phone);
    if (user) {
      user = await loadUserBundle(user.id);
    } else {
      const packageId = await ensureFreePackageId();
      try {
        const created = await prisma.user.create({
          data: {
            phone,
            email: `${normalizeSmsDestination(phone)}@phone.medicard.ge`,
            // One placeholder for phone and Apple sign-ups: the app and web /app never show it as a name.
            fullName: fullName ?? DEFAULT_SOCIAL_NAME,
            gender: gender ?? null,
            birthDate: birthDate ?? null,
            passwordHash: await bcrypt.hash(`phone:${phone}:${Date.now()}`, 12),
            packageId,
            status: 'ACTIVE',
          },
        });
        user = await loadUserBundle(created.id);
        // Phone sign-ups carry a synthetic @phone.medicard.ge login, so this is a no-op today;
        // it starts working if phone sign-up ever collects a real address.
        queueWelcomeEmail(user, {}, { lang: req.lang });
      } catch (err) {
        if (err?.code === 'P2002') {
          const existing = await findUserByPhone(phone);
          if (existing) {
            user = await loadUserBundle(existing.id);
          } else {
            return res.status(409).json(phoneTakenPayload(req.lang));
          }
        } else {
          throw err;
        }
      }
    }

    if (user.status === 'BLOCKED') {
      return res.status(403).json({
        error: t(req, 'შენი ანგარიში დაბლოკილია. დაგვიკავშირდი მხარდაჭერას.', 'Your account is blocked. Please contact support.'),
        code: 'ACCOUNT_BLOCKED',
      });
    }

    return res.json({
      token: signToken(user),
      user: publicUser(user),
      usage: await getUsageSafe(user.id),
    });
  }),
);

/* ───────── Sign in with Apple / Google (2026-10-01, src/lib/socialAuth.js) ───────── */

const appleSignInSchema = z.object({
  identityToken: z.string().min(20).max(8192),
  authorizationCode: z.string().max(2048).optional(),
  nonce: z.string().min(10).max(200),
  // Apple shares the name only on the very first authorization, on the device — never in the token.
  fullName: z.string().max(160).optional(),
});
const googleSignInSchema = z.object({ idToken: z.string().min(20).max(8192) });
const socialLinkSchema = z.object({
  linkToken: z.string().min(20).max(4096),
  password: z.string().min(1, 'შეიყვანე პაროლი').max(128),
});

const SOCIAL_FAILURE_COPY = {
  SOCIAL_NOT_CONFIGURED: ['ეს შესვლის გზა ჯერ არ არის ჩართული. შედი ელ-ფოსტით.', 'This sign-in option is not available yet. Please sign in with email.'],
  SOCIAL_KEYS_UNAVAILABLE: ['შესვლის სერვისს ვერ დავუკავშირდით. სცადე ცოტა ხანში.', 'We could not reach the sign-in service. Please try again shortly.'],
  SOCIAL_EMAIL_UNVERIFIED: ['ამ Google ანგარიშის ელ-ფოსტა დადასტურებული არ არის. აირჩიე სხვა ანგარიში ან შედი ელ-ფოსტით.', 'This Google account has no verified email. Choose another account or sign in with email.'],
};

function socialFailure(req, res, error) {
  if (!(error instanceof SocialAuthError)) throw error;
  const copy = SOCIAL_FAILURE_COPY[error.code] ?? ['შესვლა ვერ დადასტურდა. სცადე თავიდან.', 'We could not confirm this sign-in. Please try again.'];
  return res.status(error.status).json({ error: t(req, copy[0], copy[1]), code: error.code });
}

const blockedPayload = (req) => ({
  error: t(req, 'შენი ანგარიში დაბლოკილია. დაგვიკავშირდი მხარდაჭერას.', 'Your account is blocked. Please contact support.'),
  code: 'ACCOUNT_BLOCKED',
});

/** Fresh connection (Neon pooler): never hand out a JWT the next request cannot resolve. */
async function confirmedUserBundle(userId) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const user = await loadUserBundle(userId);
    if (user?.id) return user;
    await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
  }
  return null;
}

/** Prisma unique error, or Postgres 23505 surfaced through a raw query (the AuthIdentity insert). */
function isUniqueViolation(err) {
  return err?.code === 'P2002' || (err?.code === 'P2010' && /23505|unique/i.test(String(err?.meta?.code ?? err?.message)));
}

async function signedInPayload(user, created) {
  return { token: signToken(user), user: publicUser(user), usage: await getUsageSafe(user.id), created };
}

/**
 * Signs a verified identity in: its own account, an account already verified by the other
 * provider for the same email, or a new account. A password account with the same email answers
 * 409 SOCIAL_LINK_REQUIRED + a 10-minute linkToken (see socialAuth.js "Linking rule").
 */
async function completeSocialSignIn(req, res, identity, { fullName = null, sealedRefresh = null, retried = false } = {}) {
  const decision = await resolveSocialIdentity(identity);

  if (decision.kind === 'link') {
    return res.status(409).json({
      error: t(
        req,
        'ამ ელ-ფოსტით ანგარიში უკვე გაქვს. შეიყვანე მისი პაროლი ერთხელ — შემდეგ ერთი შეხებით შეხვალ.',
        'You already have an account with this email. Enter its password once — after that you can sign in with one tap.',
      ),
      code: 'SOCIAL_LINK_REQUIRED',
      provider: identity.provider,
      email: identity.email,
      linkToken: signLinkToken(identity, { sealedRefresh }),
    });
  }

  if (decision.kind === 'existing') {
    const user = await loadUserBundle(decision.userId);
    if (!user) {
      return res.status(401).json({
        error: t(req, 'შესვლა ვერ დადასტურდა. სცადე თავიდან.', 'We could not confirm this sign-in. Please try again.'),
        code: 'SOCIAL_TOKEN_INVALID',
      });
    }
    if (user.status === 'BLOCKED') return res.status(403).json(blockedPayload(req));
    await saveIdentity({ userId: user.id, identity, sealedRefresh });
    return res.json(await signedInPayload(user, false));
  }

  const settings = await getAppSettings();
  if (!settings.allowRegistrations) {
    return res.status(403).json({
      error: t(req, 'რეგისტრაცია დროებით გამორთულია. სცადე მოგვიანებით.', 'Sign-up is paused for now. Please try again later.'),
      code: 'REGISTRATIONS_CLOSED',
    });
  }

  const packageId = await ensureFreePackageId();
  const passwordHash = await unusablePasswordHash();
  let createdId;
  try {
    createdId = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: decision.email,
          fullName: socialDisplayName(fullName, identity.name),
          passwordHash,
          packageId,
          status: 'ACTIVE',
        },
      });
      await saveIdentity({ userId: created.id, identity, sealedRefresh }, tx);
      return created.id;
    });
  } catch (err) {
    // A double tap (or another device) created it a moment ago: resolve again once.
    if (isUniqueViolation(err) && !retried) {
      return completeSocialSignIn(req, res, identity, { fullName, sealedRefresh, retried: true });
    }
    throw err;
  }

  const user = await confirmedUserBundle(createdId);
  if (!user) {
    return res.status(500).json({
      error: t(req, 'ანგარიში ვერ შეიქმნა. სცადე ხელახლა.', 'We could not create your account. Please try again.'),
      code: 'REGISTER_UNCONFIRMED',
    });
  }
  // Apple relay addresses accept mail only once medicard.ge is registered with Apple; skip the
  // welcome email there so a bounce cannot suppress the address for later password resets.
  if (!identity.privateRelay) queueWelcomeEmail(user, {}, { lang: req.lang });
  return res.status(201).json(await signedInPayload(user, true));
}

/** Web sign-in page (/app): which buttons to show and their public client ids. */
authRouter.get(
  '/social/config',
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    return res.json(socialWebConfig());
  }),
);

authRouter.get(
  '/apple/nonce',
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    return res.json({ nonce: issueAppleNonce() });
  }),
);

/** Whether account deletion can revoke Apple grants (status word only; result cached 10 minutes). */
let appleKeyCheck = { at: 0, status: null };
authRouter.get(
  '/apple/status',
  asyncHandler(async (_req, res) => {
    if (!appleKeyCheck.status || Date.now() - appleKeyCheck.at > 10 * 60 * 1000) {
      appleKeyCheck = { at: Date.now(), status: await checkAppleKey() };
    }
    res.set('Cache-Control', 'no-store');
    return res.json({ revoke: appleKeyCheck.status });
  }),
);

authRouter.post(
  '/apple',
  asyncHandler(async (req, res) => {
    const data = appleSignInSchema.parse(req.body);
    let identity;
    try {
      identity = await verifyAppleIdentity({ identityToken: data.identityToken, nonce: data.nonce });
    } catch (error) {
      return socialFailure(req, res, error);
    }
    const refreshToken = await exchangeAppleCode(data.authorizationCode, { clientId: identity.clientId });
    return completeSocialSignIn(req, res, identity, {
      fullName: data.fullName,
      sealedRefresh: refreshToken ? sealSecret(packAppleGrant(refreshToken, identity.clientId)) : null,
    });
  }),
);

authRouter.post(
  '/google',
  asyncHandler(async (req, res) => {
    const data = googleSignInSchema.parse(req.body);
    let identity;
    try {
      identity = await verifyGoogleIdentity({ idToken: data.idToken });
    } catch (error) {
      return socialFailure(req, res, error);
    }
    return completeSocialSignIn(req, res, identity);
  }),
);

/** Proves the existing password account once, then attaches the Apple / Google identity to it. */
authRouter.post(
  '/social/link',
  asyncHandler(async (req, res) => {
    const data = socialLinkSchema.parse(req.body);
    const link = readLinkToken(data.linkToken);
    if (!link) {
      return res.status(400).json({
        error: t(req, 'დრო ამოიწურა. სცადე შესვლა თავიდან.', 'This took too long. Please start the sign-in again.'),
        code: 'SOCIAL_LINK_EXPIRED',
      });
    }
    const user = await prisma.user.findUnique({ where: { email: link.identity.email }, include: { package: true } });
    const valid = user ? await bcrypt.compare(data.password, user.passwordHash) : false;
    if (!user || !valid) {
      return res.status(401).json({ error: t(req, 'პაროლი არასწორია.', 'The password is incorrect.'), code: 'INVALID_PASSWORD' });
    }
    if (user.status === 'BLOCKED') return res.status(403).json(blockedPayload(req));
    const owner = await findIdentity(link.identity.provider, link.identity.subject);
    if (owner && owner.userId !== user.id) {
      return res.status(409).json({
        error: t(req, 'ეს Apple / Google ანგარიში უკვე სხვა Medicard ანგარიშზეა მიბმული.', 'This Apple / Google account is already linked to another Medicard account.'),
        code: 'SOCIAL_ALREADY_LINKED',
      });
    }
    await saveIdentity({ userId: user.id, identity: link.identity, sealedRefresh: link.sealedRefresh });
    return res.json(await signedInPayload(user, false));
  }),
);

/**
 * Link a verified phone to the logged-in account (profile, phone gate). A number that belongs to
 * another account still gets its code: the code proves it is this person's, and verify then offers
 * to bring that account's sign-in methods here or to switch to it (accountLogins.js).
 */
authRouter.post(
  '/phone/link/start',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { phone } = phoneLinkStartSchema.parse(req.body);

    const result = await requestPhoneOtp({ phone, purpose: 'LINK', userId: req.user.id, lang: req.lang });
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ error: result.error });
    }
    return res.json({
      sent: result.sent,
      phone: result.phone,
      message: result.message,
      devCode: result.devCode,
      cooldownSec: result.cooldownSec,
    });
  }),
);

authRouter.post(
  '/phone/link/verify',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { phone, code } = phoneLinkVerifySchema.parse(req.body);

    const verified = await verifyPhoneOtp({ phone, code, purpose: 'LINK', lang: req.lang });
    if (!verified.ok) {
      return res.status(verified.status ?? 400).json({ error: verified.error });
    }
    // The code was requested by this signed-in account, not by another session.
    if (verified.userId && verified.userId !== req.user.id) {
      return res.status(400).json({ error: t(req, 'კოდი არასწორია ან ვადა გაუვიდა.', 'The code is wrong or has expired.') });
    }

    const taken = await findUserByPhone(phone, { excludeUserId: req.user.id });
    if (taken) {
      return res.status(409).json(await conflictPayload(req.lang, { kind: 'phone', currentId: req.user.id, otherId: taken.id }));
    }

    let user;
    try {
      user = await prisma.user.update({
        where: { id: req.user.id },
        data: { phone },
        include: { package: true },
      });
    } catch (err) {
      if (err?.code === 'P2002' && err?.meta?.target?.includes?.('phone')) {
        const owner = await findUserByPhone(phone, { excludeUserId: req.user.id });
        return res.status(409).json(owner
          ? await conflictPayload(req.lang, { kind: 'phone', currentId: req.user.id, otherId: owner.id })
          : phoneTakenPayload(req.lang));
      }
      throw err;
    }

    return res.json({ ok: true, user: publicUser(user) });
  }),
);

/* ───────── Sign-in methods on one account (2026-10-05, src/lib/accountLogins.js) ───────── */

authRouter.get(
  '/methods',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    return res.json({ methods: await loginMethods(req.user.id) });
  }),
);

const emailAddStartSchema = z.object({ email: z.string().trim().toLowerCase().email().max(160) });
const emailAddVerifySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(160),
  code: z.string().trim().regex(/^\d{6}$/),
  password: z.string().min(8).max(128),
});

/** Adds a real email + password to an account that has none (phone or hidden-Apple sign-up). */
authRouter.post(
  '/email/add/start',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { email } = emailAddStartSchema.parse(req.body);
    const result = await requestEmailAddCode({ user: req.user, email, lang: req.lang });
    if (!result.ok) return res.status(result.status).json({ error: result.error, code: result.code });
    return res.json({ sent: true, message: result.message, devCode: result.devCode });
  }),
);

authRouter.post(
  '/email/add/verify',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { email, code, password } = emailAddVerifySchema.parse(req.body);
    if (realEmail(req.user.email)) {
      return res.status(400).json({ error: t(req, 'ამ ანგარიშს ელ-ფოსტა უკვე აქვს.', 'This account already has an email.'), code: 'EMAIL_ALREADY_SET' });
    }
    const checked = await verifyEmailAddCode({ userId: req.user.id, email, code, lang: req.lang });
    if (!checked.ok) return res.status(checked.status ?? 400).json({ error: checked.error });

    const owner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (owner && owner.id !== req.user.id) {
      return res.status(409).json(await conflictPayload(req.lang, { kind: 'email', currentId: req.user.id, otherId: owner.id }));
    }
    let user;
    try {
      user = await prisma.user.update({
        where: { id: req.user.id },
        data: { email, passwordHash: await bcrypt.hash(password, 12) },
        include: { package: true },
      });
    } catch (err) {
      if (err?.code === 'P2002') {
        const raced = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (raced) return res.status(409).json(await conflictPayload(req.lang, { kind: 'email', currentId: req.user.id, otherId: raced.id }));
      }
      throw err;
    }
    return res.json({ ok: true, user: publicUser(user), methods: await loginMethods(user.id) });
  }),
);

/** Attaches a verified Apple / Google identity to the signed-in account. */
async function linkSocialIdentity(req, res, identity, sealedRefresh = null) {
  const owner = await findIdentity(identity.provider, identity.subject);
  if (owner && owner.userId !== req.user.id) {
    return res.status(409).json(await conflictPayload(req.lang, { kind: identity.provider, currentId: req.user.id, otherId: owner.userId }));
  }
  await saveIdentity({ userId: req.user.id, identity, sealedRefresh });
  return res.json({ ok: true, methods: await loginMethods(req.user.id) });
}

authRouter.post(
  '/apple/link',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = appleSignInSchema.parse(req.body);
    let identity;
    try {
      identity = await verifyAppleIdentity({ identityToken: data.identityToken, nonce: data.nonce });
    } catch (error) {
      return socialFailure(req, res, error);
    }
    const refreshToken = await exchangeAppleCode(data.authorizationCode, { clientId: identity.clientId });
    return linkSocialIdentity(req, res, identity, refreshToken ? sealSecret(packAppleGrant(refreshToken, identity.clientId)) : null);
  }),
);

authRouter.post(
  '/google/link',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = googleSignInSchema.parse(req.body);
    let identity;
    try {
      identity = await verifyGoogleIdentity({ idToken: data.idToken });
    } catch (error) {
      return socialFailure(req, res, error);
    }
    return linkSocialIdentity(req, res, identity);
  }),
);

const conflictResolveSchema = z.object({
  token: z.string().min(20).max(4096),
  action: z.enum(['move_here', 'switch']),
});

/**
 * The person proved an identifier that belongs to another of their accounts.
 * move_here: that account's sign-in methods come here and it is deleted (only while it has no
 * health data). switch: sign in to that account; this one goes only while it has no health data.
 */
authRouter.post(
  '/account-conflict/resolve',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token, action } = conflictResolveSchema.parse(req.body);
    const conflict = readConflictToken(token);
    if (!conflict || conflict.from !== req.user.id) {
      return res.status(400).json({ error: t(req, 'დრო ამოიწურა. სცადე თავიდან.', 'This took too long. Please try again.'), code: 'CONFLICT_EXPIRED' });
    }
    const options = await conflictOptions(conflict.from, conflict.to);
    if (!options) {
      return res.status(404).json({ error: t(req, 'ანგარიში ვერ მოიძებნა.', 'Account not found.'), code: 'CONFLICT_GONE' });
    }
    const audit = (actionName, value) => writeAdminAudit({
      admin: { id: null, email: 'self-service' },
      action: actionName,
      targetType: 'user',
      targetId: conflict.from,
      previousValue: { kind: conflict.kind, otherUserId: conflict.to },
      newValue: value,
    });

    if (action === 'move_here') {
      if (!options.canMoveHere) {
        return res.status(409).json({
          error: t(req, 'იმ ანგარიშზე შენი მონაცემებია, ამიტომ აქ ვერ გადმოვიტანთ. შედი იმ ანგარიშში.', 'That account holds your data, so it cannot be moved here. Sign in to that account instead.'),
          code: 'MERGE_NOT_ALLOWED',
        });
      }
      const result = await absorbLogins(conflict.to, conflict.from);
      await audit('USER_LOGINS_MOVED_HERE', result);
      const user = await loadUserBundle(conflict.from);
      return res.json({ ok: true, action, user: publicUser(user), methods: await loginMethods(user.id) });
    }

    if (!options.canSwitch) return res.status(403).json(blockedPayload(req));
    let deletedCurrent = false;
    if (options.switchDeletesCurrent) {
      try {
        await absorbLogins(conflict.from, conflict.to);
        deletedCurrent = true;
      } catch (error) {
        if (!(error instanceof AccountLoginError)) throw error;
      }
    }
    await audit('USER_SWITCHED_ACCOUNT', { deletedCurrent });
    const other = await loadUserBundle(conflict.to);
    return res.json({ ...(await signedInPayload(other, false)), action, deletedCurrent });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    let userPayload = publicUser(req.user);
    let checkInAwarded = false;
    let pointsAwarded = 0;
    let checkIn = null;
    try {
      const claimed = await claimDailyCheckIn(req.user.id);
      checkInAwarded = claimed.awarded;
      pointsAwarded = claimed.pointsAwarded;
      checkIn = claimed.checkIn;
      if (claimed.user) userPayload = claimed.user;
    } catch (error) {
      console.warn('[check-in] claim on /me failed', error?.code || error?.message);
    }
    void recordAppActivityFromRequest(req);

    const [usage, counts, healthProfile] = await Promise.all([
      getUsageSafe(req.user.id),
      prisma.$transaction([
        prisma.medicalRecord.count({ where: { userId: req.user.id } }),
        prisma.chatSession.count({ where: { userId: req.user.id } }),
        prisma.medicationSchedule.count({ where: { userId: req.user.id, active: true } }),
      ]),
      prisma.healthProfile.findUnique({ where: { userId: req.user.id } }),
    ]);

    // Sliding session: `token` only when the presented one is past half its lifetime.
    const renewal = sessionRenewalFields(req.authClaims, () => signToken(req.user));
    if (renewal.token) res.set('Cache-Control', 'no-store');

    return res.json({
      user: userPayload,
      usage,
      stats: { records: counts[0], chats: counts[1], activeMedications: counts[2] },
      healthProfile: publicHealthProfile(healthProfile),
      checkIn,
      checkInAwarded,
      pointsAwarded,
      ...renewal,
    });
  }),
);

/**
 * Lets accounts that predate the demographics fields — and anyone who signed up over
 * SMS — complete their clinical profile without re-registering.
 */
const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, 'შეიყვანე სახელი და გვარი').max(120).optional(),
    gender: genderSchema.optional(),
    birthDate: birthDateInputSchema.optional(),
    aiEngine: z.enum(['gemini_flash', 'ling_free', 'evidencemd']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'განსაახლებელი ველი არ არის მითითებული');

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = updateProfileSchema.parse(req.body);
    const ageError = birthDateAgeError(data.birthDate, req.user.birthDate, req.lang);
    if (ageError) return res.status(400).json({ error: ageError, code: 'MIN_AGE' });

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      include: { package: true },
    });

    return res.json({ user: publicUser(user) });
  }),
);

authRouter.delete(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Captured before deletion; the confirmation goes out only after the deletion committed.
    const recipient = { userId: req.user.id, email: req.user.email, fullName: req.user.fullName };
    const result = await deleteUserAccount(req.user.id, req.lang);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    queueAccountDeletedEmail({ ...recipient, lang: result.deleted?.language ?? req.lang });
    return res.json({ ok: true });
  }),
);

/**
 * „I already have an account“ right after sign-up: removes the account that was just created so
 * the person can sign in to their real one. Only within a day of creation, only before onboarding
 * started (in the app or on the web) and only while it holds nothing of the person's own
 * (accountLogins.js); no deletion email — nothing the person kept is lost.
 */
authRouter.post(
  '/me/discard-new',
  requireAuth,
  asyncHandler(async (req, res) => {
    const blocker = await discardNewBlocker(req.user);
    if (blocker === 'started') {
      return res.status(409).json({
        error: t(req, 'ამ ანგარიშზე რეგისტრაცია უკვე დაწყებულია, ამიტომ ავტომატურად არ წაიშლება. გააგრძელე იქ, სადაც დაიწყე.', 'Sign-up has already started on this account, so it is not removed automatically. Carry on where you started.'),
        code: 'DISCARD_NOT_ALLOWED',
      });
    }
    if (blocker) {
      return res.status(409).json({
        error: t(req, 'ამ ანგარიშზე უკვე შენი მონაცემებია, ამიტომ ავტომატურად არ წაიშლება.', 'This account already holds your data, so it is not removed automatically.'),
        code: 'DISCARD_NOT_ALLOWED',
      });
    }
    const result = await deleteUserAccount(req.user.id, req.lang);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.json({ ok: true });
  }),
);
