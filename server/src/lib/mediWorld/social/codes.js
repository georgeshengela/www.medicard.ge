import { randomBytes } from 'node:crypto';

export const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const FRIEND_CODE_LENGTH = 10;
export const CIRCLE_INVITE_LENGTH = 8;
export const ELIGIBILITY_POLICY_VERSION = 'social-eligibility-v1';
export const SOCIAL_PRIVACY_VERSION = 1;
export const SOCIAL_RULESET_ID = 'medi-world-social-v1';
export const WAVE_TYPES = Object.freeze(['hello', 'cheer', 'proud_of_you', 'gentle_support', 'garden_love']);
export const WAVE_OUTGOING_DAILY_CAP = 5;
export const WAVE_RECEIVED_SHOWN_CAP = 20;
export const CIRCLE_MEMBER_CAP = 6;
export const CIRCLE_INVITE_TTL_MS = 24 * 60 * 60 * 1000;
export const INBOX_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const DISPLAY_NAME_MAX = 24;
export const BIO_MAX = 80;
export const REPORT_DESCRIPTION_MAX = 280;
export const FRIENDSHIP_STATES = Object.freeze(['pending', 'accepted', 'declined', 'cancelled', 'removed', 'blocked']);
export const REPORT_CATEGORIES = Object.freeze([
  'harassment',
  'impersonation',
  'inappropriate_profile',
  'spam',
  'privacy_concern',
  'other',
]);
export const INBOX_KINDS = Object.freeze([
  'friend_request',
  'request_accepted',
  'care_wave',
  'circle_invite',
  'circle_membership',
]);

export function generateOpaqueCode(length = FRIEND_CODE_LENGTH) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += FRIEND_CODE_ALPHABET[bytes[i] % FRIEND_CODE_ALPHABET.length];
  }
  return out;
}

export function generateFriendCode() {
  const raw = generateOpaqueCode(FRIEND_CODE_LENGTH);
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export function normalizeFriendCode(raw) {
  return String(raw || '')
    .normalize('NFC')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/[01ILO]/g, '');
}

export function pairKeyFor(userA, userB) {
  const ids = [String(userA), String(userB)].sort();
  return `${ids[0]}:${ids[1]}`;
}

export function isWaveType(value) {
  return WAVE_TYPES.includes(value);
}

export function isReportCategory(value) {
  return REPORT_CATEGORIES.includes(value);
}
