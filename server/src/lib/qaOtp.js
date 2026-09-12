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

/** Master QA codes never authenticate unless the env/settings switch is on. */
export function qaMasterCodeAllowed(enabled, presented, expected) {
  if (!enabled) return false;
  return sameDigits(String(presented ?? '').trim(), String(expected ?? ''));
}

export function qaOtpEnabledForEnv(nodeEnv, envCodeSet, settingsFlag) {
  if (nodeEnv === 'production') return false;
  return Boolean(envCodeSet || settingsFlag);
}

export async function isQaOtpEnabled() {
  if (env.NODE_ENV === 'production') return false;
  if (resolveQaCodes(env.QA_OTP_CODE).enabledByEnv) return true;
  try {
    const settings = await getAppSettings();
    return qaOtpEnabledForEnv(env.NODE_ENV, false, Boolean(settings.qaOtpEnabled));
  } catch {
    return false;
  }
}

export async function matchesQaPhoneOtp(code) {
  return qaMasterCodeAllowed(await isQaOtpEnabled(), code, resolveQaCodes(env.QA_OTP_CODE).phone);
}

export async function matchesQaEmailOtp(code) {
  return qaMasterCodeAllowed(await isQaOtpEnabled(), code, resolveQaCodes(env.QA_OTP_CODE).email);
}
