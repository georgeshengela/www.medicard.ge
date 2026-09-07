import { PrismaClient } from '@prisma/client';
import { ensureAchievementDefinitions } from '../src/lib/achievementDefs.js';

const p = new PrismaClient();
const result = await ensureAchievementDefinitions(p);
const rows = await p.achievementDefinition.findMany({
  select: { key: true, rarity: true, threshold: true, rewardXp: true, rewardCoins: true, isSecret: true },
  orderBy: { sortOrder: 'asc' },
});
console.log(JSON.stringify({ upserted: result.upserted, total: rows.length }, null, 2));
for (const row of rows) {
  console.log(`${row.key}\t${row.rarity}\t${row.threshold}\t${row.rewardXp} XP\t${row.rewardCoins} coins${row.isSecret ? '\tSECRET' : ''}`);
}
await p.$disconnect();
