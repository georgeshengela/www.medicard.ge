import { getPreference, setPreference } from './storage';
import { tx } from '../i18n/locale.js';

/** Referral (Phase 3.4). Mirrors server/src/lib/referral.js code rules. */
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_LENGTH = 6;
const PENDING_KEY = 'medicard.referral.pendingCode.v1';

export function normalizeReferralCode(raw: unknown): string | null {
  const code = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === REFERRAL_CODE_LENGTH && [...code].every((c) => REFERRAL_CODE_ALPHABET.includes(c)) ? code : null;
}

/** A code from an invite link, kept until the person enters it (links can arrive before sign-in). */
export async function savePendingReferralCode(raw: unknown): Promise<void> {
  const code = normalizeReferralCode(raw);
  if (code) await setPreference(PENDING_KEY, code);
}

export async function readPendingReferralCode(): Promise<string | null> {
  return normalizeReferralCode(await getPreference(PENDING_KEY));
}

export async function clearPendingReferralCode(): Promise<void> {
  await setPreference(PENDING_KEY, '');
}

export type ReferralInvitee = { name: string; at: string; status: string; coins: number };

export type ReferralSummary = {
  code: string | null;
  link: string | null;
  phoneRequired: boolean;
  coinsPerSide: number;
  monthlyCap: number;
  claimWindowDays?: number;
  invited: number;
  invitedThisMonth?: number;
  pending: number;
  rewarded: number;
  coinsEarned: number;
  monthRemaining: number;
  invitees?: ReferralInvitee[];
  invitedBy: { status: string; name?: string } | null;
  canClaim: boolean;
};

export type ReferralClaimResult = { ok: true; status: string; coins?: number; balance?: number | null; inviter?: string };

export function referralShareMessage(code: string, link: string, coins: number): string {
  return tx(
    `შემოდი MEDICARD-ში — წამლები, ანალიზები და ჯანმრთელობა ერთ აპში. რეგისტრაციის შემდეგ გახსენი პროფილი → „მოიწვიე მეგობარი“ → „მოწვევის კოდი მაქვს“ და შეიყვანე ჩემი კოდი ${code} — ორივე მაშინვე მივიღებთ ${coins} Medi მონეტას.\n${link}`,
    `Join me on MEDICARD — medications, lab results and your health in one app. After you sign up, open Profile → “Invite a friend” → “I have an invite code” and enter my code ${code} — we both get ${coins} Medi Coins right away.\n${link}`,
  );
}
