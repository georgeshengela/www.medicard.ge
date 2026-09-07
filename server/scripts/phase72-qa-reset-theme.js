/**
 * Controlled QA-only: clear MEDI_THEME_7D redemption so Phase 7.2 prod redeem can run.
 * Does NOT touch other users. Keeps coin ledger as-is (already spent).
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

const PHONE = process.argv[2] || '+995500000005';
const user = await prisma.user.findFirst({ where: { phone: PHONE } });
if (!user) {
  console.error('USER_NOT_FOUND');
  process.exit(1);
}
const theme = await prisma.rewardDefinition.findFirst({ where: { key: 'MEDI_THEME_7D' } });
const reds = await prisma.rewardRedemption.findMany({
  where: { userId: user.id, rewardId: theme.id },
});
for (const row of reds) {
  await prisma.userRewardEntitlement.deleteMany({ where: { rewardRedemptionId: row.id } });
  await prisma.rewardRedemptionAudit.deleteMany({ where: { redemptionId: row.id } });
  await prisma.rewardCode.updateMany({
    where: { reservedByRedemptionId: row.id },
    data: { reservedByRedemptionId: null, reservedAt: null, status: 'AVAILABLE' },
  });
  await prisma.rewardRedemption.delete({ where: { id: row.id } });
}
console.log(JSON.stringify({ ok: true, phone: PHONE, clearedThemeRedemptions: reds.length }));
await prisma.$disconnect();
