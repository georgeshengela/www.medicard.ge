import { prisma } from './prisma.js';
import { revokeCycleShares } from './cycleLifecycle.js';
import { unlinkStoredUpload } from './privateUploads.js';

export const SMS_LOG_REDACTED_CONTENT = '[redacted]';

/** Audit rows stay, but OTP / message bodies must not survive account deletion. */
export function smsLogAccountDeletePatch() {
  return { userId: null, content: SMS_LOG_REDACTED_CONTENT, destination: '[deleted]', reference: null, providerMsg: null };
}

/**
 * Permanently remove a user and orphaned rows that are not FK-cascaded.
 * Keeps SmsLog rows but clears userId and redacts content for audit trail.
 */
export async function deleteUserAccount(userId) {
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
    return { ok: false, status: 404, error: 'მომხმარებელი ვერ მოიძებნა.' };
  }

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

  const locationTable = await prisma.$queryRaw`SELECT to_regclass('"UserLocation"')::text AS name`;
  await prisma.$transaction([
    ...(locationTable[0]?.name ? [prisma.$executeRaw`DELETE FROM "UserLocation" WHERE "userId" = ${userId}`] : []),
    prisma.dailyUsage.deleteMany({ where: { userId } }),
    prisma.phoneVerification.deleteMany({ where: { OR: [{ userId }, ...(user.phone ? [{ userId: null, phone: user.phone }] : [])] } }),
    prisma.smsLog.updateMany({ where: { OR: [{ userId }, ...(user.phone ? [{ userId: null, destination: user.phone }] : [])] }, data: smsLogAccountDeletePatch() }),
    prisma.aiEvalResult.deleteMany({ where: { interaction: { userId } } }),
    prisma.pushEvent.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  await Promise.all([
    ...uploadRows.map((row) => unlinkStoredUpload(row.imageUrl)),
    ...petPhotos.map((row) => unlinkStoredUpload(row.photoUrl)),
  ]);

  return {
    ok: true,
    deleted: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      counts: user._count,
    },
  };
}
