import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getUsage } from '../lib/usage.js';
import { ensureFreePackageId } from '../lib/packages.js';
import { getAppSettings } from '../lib/settings.js';
import { birthDateSchema, genderSchema, publicHealthProfile, publicUser } from '../lib/patient.js';
import { requestPasswordReset, resetPasswordWithCode } from '../lib/passwordReset.js';
import { requestPhoneOtp, verifyPhoneOtp } from '../lib/phoneOtp.js';
import { normalizeSmsDestination } from '../lib/sms.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { claimDailyCheckIn } from '../lib/checkIn.js';

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
  phone: georgianPhone.optional(),
  gender: genderSchema.optional(),
  birthDate: birthDateSchema.optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('ელ-ფოსტის ფორმატი არასწორია'),
  password: z.string().min(1, 'შეიყვანეთ პაროლი'),
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
        error: 'რეგისტრაცია დროებით გამორთულია. გთხოვთ, სცადოთ მოგვიანებით.',
        code: 'REGISTRATIONS_CLOSED',
      });
    }

    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ error: 'ამ ელ-ფოსტით მომხმარებელი უკვე რეგისტრირებულია.' });
    }

    const packageId = await ensureFreePackageId();
    const created = await prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        phone: data.phone ?? null,
        gender: data.gender ?? null,
        birthDate: data.birthDate ?? null,
        passwordHash: await bcrypt.hash(data.password, 12),
        packageId,
        status: 'ACTIVE',
      },
    });
    const user = await loadUserBundle(created.id);

    return res.status(201).json({
      token: signToken(user),
      user: publicUser(user),
      usage: await getUsage(user.id),
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
      return res.status(401).json({ error: 'ელ-ფოსტა ან პაროლი არასწორია.' });
    }

    if (found.status === 'BLOCKED') {
      return res.status(403).json({
        error: 'თქვენი ანგარიში დაბლოკილია. დაგვიკავშირდით მხარდაჭერას.',
        code: 'ACCOUNT_BLOCKED',
      });
    }

    return res.json({
      token: signToken(found),
      user: publicUser(found),
      usage: await getUsage(found.id),
    });
  }),
);

authRouter.post(
  '/password/forgot',
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await requestPasswordReset(email);
    return res.json(result);
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
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({ ok: true, message: 'პაროლი წარმატებით შეიცვალა. შეგიძლიათ შეხვიდეთ ანგარიშში.' });
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
    const result = await requestPhoneOtp({ phone, purpose: 'AUTH' });
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

    const verified = await verifyPhoneOtp({ phone, code, purpose: 'AUTH' });
    if (!verified.ok) {
      return res.status(verified.status ?? 400).json({ error: verified.error });
    }

    let user = await prisma.user.findUnique({ where: { phone }, include: { package: true } });
    if (!user) {
      const packageId = await ensureFreePackageId();
      const created = await prisma.user.create({
        data: {
          phone,
          email: `${normalizeSmsDestination(phone)}@phone.medicard.ge`,
          fullName: fullName ?? 'Medicard მომხმარებელი',
          gender: gender ?? null,
          birthDate: birthDate ?? null,
          passwordHash: await bcrypt.hash(`phone:${phone}:${Date.now()}`, 12),
          packageId,
          status: 'ACTIVE',
        },
      });
      user = await loadUserBundle(created.id);
    }

    if (user.status === 'BLOCKED') {
      return res.status(403).json({
        error: 'თქვენი ანგარიში დაბლოკილია. დაგვიკავშირდით მხარდაჭერას.',
        code: 'ACCOUNT_BLOCKED',
      });
    }

    return res.json({
      token: signToken(user),
      user: publicUser(user),
      usage: await getUsage(user.id),
    });
  }),
);

/** Link a verified phone to the logged-in account (profile setup). */
authRouter.post(
  '/phone/link/start',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { phone } = phoneLinkStartSchema.parse(req.body);

    const taken = await prisma.user.findFirst({
      where: { phone, NOT: { id: req.user.id } },
    });
    if (taken) {
      return res.status(409).json({ error: 'ეს ნომერი უკვე მიბმულია სხვა ანგარიშზე.' });
    }

    const result = await requestPhoneOtp({ phone, purpose: 'LINK', userId: req.user.id });
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

    const verified = await verifyPhoneOtp({ phone, code, purpose: 'LINK' });
    if (!verified.ok) {
      return res.status(verified.status ?? 400).json({ error: verified.error });
    }

    const taken = await prisma.user.findFirst({
      where: { phone, NOT: { id: req.user.id } },
    });
    if (taken) {
      return res.status(409).json({ error: 'ეს ნომერი უკვე მიბმულია სხვა ანგარიშზე.' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { phone },
      include: { package: true },
    });

    return res.json({ ok: true, user: publicUser(user) });
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

    const [usage, counts, healthProfile] = await Promise.all([
      getUsage(req.user.id),
      prisma.$transaction([
        prisma.medicalRecord.count({ where: { userId: req.user.id } }),
        prisma.chatSession.count({ where: { userId: req.user.id } }),
        prisma.medicationSchedule.count({ where: { userId: req.user.id, active: true } }),
      ]),
      prisma.healthProfile.findUnique({ where: { userId: req.user.id } }),
    ]);

    return res.json({
      user: userPayload,
      usage,
      stats: { records: counts[0], chats: counts[1], activeMedications: counts[2] },
      healthProfile: publicHealthProfile(healthProfile),
      checkIn,
      checkInAwarded,
      pointsAwarded,
    });
  }),
);

/**
 * Lets accounts that predate the demographics fields — and anyone who signed up over
 * SMS — complete their clinical profile without re-registering.
 */
const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, 'შეიყვანეთ სახელი და გვარი').max(120).optional(),
    gender: genderSchema.optional(),
    birthDate: birthDateSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'განსაახლებელი ველი არ არის მითითებული');

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      include: { package: true },
    });

    return res.json({ user: publicUser(user) });
  }),
);
