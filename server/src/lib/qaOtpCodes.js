const DEFAULT_PHONE = '0000';
const DEFAULT_EMAIL = '000000';

/** Parse QA_OTP_CODE — 4 digits for SMS, 6 for email, or empty = unset. */
export function resolveQaCodes(envCode = '') {
  const raw = String(envCode ?? '').trim();
  const fromEnv = /^\d{4,6}$/.test(raw) ? raw : '';
  return {
    enabledByEnv: Boolean(fromEnv),
    phone: fromEnv.length === 4 ? fromEnv : DEFAULT_PHONE,
    email: fromEnv.length === 6 ? fromEnv : fromEnv.length === 4 ? fromEnv.padEnd(6, '0') : DEFAULT_EMAIL,
  };
}
