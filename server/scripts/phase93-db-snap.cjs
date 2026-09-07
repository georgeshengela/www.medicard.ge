const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const u = await p.user.findFirst({ where: { phone: '+995500000005' } });
  const pr = await p.mediCompanionProfile.findUnique({ where: { userId: u.id } });
  const unlocks = await p.mediJourneyUnlock.findMany({
    where: { userId: u.id },
    orderBy: { unlockedAt: 'desc' },
    take: 4,
  });
  console.log(
    JSON.stringify(
      {
        equipment: pr.selectedCosmetics,
        latestUnlocks: unlocks.map((x) => ({ k: x.milestoneKey, at: x.unlockedAt })),
      },
      null,
      2,
    ),
  );
  await p.$disconnect();
})();
