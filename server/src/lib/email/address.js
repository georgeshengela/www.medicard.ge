import crypto from 'node:crypto';

/** Phone-only accounts get a synthetic `<number>@phone.medicard.ge` login; it is not a mailbox. */
export const SYNTHETIC_EMAIL_DOMAIN = 'phone.medicard.ge';
/** Sign in with Apple without a shared address gets `apple.<hash>@apple.medicard.ge` (src/lib/socialAuth.js). */
export const SYNTHETIC_EMAIL_DOMAINS = Object.freeze([SYNTHETIC_EMAIL_DOMAIN, 'apple.medicard.ge']);

export function isSyntheticEmail(value) {
  const email = normalizeEmail(value);
  return SYNTHETIC_EMAIL_DOMAINS.some((domain) => email.endsWith(`@${domain}`));
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

/** A real, mailable address: syntactically plausible and not a synthetic phone / Apple login. */
export function isDeliverableEmail(value) {
  const email = normalizeEmail(value);
  if (email.length < 6 || email.length > 254) return false;
  if (!/^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i.test(email)) return false;
  return !isSyntheticEmail(email);
}

/**
 * RFC 2606 / 6761 names that never receive mail (example.com, *.test, *.invalid, *.localhost).
 * Resend rejects them with validation_error, so the contact form refuses them up front.
 */
export function isReservedTestDomain(value) {
  const domain = normalizeEmail(value).split('@')[1] || '';
  return /(^|\.)example\.(com|net|org)$/.test(domain) || /\.(test|invalid|localhost|example)$/.test(domain);
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
