import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { legacyOnboardingAnalysisResponse } from '../lib/onboardingAnalysis.js';
import { birthDateAgeError, birthDateInputSchema, genderSchema, publicHealthProfile, publicUser } from '../lib/patient.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { t } from '../lib/i18n.js';

export const healthProfileRouter = Router();

healthProfileRouter.use(requireAuth);

const stringArray = z.array(z.string().trim().min(1).max(120)).max(40);

const patchHealthProfileSchema = z
  .object({
    heightCm: z.number().min(80).max(250).optional(),
    weightKg: z.number().min(20).max(300).optional(),
    bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN']).optional(),
    activityLevel: z.enum(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE']).optional(),
    exerciseFrequency: z.enum(['NEVER', 'RARE', 'WEEKLY', 'DAILY']).optional(),
    sleepQuality: z.enum(['POOR', 'FAIR', 'GOOD', 'EXCELLENT']).optional(),
    sleepHours: z.number().min(3).max(14).optional(),
    stressLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH']).optional(),
    smokingStatus: z.enum(['NEVER', 'FORMER', 'CURRENT']).optional(),
    alcoholUse: z.enum(['NEVER', 'OCCASIONAL', 'REGULAR']).optional(),
    dietType: z.enum(['OMNIVORE', 'VEGETARIAN', 'VEGAN', 'KETO', 'OTHER']).optional(),
    waterIntakeL: z.number().min(0.5).max(6).optional(),
    restingHeartRate: z.number().int().min(40).max(220).optional(),
    bloodPressureSystolic: z.number().int().min(70).max(250).optional(),
    bloodPressureDiastolic: z.number().int().min(40).max(150).optional(),
    chronicConditions: stringArray.optional(),
    allergies: stringArray.optional(),
    medications: stringArray.optional(),
    familyHistory: stringArray.optional(),
    healthGoals: stringArray.optional(),
    extraAnswers: z.record(z.string(), z.unknown()).optional(),
    currentStepIndex: z.number().int().min(0).max(100).optional(),
    /** Demographics can be finalized during assessment */
    gender: genderSchema.optional(),
    birthDate: birthDateInputSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'განსაახლებელი ველი არ არის მითითებული');

const completeSchema = z.object({
  gender: genderSchema,
  birthDate: birthDateInputSchema,
  heightCm: z.number().min(80).max(250).optional(),
  weightKg: z.number().min(20).max(300).optional(),
});

async function loadProfile(userId) {
  return prisma.healthProfile.findUnique({ where: { userId } });
}

healthProfileRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const profile = await loadProfile(req.user.id);
    return res.json({ profile: publicHealthProfile(profile) });
  }),
);

healthProfileRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const data = patchHealthProfileSchema.parse(req.body);
    const { gender, birthDate, ...profileFields } = data;
    const ageError = birthDateAgeError(birthDate, req.user.birthDate, req.lang);
    if (ageError) return res.status(400).json({ error: ageError, code: 'MIN_AGE' });

    if (gender !== undefined || birthDate !== undefined) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          ...(gender !== undefined ? { gender } : {}),
          ...(birthDate !== undefined ? { birthDate } : {}),
        },
      });
    }

    const profile = await prisma.$transaction(async tx => {
      await tx.healthProfile.upsert({where:{userId:req.user.id},create:{userId:req.user.id},update:{}});
      await tx.$queryRaw`SELECT "userId" FROM "HealthProfile" WHERE "userId"=${req.user.id} FOR UPDATE`;
      if (profileFields.extraAnswers) {
        const existing=await tx.healthProfile.findUnique({where:{userId:req.user.id}});
        // Canonical app state is written through its dedicated merge endpoint.
        const {appState:_ignored,...extra}=profileFields.extraAnswers;
        profileFields.extraAnswers={...(existing?.extraAnswers || {}),...extra};
      }
      return tx.healthProfile.update({where:{userId:req.user.id},data:profileFields});
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { package: true },
    });

    return res.json({
      profile: publicHealthProfile(profile),
      user: publicUser(user),
    });
  }),
);

// The onboarding „health score“ is gone (owner 2026-10-08): it was a paid AI call whose 0–100 score no
// screen showed. Older app builds still call this once after the AI-consent step and read only `profile`,
// so it keeps the answer shape — no model call, no score, nothing stored, nothing sent anywhere.
healthProfileRouter.post(
  '/onboarding-analysis',
  asyncHandler(async (req, res) => {
    const profile = await loadProfile(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: t(req, 'პროფილი ვერ მოიძებნა', 'Profile not found') });
    }
    return res.json(legacyOnboardingAnalysisResponse(publicHealthProfile(profile)));
  }),
);

healthProfileRouter.post(
  '/complete',
  asyncHandler(async (req, res) => {
    const data = completeSchema.parse(req.body);
    const ageError = birthDateAgeError(data.birthDate, req.user.birthDate, req.lang);
    if (ageError) return res.status(400).json({ error: ageError, code: 'MIN_AGE' });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { gender: data.gender, birthDate: data.birthDate },
    });

    const profile = await prisma.healthProfile.upsert({
      where: { userId: req.user.id },
      create: {
        userId: req.user.id,
        heightCm: data.heightCm,
        weightKg: data.weightKg,
        completedAt: new Date(),
      },
      update: {
        heightCm: data.heightCm,
        weightKg: data.weightKg,
        completedAt: new Date(),
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { package: true },
    });

    return res.json({
      profile: publicHealthProfile(profile),
      user: publicUser(user),
    });
  }),
);
