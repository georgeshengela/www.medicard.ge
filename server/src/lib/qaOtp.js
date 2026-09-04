import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { getAppSettings } from './settings.js';
import { resolveQaCodes } from './qaOtpCodes.js';

export { resolveQaCodes };

function sameDigits(left, right) {
  const a = String(left ?? '');
  const b = String(right ?? '');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function isQaOtpEnabled() {
  if (resolveQaCodes(env.QA_OTP_CODE).enabledByEnv) return true;
  try {
    const settings = await getAppSettings();
    return Boolean(settings.qaOtpEnabled);
  } catch {
    return false;
  }
}

export async function matchesQaPhoneOtp(code) {
  if (!(await isQaOtpEnabled())) return false;
  return sameDigits(String(code ?? '').trim(), resolveQaCodes(env.QA_OTP_CODE).phone);
}

export async function matchesQaEmailOtp(code) {
  if (!(await isQaOtpEnabled())) return false;
  return sameDigits(String(code ?? '').trim(), resolveQaCodes(env.QA_OTP_CODE).email);
}
