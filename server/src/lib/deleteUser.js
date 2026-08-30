import { prisma } from './prisma.js';
import { revokeCycleShares } from './cycleLifecycle.js';

/**
 * Permanently remove a user and orphaned rows that are not FK-cascaded.
 * Keeps SmsLog rows but clears userId for audit trail.
 */
export async function deleteUserAccount(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      _count: {
        select: { records: true, chats: true, medications: true },
      },
    },
  });

  if (!user) {
    return { ok: false, status: 404, error: 'მომხმარებელი ვერ მოიძებნა.' };
  }

  await revokeCycleShares(prisma, userId);

  await prisma.$transaction([
    prisma.dailyUsage.deleteMany({ where: { userId } }),
    prisma.phoneVerification.deleteMany({ where: { userId } }),
    prisma.smsLog.updateMany({ where: { userId }, data: { userId: null } }),
    prisma.user.delete({ where: { id: userId } }),
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
