import crypto from 'node:crypto';

/** Phone-only accounts get a synthetic `<number>@phone.medicard.ge` login; it is not a mailbox. */
export const SYNTHETIC_EMAIL_DOMAIN = 'phone.medicard.ge';

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

/** A real, mailable address: syntactically plausible and not a synthetic phone login. */
export function isDeliverableEmail(value) {
  const email = normalizeEmail(value);
  if (email.length < 6 || email.length > 254) return false;
  if (!/^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i.test(email)) return false;
  return !email.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}

/** sha256 of the lowercased address — the only form stored in EmailLog / EmailSuppression. */
export function hashEmail(value) {
  return crypto.createHash('sha256').update(normalizeEmail(value), 'utf8').digest('hex');
}

/** g***@gmail.com — for admin screens; the local part never shows more than its first character. */
export function maskEmail(value) {
  const email = normalizeEmail(value);
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***@${email.slice(at + 1)}`;
}
