import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';

const partner = await prisma.rewardPartner.findFirst({ where: { key: 'MEDI_PHARMACY_DEMO' } });
if (partner) {
  const rewards = await prisma.rewardDefinition.findMany({ where: { partnerId: partner.id } });
  for (const r of rewards) {
    await prisma.userRewardEntitlement.deleteMany({ where: { redemption: { rewardId: r.id } } });
    await prisma.rewardRedemptionAudit.deleteMany({ where: { rewardId: r.id } });
    await prisma.rewardRedemption.deleteMany({ where: { rewardId: r.id } });
    await prisma.rewardCode.deleteMany({ where: { rewardId: r.id } });
    await prisma.rewardCampaign.deleteMany({ where: { rewardDefinitionId: r.id } });
    await prisma.rewardInventoryAdjustment.deleteMany({ where: { rewardId: r.id } });
    await prisma.rewardDefinition.delete({ where: { id: r.id } });
  }
  await prisma.rewardCampaign.deleteMany({ where: { partnerId: partner.id } });
  await prisma.rewardPartner.delete({ where: { id: partner.id } });
  console.log('removed DEV partner fixture');
} else {
  console.log('no demo partner');
}
console.log({
  partners: await prisma.rewardPartner.count(),
  campaigns: await prisma.rewardCampaign.count(),
  activeFP: await prisma.rewardDefinition.count({
    where: { status: 'ACTIVE', key: { in: ['MEDI_THEME_7D', 'MEDI_PROFILE_STYLE_30D'] } },
  }),
});
await prisma.$disconnect();
