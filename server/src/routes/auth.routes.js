import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getUsage } from '../lib/usage.js';
import { ensureFreePackageId } from '../lib/packages.js';
import { getAppSettings } from '../lib/settings.js';
import { birthDateSchema, genderSchema, publicUser } from '../lib/patient.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

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
  gender: genderSchema,
  birthDate: birthDateSchema,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('ელ-ფოსტის ფორმატი არასწორია'),
  password: z.string().min(1, 'შეიყვანეთ პაროლი'),
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
        gender: data.gender,
        birthDate: data.birthDate,
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

/**
 * Georgian phone authentication — stub.
 * Wire a local SMS gateway (Magti / Geocell / SMSOffice.ge) into `sendCode` before launch;
 * the verification contract below is what the mobile client already speaks.
 */
const phoneStartSchema = z.object({ phone: georgianPhone });
const phoneVerifySchema = z.object({
  phone: georgianPhone,
  code: z.string().trim().length(6, 'კოდი უნდა შედგებოდეს 6 ციფრისგან'),
  fullName: z.string().trim().min(2).max(120).optional(),
  // Optional here: the SMS flow can complete the profile later via PATCH /me.
  gender: genderSchema.optional(),
  birthDate: birthDateSchema.optional(),
});

const DEV_SMS_CODE = '123456';

authRouter.post(
  '/phone/start',
  asyncHandler(async (req, res) => {
    const { phone } = phoneStartSchema.parse(req.body);
    // TODO: integrate an SMS provider. Until then we return a fixed development code.
    return res.json({
      sent: true,
      phone,
      message: `დამადასტურებელი კოდი გამოგზავნილია ნომერზე ${phone}.`,
      devCode: process.env.NODE_ENV === 'production' ? undefined : DEV_SMS_CODE,
    });
  }),
);

authRouter.post(
  '/phone/verify',
  asyncHandler(async (req, res) => {
    const { phone, code, fullName, gender, birthDate } = phoneVerifySchema.parse(req.body);

    if (code !== DEV_SMS_CODE) {
      return res.status(401).json({ error: 'დამადასტურებელი კოდი არასწორია.' });
    }

    let user = await prisma.user.findUnique({ where: { phone }, include: { package: true } });
    if (!user) {
      const packageId = await ensureFreePackageId();
      const created = await prisma.user.create({
        data: {
          phone,
          email: `${phone.replace('+', '')}@phone.medicard.ge`,
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

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [usage, counts] = await Promise.all([
      getUsage(req.user.id),
      prisma.$transaction([
        prisma.medicalRecord.count({ where: { userId: req.user.id } }),
        prisma.chatSession.count({ where: { userId: req.user.id } }),
        prisma.medicationSchedule.count({ where: { userId: req.user.id, active: true } }),
      ]),
    ]);

    return res.json({
      user: publicUser(req.user),
      usage,
      stats: { records: counts[0], chats: counts[1], activeMedications: counts[2] },
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
