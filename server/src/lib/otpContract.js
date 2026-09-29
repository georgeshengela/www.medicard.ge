import { t } from './i18n.js';

export const OTP_MAX_ATTEMPTS = 5;

export function unusedUnexpiredOtpWhere(now = new Date()) {
  return { usedAt: null, expiresAt: { gt: now } };
}

export function evaluateOtpRow(row, now = new Date(), lang = 'ka') {
  const invalid = t(lang, 'კოდი არასწორია ან ვადა გაუვიდა.', 'The code is wrong or has expired.');
  if (!row) {
    return { ok: false, status: 400, error: invalid };
  }
  if (row.usedAt) {
    return { ok: false, status: 400, error: invalid };
  }
  if (new Date(row.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, status: 400, error: invalid };
  }
  if ((row.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: t(lang, 'მეტისმეტი მცდელობა. მოითხოვე ახალი კოდი.', 'Too many attempts. Request a new code.') };
  }
  return { ok: true };
}

export function otpPhonesMatch(left, right) {
  return String(left || '') === String(right || '') && String(left || '').length > 0;
}
