import { prisma } from './prisma.js';
import { revokeCycleShares } from './cycleLifecycle.js';
import { unlinkStoredUpload } from './privateUploads.js';
import { coachFilesOf } from './trainerStore.js';
import { getUserLanguage, t } from './i18n.js';
import { revokeAppleGrantsForUser } from './socialAuth.js';
import { phoneLookupValues } from './phoneUsers.js';
import { SMS_DESTINATION_DELETED, smsDestinationHash } from './sms.js';

export const SMS_LOG_REDACTED_CONTENT = '[redacted]';

/**
 * Audit rows stay, but OTP / message bodies must not survive account deletion. The row's number
 * becomes a keyed hash of it (smsDestinationHash: unreadable, but the per-number daily SMS-code cap
 * still counts it, so deleting the account never resets that cap); without a number, „[deleted]“.
 */
export function smsLogAccountDeletePatch(destination) {
  return { userId: null, content: SMS_LOG_REDACTED_CONTENT, destination: smsDestinationHash(destination) ?? SMS_DESTINATION_DELETED, reference: null, providerMsg: null };
}

/**
 * Rows about this person's number. Sign-in codes are written before the account exists, so they
 * carry userId null and the number as SMS digits ('9955…') while User.phone reads '+9955…':
 * match every stored spelling. Rows of another account (another userId) are never touched.
 */
export function accountPhoneRowsWhere(userId, phone) {
  const numbers = phone ? phoneLookupValues(phone) : [];
  return {
    phoneVerification: { OR: [{ userId }, ...(numbers.length ? [{ userId: null, phone: { in: numbers } }] : [])] },
    smsLog: { OR: [{ userId }, ...(numbers.length ? [{ userId: null, destination: { in: numbers } }] : [])] },
  };
}

/**
 * Raw-SQL tables keyed by the person's "userId" with no foreign key to "User" on the main database,
 * so nothing cascades (schema.prisma may still say onDelete: Cascade — the table was created lazily
 * without it). Every row is the person's own; they go in the account's delete transaction. Hunt* are
 * the retired Medi Hunt tables: no code writes them any more, but the main database still has them.
 * deleteUser.test.js fails when a new raw table with "userId" and no foreign key is missing here.
 */
export const UNLINKED_USER_TABLES = Object.freeze([
  'MedicationDoseEvent', 'NotificationPermission', 'NotificationDecision', 'NotificationOutcome',
  'ProductEvent', 'AppActivity', 'AnnouncementReceipt', 'MedirunWaveAlert', 'UserLocation', 'EmailVerification',
  'HuntCapture', 'HuntSuspicious', 'HuntSession', 'HuntProgress', 'HuntQaGrant',
]);

/**
 * Permanently remove a user and orphaned rows that are not FK-cascaded.
 * Keeps SmsLog rows but clears userId and redacts content for audit trail.
 */
export async function deleteUserAccount(userId, lang = 'ka') {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      _count: {
        select: { records: true, chats: true, medications: true },
      },
    },
  });

  if (!user) {
    return { ok: false, status: 404, error: t(lang, 'მომხმარებელი ვერ მოიძებნა.', 'User not found.') };
  }

  // Read before the row goes: the account-deleted email is written in the person's language.
  const language = await getUserLanguage(userId);

  await revokeCycleShares(prisma, userId);

  const uploadRows = await prisma.medicalRecord.findMany({
    where: { userId, imageUrl: { not: null } },
    select: { imageUrl: true },
  });

  let petPhotos = [];
  try {
    petPhotos = await prisma.pet.findMany({
      where: { userId, photoUrl: { not: null } },
      select: { photoUrl: true },
    });
  } catch (error) {
    if (!(error?.code === 'P2021' || /does not exist/i.test(error?.message || ''))) throw error;
  }

  // Progress photos and trainer certificates cascade with the user row; their files are removed after.
  const coachFiles = await coachFilesOf(userId).catch(() => []);

  // Sign in with Apple: revoke the grant before the row (and its stored token) goes — App Review 5.1.1(v).
  // Best-effort: a failed revoke never keeps an account the person asked to delete.
  await revokeAppleGrantsForUser(userId);

  // Lazily created tables may not exist yet; a table that is not there holds nobody's rows.
  const presentRows = await prisma.$queryRaw`SELECT name FROM unnest(${[...UNLINKED_USER_TABLES]}::text[]) AS name WHERE to_regclass(format('%I', name)) IS NOT NULL`;
  const present = new Set(presentRows.map((row) => row.name));
  // A trainer keeps session rows about a deleted client (clientId → NULL); their notes about that person go.
  const sessionTable = await prisma.$queryRaw`SELECT to_regclass('"TrainerSession"')::text AS name`;
  const phoneRows = accountPhoneRowsWhere(userId, user.phone);
  // Each row's number gets its own hash: a link code may have gone to another number than User.phone.
  const smsNumbers = await prisma.smsLog.findMany({ where: phoneRows.smsLog, select: { destination: true }, distinct: ['destination'] });
  await prisma.$transaction([
    // Table names come from the constant list above, never from input.
    ...UNLINKED_USER_TABLES.filter((name) => present.has(name))
      .map((name) => prisma.$executeRawUnsafe(`DELETE FROM "${name}" WHERE "userId" = $1`, userId)),
    ...(sessionTable[0]?.name ? [prisma.$executeRaw`UPDATE "TrainerSession" SET note = NULL WHERE "clientId" = ${userId}`] : []),
    prisma.dailyUsage.deleteMany({ where: { userId } }),
    prisma.phoneVerification.deleteMany({ where: phoneRows.phoneVerification }),
    ...smsNumbers.map(({ destination }) =>
      prisma.smsLog.updateMany({ where: { AND: [phoneRows.smsLog, { destination }] }, data: smsLogAccountDeletePatch(destination) }),
    ),
    // A row written after the read above (no userId/number left on it either way).
    prisma.smsLog.updateMany({ where: phoneRows.smsLog, data: smsLogAccountDeletePatch() }),
    prisma.aiEvalResult.deleteMany({ where: { interaction: { userId } } }),
    prisma.pushEvent.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  await Promise.all([
    ...uploadRows.map((row) => unlinkStoredUpload(row.imageUrl)),
    ...petPhotos.map((row) => unlinkStoredUpload(row.photoUrl)),
    ...coachFiles.map((key) => unlinkStoredUpload(key)),
  ]);

  return {
    ok: true,
    deleted: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      language,
      counts: user._count,
    },
  };
}
