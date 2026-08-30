import { z } from 'zod';
import { prisma } from './prisma.js';
import { resolvePackageAiLimit } from './packages.js';

function packageIsExpired(user) {
  return Boolean(user?.packageExpiresAt && new Date(user.packageExpiresAt).getTime() < Date.now());
}

/**
 * Patient demographics.
 *
 * Sex and age are not profile decoration — laboratory reference ranges, drug dosing,
 * and differential diagnosis all shift with them, so these values are collected at
 * registration and injected into every EvidenceMD call as clinical context.
 */

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'];

const GENDER_KA = {
  MALE: 'მამრობითი',
  FEMALE: 'მდედრობითი',
  OTHER: 'სხვა',
};

export const genderSchema = z.enum(GENDERS, { error: 'აირჩიეთ სქესი' });

/** Rejects Feb 30 and friends, which the regex alone would happily accept. */
function isRealCalendarDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Accepts `YYYY-MM-DD` from the client and hands Prisma a UTC-midnight Date for a `@db.Date` column. */
export const birthDateSchema = z
  .string({ error: 'შეიყვანეთ დაბადების თარიღი' })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'დაბადების თარიღი უნდა იყოს ფორმატში წწწწ-თთ-დდ')
  .refine(isRealCalendarDate, 'ასეთი თარიღი არ არსებობს')
  .refine((value) => new Date(`${value}T00:00:00.000Z`) <= new Date(), 'დაბადების თარიღი მომავალში ვერ იქნება')
  .refine((value) => (calculateAge(`${value}T00:00:00.000Z`) ?? 0) <= 120, 'შეამოწმეთ დაბადების თარიღი')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

/**
 * Birth dates live in a `DATE` column, so they come back as UTC midnight. Reading the
 * birthday with UTC getters and today with local getters keeps the birthday from
 * sliding a day in either direction.
 */
export function calculateAge(birthDate, now = new Date()) {
  if (!birthDate) return null;

  const born = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;

  const bornMonth = born.getUTCMonth();
  const bornDay = born.getUTCDate();
  const month = now.getMonth();
  const day = now.getDate();

  let age = now.getFullYear() - born.getUTCFullYear();
  if (month < bornMonth || (month === bornMonth && day < bornDay)) age -= 1;

  return age >= 0 ? age : null;
}

/** `YYYY-MM-DD` — the shape the mobile client sends and expects back. */
export function toDateOnly(birthDate) {
  if (!birthDate) return null;
  const date = birthDate instanceof Date ? birthDate : new Date(birthDate);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/** The user shape safe to return over the wire — never includes the password hash. */
export function publicUser(user) {
  const expiredPaid = packageIsExpired(user) && user.package?.code && user.package.code !== 'FREE';
  const effectivePkg = expiredPaid ? null : user.package;
  const monthlyAiLimit = resolvePackageAiLimit(effectivePkg);
  const unlimited = !Number.isFinite(monthlyAiLimit);
  const pkg = effectivePkg
    ? {
        id: effectivePkg.id,
        code: effectivePkg.code,
        nameKa: effectivePkg.nameKa,
        nameEn: effectivePkg.nameEn,
        descriptionKa: effectivePkg.descriptionKa,
        monthlyAiLimit: unlimited ? -1 : monthlyAiLimit,
        dailyAiLimit: effectivePkg.dailyAiLimit,
        unlimited,
        priceGel: effectivePkg.priceGel,
        billingPeriod: 'monthly',
        features: effectivePkg.features ?? {},
      }
    : expiredPaid
      ? {
          id: 'free',
          code: 'FREE',
          nameKa: 'უფასო',
          nameEn: 'Free',
          descriptionKa: null,
          monthlyAiLimit: unlimited ? -1 : monthlyAiLimit,
          dailyAiLimit: 3,
          unlimited,
          priceGel: 0,
          billingPeriod: 'monthly',
          features: {},
        }
      : null;

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone ?? null,
    gender: user.gender ?? null,
    birthDate: toDateOnly(user.birthDate),
    age: calculateAge(user.birthDate),
    status: user.status ?? 'ACTIVE',
    package: pkg,
    packageStartedAt: user.packageStartedAt ?? null,
    packageExpiresAt: user.packageExpiresAt ?? null,
    createdAt: user.createdAt,
    points: user.points ?? 0,
    currentStreak: user.currentStreak ?? 0,
    longestStreak: user.longestStreak ?? 0,
    lastCheckInDate: toDateOnly(user.lastCheckInDate),
  };
}

/**
 * Georgian demographics block prepended to EvidenceMD prompts. Returns null when the
 * profile is incomplete so that legacy and phone-only accounts simply get no block
 * rather than a misleading one.
 */
export function buildPatientProfile(user) {
  const lines = [];

  const gender = GENDER_KA[user?.gender];
  if (gender) lines.push(`- სქესი: ${gender}`);

  const age = calculateAge(user?.birthDate);
  if (age !== null) lines.push(`- ასაკი: ${age} წელი`);

  const hp = user?.healthProfile;
  if (hp?.heightCm) lines.push(`- სიმაღლე: ${hp.heightCm} სმ`);
  if (hp?.weightKg) lines.push(`- წონა: ${hp.weightKg} კგ`);
  if (hp?.bloodType && hp.bloodType !== 'UNKNOWN') lines.push(`- სისხლის ჯგუფი: ${hp.bloodType}`);
  if (hp?.activityLevel) lines.push(`- აქტივობა: ${hp.activityLevel}`);
  if (hp?.exerciseFrequency) lines.push(`- ვარჯიში: ${hp.exerciseFrequency}`);
  if (hp?.sleepHours != null) lines.push(`- ძილი: ${hp.sleepHours} სთ`);
  if (hp?.sleepQuality) lines.push(`- ძილის ხარისხი: ${hp.sleepQuality}`);
  if (hp?.waterIntakeL != null) lines.push(`- წყლის მიზანი: ${hp.waterIntakeL} ლ`);
  if (hp?.restingHeartRate != null) lines.push(`- მოსვენების პულსი: ${hp.restingHeartRate}`);
  if (hp?.bloodPressureSystolic) {
    lines.push(`- წნევა: ${hp.bloodPressureSystolic}/${hp.bloodPressureDiastolic ?? '?'}`);
  }
  if (Array.isArray(hp?.allergies) && hp.allergies.length) {
    lines.push(`- ალერგიები: ${hp.allergies.join(', ')}`);
  }
  if (Array.isArray(hp?.chronicConditions) && hp.chronicConditions.length) {
    lines.push(`- ქრონიკული დაავადებები: ${hp.chronicConditions.join(', ')}`);
  }
  if (Array.isArray(hp?.medications) && hp.medications.length) {
    lines.push(`- მედიკამენტები: ${hp.medications.join(', ')}`);
  }
  if (Array.isArray(hp?.familyHistory) && hp.familyHistory.length) {
    lines.push(`- ოჯახური ანამნეზი: ${hp.familyHistory.join(', ')}`);
  }
  if (Array.isArray(hp?.healthGoals) && hp.healthGoals.length) {
    lines.push(`- ჯანმრთელობის მიზნები: ${hp.healthGoals.join(', ')}`);
  }

  if (lines.length === 0) return null;

  return [
    'პაციენტის დემოგრაფიული მონაცემები:',
    ...lines,
    'გაითვალისწინე პაციენტის სქესი და ასაკი ნორმის საზღვრების, დიფერენციული დიაგნოზის, დოზირებისა და რისკების შეფასებისას.',
  ].join('\n');
}

/** Health profile safe for client. */
export function publicHealthProfile(profile) {
  if (!profile) return null;
  return {
    heightCm: profile.heightCm ?? null,
    weightKg: profile.weightKg ?? null,
    bloodType: profile.bloodType ?? null,
    activityLevel: profile.activityLevel ?? null,
    exerciseFrequency: profile.exerciseFrequency ?? null,
    sleepQuality: profile.sleepQuality ?? null,
    sleepHours: profile.sleepHours ?? null,
    stressLevel: profile.stressLevel ?? null,
    smokingStatus: profile.smokingStatus ?? null,
    alcoholUse: profile.alcoholUse ?? null,
    dietType: profile.dietType ?? null,
    waterIntakeL: profile.waterIntakeL ?? null,
    restingHeartRate: profile.restingHeartRate ?? null,
    bloodPressureSystolic: profile.bloodPressureSystolic ?? null,
    bloodPressureDiastolic: profile.bloodPressureDiastolic ?? null,
    chronicConditions: profile.chronicConditions ?? [],
    allergies: profile.allergies ?? [],
    medications: profile.medications ?? [],
    familyHistory: profile.familyHistory ?? [],
    healthGoals: profile.healthGoals ?? [],
    extraAnswers: profile.extraAnswers ?? {},
    currentStepIndex: profile.currentStepIndex ?? 0,
    completedAt: profile.completedAt ?? null,
    bmi:
      profile.heightCm && profile.weightKg
        ? Math.round((profile.weightKg / (profile.heightCm / 100) ** 2) * 10) / 10
        : null,
  };
}

/** Merges the demographics block with any context the user typed in themselves. */
export function withPatientProfile(user, extra) {
  const merged = [buildPatientProfile(user), extra?.trim() || null].filter(Boolean).join('\n\n');
  return merged || undefined;
}

export async function loadPatientAiBundle(userId) {
  const [healthProfile, metrics, schedules, cycle] = await Promise.all([
    prisma.healthProfile.findUnique({ where: { userId } }),
    prisma.healthMetricDaily.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 14,
    }),
    prisma.medicationSchedule.findMany({
      where: { userId, active: true },
      select: { medName: true, dosage: true, frequency: true },
    }),
    prisma.cycleProfile.findUnique({
      where: { userId },
      select: { mode: true },
    }),
  ]);
  return { healthProfile, metrics, schedules, cycleMode: cycle?.mode ?? null };
}

function formatMetricDay(row) {
  const bits = [row.date];
  if (row.steps != null) bits.push(`ნაბიჯები ${row.steps}`);
  if (row.hydrationMl != null) bits.push(`ჰიდრატაცია ${Math.round(row.hydrationMl)}ml`);
  if (row.weightKg != null) bits.push(`წონა ${row.weightKg}კგ`);
  if (row.sleepHours != null) bits.push(`ძილი ${row.sleepHours}სთ`);
  if (row.heartRate != null) bits.push(`პულსი ${Math.round(row.heartRate)}`);
  if (row.bloodPressureSystolic != null) {
    bits.push(`წნევა ${row.bloodPressureSystolic}/${row.bloodPressureDiastolic ?? '?'}`);
  }
  if (row.nutritionKcal != null) bits.push(`კვება ${Math.round(row.nutritionKcal)}კკალ`);
  if (row.activeMinutes != null) bits.push(`აქტივობა ${row.activeMinutes}წთ`);
  if (row.distanceKm != null) bits.push(`მანძილი ${row.distanceKm}კმ`);
  return bits.length > 1 ? `- ${bits.join(', ')}` : null;
}

export function buildTrackedMetricsBlock(metrics) {
  const lines = (metrics ?? []).map(formatMetricDay).filter(Boolean);
  if (!lines.length) return null;
  return [
    'ბოლო 14 დღის ჯანმრთელობის მაჩვენებლები (ნაბიჯები, ჰიდრატაცია, წონა, ძილი, პულსი, წნევა, კვება):',
    ...lines,
    'გაითვალისწინე ეს მონაცემები რჩევებში და რისკების შეფასებაში. ეს არ არის დიაგნოზი.',
  ].join('\n');
}

/**
 * Full clinical context for Medi / analysis — profile + scheduled meds + recent daily metrics.
 * Use this on every EvidenceMD call. `withPatientProfile` is only the sync leftover.
 */
export async function withPatientAiContext(user, extra) {
  if (!user?.id) return withPatientProfile(user, extra);
  const bundle = await loadPatientAiBundle(user.id);
  const enriched = { ...user, healthProfile: user.healthProfile ?? bundle.healthProfile };
  const meds = bundle.schedules.length
    ? [
        'დაგეგმილი მედიკამენტები:',
        ...bundle.schedules.map(
          (row) =>
            `- ${row.medName}${row.dosage ? ` ${row.dosage}` : ''}${row.frequency ? ` (${row.frequency})` : ''}`,
        ),
      ].join('\n')
    : null;
  const cycle = bundle.cycleMode ? `ციკლის რეჟიმი: ${bundle.cycleMode}` : null;
  const merged = [
    buildPatientProfile(enriched),
    buildTrackedMetricsBlock(bundle.metrics),
    meds,
    cycle,
    extra?.trim() || null,
  ]
    .filter(Boolean)
    .join('\n\n');
  return merged || undefined;
}
