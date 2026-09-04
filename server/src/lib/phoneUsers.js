import { prisma } from './prisma.js';
import { normalizeSmsDestination } from './sms.js';

export const PHONE_TAKEN_CODE = 'PHONE_TAKEN';
export const PHONE_TAKEN_ERROR =
  '\u10d4\u10e1 \u10dc\u10dd\u10db\u10d4\u10e0\u10d8 \u10e3\u10d9\u10d5\u10d4 \u10db\u10d8\u10d1\u10db\u10e3\u10da\u10d8\u10d0 \u10e1\u10ee\u10d5\u10d0 \u10d0\u10dc\u10d2\u10d0\u10e0\u10d8\u10e8\u10d6\u10d4.';

export function phoneLookupValues(phone) {
  const digits = normalizeSmsDestination(phone);
  const national = digits.replace(/^995/, '');
  return [...new Set([`+${digits}`, digits, `+995${national}`, `995${national}`, national].filter(Boolean))];
}

export async function findUserByPhone(phone, { excludeUserId } = {}) {
  return prisma.user.findFirst({
    where: {
      phone: { in: phoneLookupValues(phone) },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

export function phoneTakenPayload() {
  return { error: PHONE_TAKEN_ERROR, code: PHONE_TAKEN_CODE };
}
