import { PrismaClient } from '@prisma/client';
import { processWorldActivity } from '../../server/src/lib/mediWorld/engine.js';
import { getGarden } from '../../server/src/lib/mediWorld/garden/service.js';
import { writeFileSync } from 'node:fs';

const url = process.env.DATABASE_URL || 'postgresql://phase38@127.0.0.1:54329/medicard_phase38';
const userId = '34dfd803-541f-49b2-9b23-b1be8997ffb5';
const db = new PrismaClient({ datasources: { db: { url } } });
const now = new Date('2026-09-15T12:00:00.000Z');
const opts = { db, now, timezone: 'UTC', flags: { nodeEnv: 'development', flag: '1', gardenFlag: '1' }, user: { timezone: 'UTC' } };

const credit = await processWorldActivity(
  userId,
  {
    sourceType: 'QUEST_COMPLETION',
    sourceId: `live-nurture-${Date.now()}`,
    idempotencyKey: `live-nurture-${Date.now()}`,
    adapterId: 'quest.daily_steps',
    energyType: 'movement',
    progressState: 'verified',
    personalTarget: 1500,
    completedAmount: 1500,
  },
  opts,
);
const garden = await getGarden(userId, opts);
writeFileSync('qa/medi-world-phase44/live-nurture.json', JSON.stringify({
  energyAmount: credit.reward?.energyAmount,
  sourceType: 'QUEST_COMPLETION',
  plant: garden.plots[0].plant,
  atmosphere: garden.atmosphere,
}, null, 2));
console.log({ energyAmount: credit.reward?.energyAmount, stage: garden.plots[0].plant?.stage, days: garden.plots[0].plant?.nurtureDays });
await db.$disconnect();
