import { getPreference, setPreference } from './storage';
import { tx } from '../i18n/locale.js';

/**
 * „ვინ მოგიწვია?“ codes. Friends' codes use the safe alphabet (server/src/lib/referral.js); influencer codes
 * (medicard.ge/promo) may use any Latin letter and 2–9. What a person types is read like the server does:
 * upper case, 0 → O and 1 → I (they look alike on a screen).
 */
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_LENGTH = 6;
const PENDING_KEY = 'medicard.referral.pendingCode.v1';

export function normalizeReferralCode(raw: unknown): string | null {
  const code = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/0/g, 'O').replace(/1/g, 'I');
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
  /** Days after sign-up an influencer code can still be entered (admin setting, server 2026-10-17+). */
  influencerWindowDays?: number | null;
  invited: number;
  invitedThisMonth?: number;
  pending: number;
  rewarded: number;
  coinsEarned: number;
  monthRemaining: number;
  invitees?: ReferralInvitee[];
  invitedBy: {
    status: string;
    name?: string;
    kind?: 'friend' | 'influencer';
    /** When the code was entered (server 2026-10-17+). */
    at?: string;
    /** Medi coins this account got for the code. */
    coins?: number;
    /** Public photo of an approved influencer, relative to the API. */
    photoPath?: string | null;
  } | null;
  /** Last moment an influencer code / a friend's code can be entered (server 2026-10-17+). */
  enterUntil?: string | null;
  friendUntil?: string | null;
  canClaim: boolean;
};

export type ReferralClaimResult = { ok: true; kind?: 'influencer'; status: string; coins?: number; balance?: number | null; inviter?: string };

export function referralShareMessage(code: string, link: string, coins: number): string {
  return tx(
    `შემოდი MEDICARD-ში — წამლები, ანალიზები და ჯანმრთელობა ერთ აპში. რეგისტრაციის შემდეგ გახსენი პროფილი → „ვინ მოგიწვია?“ და შეიყვანე ჩემი კოდი ${code} — ორივე მაშინვე მივიღებთ ${coins} Medi მონეტას.\n${link}`,
    `Join me on MEDICARD — medications, lab results and your health in one app. After you sign up, open Profile → “Who invited you?” and enter my code ${code} — we both get ${coins} Medi Coins right away.\n${link}`,
  );
}
