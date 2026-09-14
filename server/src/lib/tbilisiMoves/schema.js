import { z } from 'zod';
import { ALLOWED_OBSERVATION_PROVIDERS, PUBLIC_AVATAR_IDS } from './catalog.js';
import { CONFIG_BOUNDS } from './constants.js';
import { YMD_RE } from './time.js';

const intField = (bounds) => z.number().int().min(bounds.min).max(bounds.max);

export const handleSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, ' '))
  .refine((value) => value.replace(/\s/g, '').length >= 2, 'საჯარო სახელი ძალიან მოკლეა.')
  .refine((value) => value.length >= 2 && value.length <= 24, 'საჯარო სახელი 2–24 სიმბოლო უნდა იყოს.')
  .refine(
    (value) => /^[A-Za-z0-9 \u10A0-\u10FF]+$/.test(value),
    'საჯარო სახელი მხოლოდ ქართული/ლათინური ასოები, ციფრები და გამოტოვება.',
  );

export const avatarSchema = z
  .string()
  .refine((value) => PUBLIC_AVATAR_IDS.includes(value), 'არასწორი ავატარი.');

export const enrollBodySchema = z.object({
  districtId: z.string().uuid(),
  publicHandle: handleSchema,
  publicAvatarId: avatarSchema.optional().nullable(),
  acceptLock: z.literal(true),
  acceptPublicBoard: z.literal(true),
});

export const districtChangeBodySchema = z.object({
  districtId: z.string().uuid(),
  acceptLock: z.literal(true),
});

export const patchMeBodySchema = z
  .object({
    publicHandle: handleSchema.optional(),
    publicAvatarId: avatarSchema.nullable().optional(),
  })
  .refine((body) => body.publicHandle != null || body.publicAvatarId !== undefined, {
    message: 'ცვლილება არ არის.',
  });

export const observationBodySchema = z.object({
  clientObservationId: z.string().uuid(),
  provider: z.string().min(1).max(40),
  sourceInstallationId: z.string().trim().min(1).max(80),
  tbilisiDate: z.string().regex(YMD_RE),
  intervalStart: z.string().min(10).max(40),
  intervalEnd: z.string().min(10).max(40),
  cumulativeSteps: z.number().int().min(0).max(200_000),
  recordedAt: z.string().min(10).max(40),
  clientSequence: z.number().int().min(0).max(1_000_000_000).optional(),
});

export function providerIsAllowed(provider) {
  return ALLOWED_OBSERVATION_PROVIDERS.includes(String(provider || '').toUpperCase());
}

export const configPatchSchema = z
  .object({
    revision: z.number().int().min(1),
    reason: z.string().trim().min(3).max(400).optional(),
    featureEnabled: z.boolean().optional(),
    enrollmentOpen: z.boolean().optional(),
    ingestionPaused: z.boolean().optional(),
    ingestionEnabled: z.boolean().optional(),
    competitionPaused: z.boolean().optional(),
    rewardsEnabled: z.boolean().optional(),
    leaderRecognitionEnabled: z.boolean().optional(),
    leaderRewardedRanks: intField(CONFIG_BOUNDS.leaderRewardedRanks).optional(),
    districtGoalBadgeEnabled: z.boolean().optional(),
    pilotMode: z.boolean().optional(),
    defaultDailyTarget: intField(CONFIG_BOUNDS.defaultDailyTarget).optional(),
    competitiveCap: intField(CONFIG_BOUNDS.competitiveCap).optional(),
    cooldownDays: intField(CONFIG_BOUNDS.cooldownDays).optional(),
    minParticipantsForRank: intField(CONFIG_BOUNDS.minParticipantsForRank).optional(),
    lateSyncGraceHours: intField(CONFIG_BOUNDS.lateSyncGraceHours).optional(),
    sanityMaxRawSteps: intField(CONFIG_BOUNDS.sanityMaxRawSteps).optional(),
    correctionDropFlagPct: intField(CONFIG_BOUNDS.correctionDropFlagPct).optional(),
    geometryAssetVersion: z.string().trim().max(80).nullable().optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.pilotMode === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pilotMode'],
        message: 'პილოტური რეჟიმი ამ ინგესტიით ვერ გამოირთვება.',
      });
    }
  });

export const districtPatchSchema = z
  .object({
    revision: z.number().int().min(1),
    reason: z.string().trim().min(3).max(400).optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
    dailyTargetOverride: z.number().int().min(1_000).max(50_000_000).nullable().optional(),
  })
  .strict();

export const peopleQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  before: z.string().regex(YMD_RE).optional(),
});

export const awardsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

export const adminListQuerySchema = z.object({
  date: z.string().regex(YMD_RE).optional(),
  districtId: z.string().uuid().optional(),
  creditId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  excluded: z.enum(['true', 'false']).optional(),
  flagged: z.enum(['true', 'false']).optional(),
  status: z.enum(['ACTIVE', 'REVOKED']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

export const reasonBodySchema = z.object({
  reason: z.string().trim().min(3).max(400),
});

export const finalizeBodySchema = z.object({
  previewHash: z.string().regex(/^[a-f0-9]{64}$/),
  revision: z.number().int().min(0),
});

export const correctBodySchema = z.object({
  previewHash: z.string().regex(/^[a-f0-9]{64}$/),
  fromRevision: z.number().int().min(1),
  reason: z.string().trim().min(3).max(400),
});

export function normalizeConfigPatch(body) {
  const next = { ...body };
  if (typeof next.ingestionEnabled === 'boolean' && next.ingestionPaused == null) {
    next.ingestionPaused = !next.ingestionEnabled;
  }
  delete next.ingestionEnabled;
  delete next.pilotMode;
  return next;
}

export function assertConfigRelationships(row) {
  if (row.competitiveCap > row.sanityMaxRawSteps) {
    const err = new Error('ინდივიდუალური ლიმიტი სანიტარულ მაქსიმუმზე მეტი არ შეიძლება.');
    err.status = 400;
    err.code = 'CONFIG_RELATIONSHIP';
    throw err;
  }
}
