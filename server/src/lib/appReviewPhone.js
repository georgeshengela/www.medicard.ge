import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { normalizeSmsDestination } from './sms.js';

/** The configured App Review number as SMS digits (9955XXXXXXXX), or '' when off. */
export function appReviewPhoneDigits(phone = env.APP_REVIEW_PHONE, code = env.APP_REVIEW_OTP) {
  const digits = normalizeSmsDestination(phone);
  return /^9955\d{8}$/.test(digits) && /^\d{4}$/.test(String(code ?? '')) ? digits : '';
}

export function isAppReviewPhone(phone, config = {}) {
  const review = appReviewPhoneDigits(config.phone ?? env.APP_REVIEW_PHONE, config.code ?? env.APP_REVIEW_OTP);
  return Boolean(review) && normalizeSmsDestination(phone) === review;
}

/** Only the review number with exactly the review code; every other number goes through SMS. */
export function matchesAppReviewOtp(phone, code, config = {}) {
  const expected = String(config.code ?? env.APP_REVIEW_OTP ?? '');
  if (!isAppReviewPhone(phone, config)) return false;
  const presented = String(code ?? '').trim();
  if (presented.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}
