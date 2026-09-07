import { prisma } from '../src/lib/prisma.js';

async function check(name, fn) {
  try {
    const n = await fn();
    console.log(`${name}:OK count=${n}`);
  } catch (e) {
    console.log(`${name}:FAIL ${e.message}`);
  }
}

await check('RewardDefinition', () => prisma.rewardDefinition.count());
await check('AchievementDefinition', () => prisma.achievementDefinition.count());
await prisma.$disconnect();
