export const OTP_MAX_ATTEMPTS = 5;

export function unusedUnexpiredOtpWhere(now = new Date()) {
  return { usedAt: null, expiresAt: { gt: now } };
}

export function evaluateOtpRow(row, now = new Date()) {
  if (!row) {
    return { ok: false, status: 400, error: 'კოდი არასწორია ან ვადა გაუვიდა.' };
  }
  if (row.usedAt) {
    return { ok: false, status: 400, error: 'კოდი არასწორია ან ვადა გაუვიდა.' };
  }
  if (new Date(row.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, status: 400, error: 'კოდი არასწორია ან ვადა გაუვიდა.' };
  }
  if ((row.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    return { ok: false, status: 429, error: 'მეტისმეტი მცდელობა. მოითხოვეთ ახალი კოდი.' };
  }
  return { ok: true };
}

export function otpPhonesMatch(left, right) {
  return String(left || '') === String(right || '') && String(left || '').length > 0;
}
