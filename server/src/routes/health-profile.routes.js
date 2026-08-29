import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { generateOnboardingAnalysis } from '../lib/onboardingAnalysis.js';
import { birthDateSchema, genderSchema, publicHealthProfile, publicUser } from '../lib/patient.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

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
    birthDate: birthDateSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'განსაახლებელი ველი არ არის მითითებული');

const completeSchema = z.object({
  gender: genderSchema,
  birthDate: birthDateSchema,
  heightCm: z.number().min(80).max(250),
  weightKg: z.number().min(20).max(300),
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

    if (gender !== undefined || birthDate !== undefined) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          ...(gender !== undefined ? { gender } : {}),
          ...(birthDate !== undefined ? { birthDate } : {}),
        },
      });
    }

    if (profileFields.extraAnswers && typeof profileFields.extraAnswers === 'object') {
      const existing = await loadProfile(req.user.id);
      profileFields.extraAnswers = {
        ...(existing?.extraAnswers ?? {}),
        ...profileFields.extraAnswers,
      };
    }

    const profile = await prisma.healthProfile.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, ...profileFields },
      update: profileFields,
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

healthProfileRouter.post(
  '/onboarding-analysis',
  asyncHandler(async (req, res) => {
    const profile = await loadProfile(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: 'პროფილი ვერ მოიძებნა' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { package: true },
    });

    const extra = (profile.extraAnswers ?? {});
    const force = req.body?.force === true;
    const previousScore =
      typeof extra.onboardingAnalysis?.score === 'number' ? extra.onboardingAnalysis.score : null;

    if (!force && previousScore != null) {
      return res.json({
        analysis: extra.onboardingAnalysis,
        profile: publicHealthProfile(profile),
        cached: true,
      });
    }

    const [metrics, schedules, cycle] = await Promise.all([
      prisma.healthMetricDaily.findMany({
        where: { userId: req.user.id },
        orderBy: { date: 'desc' },
        take: 14,
      }),
      prisma.medicationSchedule.findMany({
        where: { userId: req.user.id, active: true },
        select: { medName: true, dosage: true },
      }),
      prisma.cycleProfile.findUnique({
        where: { userId: req.user.id },
        select: { mode: true },
      }),
    ]);

    const analysis = await generateOnboardingAnalysis({
      profile,
      user,
      extras: extra,
      metrics,
      scheduledMeds: schedules.map((row) => `${row.medName}${row.dosage ? ` ${row.dosage}` : ''}`),
      cycleMode: cycle?.mode ?? null,
      previousScore: force ? previousScore : null,
    });
    const mergedExtra = { ...extra, onboardingAnalysis: analysis };

    const updated = await prisma.healthProfile.update({
      where: { userId: req.user.id },
      data: { extraAnswers: mergedExtra },
    });

    return res.json({
      analysis,
      profile: publicHealthProfile(updated),
      cached: false,
    });
  }),
);

healthProfileRouter.post(
  '/complete',
  asyncHandler(async (req, res) => {
    const data = completeSchema.parse(req.body);

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
