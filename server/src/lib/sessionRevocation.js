/**
 * A password reset ends every older session of the account. Before this, requireAuth checked only
 * the JWT signature and expiry, so a token left on a lost phone or a shared browser kept working
 * for up to 30 days after the person reset the password precisely to lock that device out.
 *
 * The reset writes "User"."passwordChangedAt" (raw SQL; the Prisma field is @ignore, so User
 * queries keep working before db:install adds the column) and requireAuth refuses a token signed
 * before that moment. Everything fails open — no column yet, no value (accounts that have not
 * reset since this shipped), a token without `iat` or a failed read: the token is judged exactly
 * as before, so this can never sign everyone out at once. The reset also switches off the
 * account's push tokens (markPasswordChanged), so the locked-out phone stops receiving her pushes.
 */
import { prisma } from './prisma.js';

/**
 * Tolerance between the reset and a token's `iat`. `iat` is floored to whole seconds and
 * instances' clocks drift a little, so the token the SMS reset hands out right after writing the
 * timestamp (or a sign-in a moment later on another instance) must never count as older.
 */
export const PASSWORD_CHANGE_SKEW_MS = 5_000;

/**
 * Claim of a token GET /api/auth/me renewed: the passwordChangedAt (epoch ms, 0 = none) requireAuth
 * read for that request. A reset that commits while /me runs (or within the skew before it) would
 * otherwise get a renewal whose fresh `iat` outlives it; with the claim, any later change ends the
 * renewed session — compared exactly, no skew. Tokens without it (sign-ins, older renewals) keep the
 * `iat` rule.
 */
export const PASSWORD_CHANGE_CLAIM = 'pwc';

function timeOf(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

/** True only when the token was clearly signed before the last password change. */
export function tokenPredatesPasswordChange(claims, passwordChangedAt, skewMs = PASSWORD_CHANGE_SKEW_MS) {
  const changedMs = timeOf(passwordChangedAt);
  if (!Number.isFinite(changedMs)) return false;
  const seen = claims?.[PASSWORD_CHANGE_CLAIM];
  if (typeof seen === 'number' && Number.isFinite(seen)) return seen < changedMs;
  const iat = claims?.iat;
  if (typeof iat !== 'number' || !Number.isFinite(iat)) return false;
  return iat * 1000 < changedMs - skewMs;
}

let readWarned = false;

/**
 * The account's last password change: `{ known: true, at }` (`at` null = never reset) when it was
 * read, `{ known: false, at: null }` when it could not be (column not installed, read failed).
 */
export async function readPasswordChange(userId, db = prisma) {
  try {
    const rows = await db.$queryRaw`SELECT "passwordChangedAt" FROM "User" WHERE "id" = ${String(userId)}`;
    if (!rows?.length) return { known: false, at: null };
    const value = rows[0]?.passwordChangedAt ?? null;
    if (value === null) return { known: true, at: null };
    return Number.isFinite(timeOf(value)) ? { known: true, at: new Date(timeOf(value)) } : { known: false, at: null };
  } catch (error) {
    // Once per process: before db:install every request lands here.
    if (!readWarned) {
      readWarned = true;
      console.warn('[auth] passwordChangedAt unreadable; sessions are not checked against password resets', error?.code || error?.message);
    }
    return { known: false, at: null };
  }
}

/** The account's last password change, or null (never reset, column not installed, read failed). */
export async function readPasswordChangedAt(userId, db = prisma) {
  return (await readPasswordChange(userId, db)).at;
}

/**
 * Extra claim for a token renewed under `change` (readPasswordChange of the renewing request).
 * Nothing when it could not be read: that token keeps the `iat` rule, exactly as before, so a failed
 * read never stamps a value that would later end a valid session.
 */
export function passwordChangeClaim(change) {
  if (!change?.known) return {};
  return { [PASSWORD_CHANGE_CLAIM]: change.at ? change.at.getTime() : 0 };
}

/**
 * Records a password reset. Call after the new password is committed and before signing the
 * token the resetting device gets. Never fails the reset: without the column it logs and the
 * older sessions stay valid, exactly as before this shipped.
 *
 * Once recorded, the account's push tokens are switched off too: a phone whose session just ended
 * cannot unregister itself (DELETE /api/push/register needs a session), so it kept receiving her
 * pushes. Every device registers again when it signs in (syncPushRegistration after sign-in), the
 * resetting one right after the reset.
 */
export async function markPasswordChanged(userId, at = new Date(), db = prisma) {
  try {
    await db.$executeRaw`UPDATE "User" SET "passwordChangedAt" = ${at} WHERE "id" = ${String(userId)}`;
    try {
      await db.pushToken.updateMany({ where: { userId: String(userId), active: true }, data: { active: false } });
    } catch (error) {
      console.warn('[auth] push tokens not switched off after a password change', error?.code || error?.message);
    }
    return true;
  } catch (error) {
    console.warn('[auth] password change not recorded; older sessions stay valid', error?.code || error?.message);
    return false;
  }
}
