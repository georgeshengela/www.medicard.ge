/**
 * Phone verification gate (owner decision 2026-09-27). Required only where abuse or real value
 * is at stake: joining / writing in the women's space, redeeming rewards and partner vouchers,
 * referrals and (later) family members. Everyday health features never require it.
 *
 * `User.phone` is only ever written after an OTP check (/api/auth/phone/verify,
 * /api/auth/phone/link/verify) or by an admin, so a stored Georgian mobile number means verified.
 */
import { t } from './i18n.js';

export const PHONE_REQUIRED_CODE = 'PHONE_VERIFICATION_REQUIRED';
export const PHONE_REQUIRED_MESSAGE = 'ამ ფუნქციისთვის ტელეფონის ნომრის დადასტურება საჭიროა.';
export const PHONE_REQUIRED_MESSAGE_EN = 'Please verify your phone number to use this feature.';

export function hasVerifiedPhone(user) {
  const digits = String(user?.phone ?? '').replace(/\D/g, '');
  return digits.length >= 9;
}

export function requireVerifiedPhone(req, res, next) {
  if (hasVerifiedPhone(req.user)) return next();
  return res.status(403).json({ error: t(req, PHONE_REQUIRED_MESSAGE, PHONE_REQUIRED_MESSAGE_EN), code: PHONE_REQUIRED_CODE });
}
