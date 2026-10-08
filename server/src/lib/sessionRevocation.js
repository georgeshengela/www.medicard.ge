/**
 * A password reset ends every older session of the account. Before this, requireAuth checked only
 * the JWT signature and expiry, so a token left on a lost phone or a shared browser kept working
 * for up to 30 days after the person reset the password precisely to lock that device out.
 *
 * The reset writes "User"."passwordChangedAt" (raw SQL; the Prisma field is @ignore, so User
 * queries keep working before db:install adds the column) and requireAuth refuses a token signed
 * before that moment. Everything fails open — no column yet, no value (accounts that have not
 * reset since this shipped), a token without `iat` or a failed read: the token is judged exactly
 * as before, so this can never sign everyone out at once.
 */
import { prisma } from './prisma.js';

/**
 * Tolerance between the reset and a token's `iat`. `iat` is floored to whole seconds and
 * instances' clocks drift a little, so the token the SMS reset hands out right after writing the
 * timestamp (or a sign-in a moment later on another instance) must never count as older.
 */
export const PASSWORD_CHANGE_SKEW_MS = 5_000;

function timeOf(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

/** True only when the token was clearly signed before the last password change. */
export function tokenPredatesPasswordChange(claims, passwordChangedAt, skewMs = PASSWORD_CHANGE_SKEW_MS) {
  const changedMs = timeOf(passwordChangedAt);
  if (!Number.isFinite(changedMs)) return false;
  const iat = claims?.iat;
  if (typeof iat !== 'number' || !Number.isFinite(iat)) return false;
  return iat * 1000 < changedMs - skewMs;
}

let readWarned = false;

/** The account's last password change, or null (never reset, column not installed, read failed). */
export async function readPasswordChangedAt(userId, db = prisma) {
  try {
    const rows = await db.$queryRaw`SELECT "passwordChangedAt" FROM "User" WHERE "id" = ${String(userId)}`;
    const value = rows?.[0]?.passwordChangedAt ?? null;
    return Number.isFinite(timeOf(value)) ? new Date(timeOf(value)) : null;
  } catch (error) {
    // Once per process: before db:install every request lands here.
    if (!readWarned) {
      readWarned = true;
      console.warn('[auth] passwordChangedAt unreadable; sessions are not checked against password resets', error?.code || error?.message);
    }
    return null;
  }
}

/**
 * Records a password reset. Call after the new password is committed and before signing the
 * token the resetting device gets. Never fails the reset: without the column it logs and the
 * older sessions stay valid, exactly as before this shipped.
 */
export async function markPasswordChanged(userId, at = new Date(), db = prisma) {
  try {
    await db.$executeRaw`UPDATE "User" SET "passwordChangedAt" = ${at} WHERE "id" = ${String(userId)}`;
    return true;
  } catch (error) {
    console.warn('[auth] password change not recorded; older sessions stay valid', error?.code || error?.message);
    return false;
  }
}
