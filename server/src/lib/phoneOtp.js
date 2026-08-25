import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';
import { buildOtpMessage, normalizeSmsDestination, sendSms } from './sms.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

function generateCode() {
  return String(crypto.randomInt(1000, 9999));
}

function hashCode(code) {
  return bcrypt.hash(code, 10);
}

async function compareCode(code, hash) {
  return bcrypt.compare(code, hash);
}

function displayPhone(phone) {
  const d = normalizeSmsDestination(phone);
  if (d.length >= 4) return `••${d.slice(-4)}`;
  return phone;
}

/** Send a 4-digit OTP to a Georgian mobile number. */
export async function requestPhoneOtp({ phone, purpose = 'AUTH', userId = null }) {
  const normalized = normalizeSmsDestination(phone);
  if (!/^9955\d{8}$/.test(normalized)) {
    return { ok: false, status: 400, error: 'მობილური ნომერი უნდა იყოს ფორმატში +995 5XX XXX XXX.' };
  }

  const recent = await prisma.phoneVerification.findFirst({
    where: {
      phone: normalized,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return {
      ok: true,
      sent: true,
      phone: `+${normalized}`,
      masked: displayPhone(normalized),
      message: 'კოდი უკვე გამოგზავნილია. სცადეთ ხელახლა ერთი წუთის შემდეგ.',
      cooldownSec: Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000),
    };
  }

  await prisma.phoneVerification.updateMany({
    where: { phone: normalized, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = generateCode();
  const codeHash = await hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  const reference = `otp-${purpose}-${crypto.randomBytes(4).toString('hex')}`.slice(0, 20);

  await prisma.phoneVerification.create({
    data: {
      phone: normalized,
      codeHash,
      purpose,
      userId,
      reference,
      expiresAt,
    },
  });

  const result = {
    ok: true,
    sent: true,
    phone: `+${normalized}`,
    masked: displayPhone(normalized),
    message: `დამადასტურებელი კოდი გამოგზავნილია ნომერზე +${normalized}.`,
    reference,
  };

  try {
    const sms = await sendSms({
      destination: normalized,
      content: buildOtpMessage(code),
      purpose: 'OTP',
      reference,
      userId,
      urgent: true,
    });

    if (!sms.ok && env.NODE_ENV === 'production') {
      return { ok: false, status: 502, error: sms.message || 'SMS გაგზავნა ვერ მოხერხდა.' };
    }

    if (env.NODE_ENV !== 'production') {
      result.devCode = code;
      if (!sms.ok) {
        result.message = 'SMS გაუგზავნელია (dev). გამოიყენეთ devCode.';
      }
    }
  } catch (err) {
    console.error('[phone-otp] SMS failed:', err?.message ?? err);
    if (env.NODE_ENV === 'production') {
      return { ok: false, status: 502, error: 'SMS გაგზავნა ვერ მოხერხდა.' };
    }
    result.devCode = code;
    result.message = 'SMS გაუგზავნელია (dev). გამოიყენეთ devCode.';
  }

  return result;
}

/** Verify OTP — returns { ok, error?, status? } */
export async function verifyPhoneOtp({ phone, code, purpose = 'AUTH' }) {
  const normalized = normalizeSmsDestination(phone);
  const trimmed = String(code ?? '').trim();

  if (!/^\d{4}$/.test(trimmed)) {
    return { ok: false, status: 400, error: 'კოდი უნდა შედგებოდეს 4 ციფრისგან.' };
  }

  const row = await prisma.phoneVerification.findFirst({
    where: {
      phone: normalized,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!row) {
    return { ok: false, status: 400, error: 'კოდი არასწორია ან ვადა გაუვიდა.' };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: 'მეტისმეტი მცდელობა. მოითხოვეთ ახალი კოდი.' };
  }

  const valid = await compareCode(trimmed, row.codeHash);
  if (!valid) {
    await prisma.phoneVerification.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, status: 400, error: 'კოდი არასწორია.' };
  }

  await prisma.phoneVerification.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  return { ok: true, phone: `+${normalized}`, userId: row.userId, reference: row.reference };
}
