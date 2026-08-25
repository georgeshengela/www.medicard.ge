import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { sendPasswordResetCode } from './email.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

function generateCode() {
  return String(crypto.randomInt(100_000, 999_999));
}

function hashCode(code) {
  return bcrypt.hash(code, 10);
}

async function compareCode(code, hash) {
  return bcrypt.compare(code, hash);
}

/** Always returns generic success — never reveals whether the email exists. */
export async function requestPasswordReset(email) {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  if (!user || user.status === 'BLOCKED') {
    return { sent: true, message: 'თუ ელ-ფოსტა რეგისტრირებულია, კოდს მიიღებთ რამდენიმე წუთში.' };
  }

  const recent = await prisma.passwordReset.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { sent: true, message: 'კოდი უკვე გამოგზავნილია. სცადეთ ხელახლა ერთი წუთის შემდეგ.' };
  }

  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = generateCode();
  const codeHash = await hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      email: normalized,
      codeHash,
      expiresAt,
    },
  });

  const result = {
    sent: true,
    message: 'კოდი გამოგზავნილია თქვენს ელ-ფოსტაზე.',
  };

  try {
    await sendPasswordResetCode({ to: normalized, code, fullName: user.fullName });
  } catch (err) {
    console.error('[password-reset] email send failed:', err?.message ?? err);
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
    result.message = 'ელ-ფოსტის გაგზავნა ვერ მოხერხდა (dev). გამოიყენეთ devCode.';
    result.devCode = code;
    return result;
  }

  if (process.env.NODE_ENV !== 'production') {
    result.devCode = code;
  }

  return result;
}

export async function resetPasswordWithCode({ email, code, password }) {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  if (!user) {
    return { ok: false, status: 400, error: 'კოდი არასწორია ან ვადა გაუვიდა.' };
  }

  const reset = await prisma.passwordReset.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!reset) {
    return { ok: false, status: 400, error: 'კოდი არასწორია ან ვადა გაუვიდა.' };
  }

  if (reset.attempts >= MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: 'მეტისმეტი მცდელობა. მოითხოვეთ ახალი კოდი.' };
  }

  const valid = await compareCode(code.trim(), reset.codeHash);
  if (!valid) {
    await prisma.passwordReset.update({
      where: { id: reset.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, status: 400, error: 'კოდი არასწორია.' };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    }),
    prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null, id: { not: reset.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}
