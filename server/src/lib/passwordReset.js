import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { sendPasswordResetCode } from './email.js';
import { isQaOtpEnabled, matchesQaEmailOtp } from './qaOtp.js';
import { evaluateOtpRow, unusedUnexpiredOtpWhere } from './otpContract.js';
import { t } from './i18n.js';

const CODE_TTL_MS = 10 * 60 * 1000;
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

export const EMAIL_NOT_FOUND_MESSAGE =
  'ამ ელ-ფოსტით ანგარიში ვერ მოიძებნა. შეამოწმე მისამართი. თუ ტელეფონის ნომრით დარეგისტრირდი, შედი SMS კოდით.';
export const EMAIL_NOT_FOUND_MESSAGE_EN =
  "We couldn't find an account with this email. Check the address. If you signed up with your phone number, sign in with an SMS code.";

/**
 * Owner decision 2026-09-29: say plainly when no account uses this email (a typo like icoud.com
 * otherwise looks like "sent" and nothing arrives). Registration already reveals taken emails, so
 * hiding it here protected nothing; the route is IP-limited instead (forgotPasswordLimiter).
 * Blocked accounts still get the neutral answer.
 */
export async function requestPasswordReset(email, lang = 'ka') {
  const normalized = email.trim().toLowerCase();
  const user = normalized.endsWith('@phone.medicard.ge')
    ? null
    : await prisma.user.findUnique({ where: { email: normalized } });

  if (!user) {
    return { sent: false, code: 'EMAIL_NOT_FOUND', message: t(lang, EMAIL_NOT_FOUND_MESSAGE, EMAIL_NOT_FOUND_MESSAGE_EN) };
  }
  if (user.status === 'BLOCKED') {
    return { sent: true, message: t(lang, 'თუ ელ-ფოსტა რეგისტრირებულია, კოდს მიიღებ რამდენიმე წუთში.', "If this email is registered, you'll get a code in a few minutes.") };
  }

  const recent = await prisma.passwordReset.findFirst({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { sent: true, message: t(lang, 'კოდი უკვე გამოგზავნილია. სცადე ხელახლა ერთი წუთის შემდეგ.', 'A code has already been sent. Try again in a minute.') };
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
    message: t(lang, 'კოდი გამოგზავნილია შენს ელ-ფოსტაზე.', 'We sent a code to your email.'),
  };

  try {
    await sendPasswordResetCode({ to: normalized, code, fullName: user.fullName, lang: t(lang, 'ka', 'en') });
  } catch (err) {
    console.error('[password-reset] email send failed:', err?.message ?? err);
    if (process.env.NODE_ENV === 'production' && !(await isQaOtpEnabled())) {
      throw err;
    }
    if (process.env.NODE_ENV !== 'production') {
      result.message = t(lang, 'ელ-ფოსტის გაგზავნა ვერ მოხერხდა (dev). გამოიყენეთ devCode.', 'Email could not be sent (dev). Use devCode.');
      result.devCode = code;
    }
    return result;
  }

  if (process.env.NODE_ENV !== 'production') {
    result.devCode = code;
  }

  return result;
}

export async function resetPasswordWithCode({ email, code, password, lang = 'ka' }) {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  if (!user) {
    return { ok: false, status: 400, error: t(lang, 'კოდი არასწორია ან ვადა გაუვიდა.', 'The code is wrong or has expired.') };
  }

  if (await matchesQaEmailOtp(code)) {
    console.warn('[qa-otp] accepted master email code for', normalized);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(password, 12) },
      }),
      prisma.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  const reset = await prisma.passwordReset.findFirst({
    where: {
      userId: user.id,
      ...unusedUnexpiredOtpWhere(),
    },
    orderBy: { createdAt: 'desc' },
  });

  const gate = evaluateOtpRow(reset, new Date(), lang);
  if (!gate.ok) {
    return { ok: false, status: gate.status, error: gate.error };
  }

  const valid = await compareCode(code.trim(), reset.codeHash);
  if (!valid) {
    await prisma.passwordReset.update({
      where: { id: reset.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, status: 400, error: t(lang, 'კოდი არასწორია.', 'The code is wrong.') };
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
