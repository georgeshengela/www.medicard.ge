import { z } from 'zod';

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
  const pkg = user.package
    ? {
        id: user.package.id,
        code: user.package.code,
        nameKa: user.package.nameKa,
        nameEn: user.package.nameEn,
        descriptionKa: user.package.descriptionKa,
        dailyAiLimit: user.package.dailyAiLimit,
        unlimited: user.package.dailyAiLimit < 0,
        priceGel: user.package.priceGel,
        features: user.package.features ?? {},
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
    packageExpiresAt: user.packageExpiresAt ?? null,
    createdAt: user.createdAt,
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

  if (lines.length === 0) return null;

  return [
    'პაციენტის დემოგრაფიული მონაცემები:',
    ...lines,
    'გაითვალისწინე პაციენტის სქესი და ასაკი ნორმის საზღვრების, დიფერენციული დიაგნოზის, დოზირებისა და რისკების შეფასებისას.',
  ].join('\n');
}

/** Merges the demographics block with any context the user typed in themselves. */
export function withPatientProfile(user, extra) {
  const merged = [buildPatientProfile(user), extra?.trim() || null].filter(Boolean).join('\n\n');
  return merged || undefined;
}
