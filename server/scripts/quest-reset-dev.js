/**
 * Pre-launch Quest wipe. NEVER runs automatically. Not imported by server.js.
 *
 *   QUEST_RESET_DEV=1 npm run quest:reset-dev
 *
 * Use this to drop legacy UserQuest rows that still carry old frozen targets
 * (8000 / 2000 / 50000) before public launch.
 *
 * Refuses production unless QUEST_RESET_ALLOW_PROD=YES_I_MEAN_IT.
 * Deletes UserQuest, QuestCompletion, QUEST RewardLedger rows, and resets
 * UserQuestProfile caches. Does not delete QuestTemplate or HydrationPreference.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const env = process.env.NODE_ENV || 'development';
if (env === 'production' && process.env.QUEST_RESET_ALLOW_PROD !== 'YES_I_MEAN_IT') {
  console.error('Refusing quest:reset-dev in production. Set QUEST_RESET_ALLOW_PROD=YES_I_MEAN_IT if you really mean it.');
  process.exit(2);
}
if (process.env.QUEST_RESET_DEV !== '1') {
  console.error('Refusing quest:reset-dev. Set QUEST_RESET_DEV=1 to confirm.');
  process.exit(2);
}

const prisma = new PrismaClient();

async function main() {
  const [completions, quests, ledger, profiles] = await prisma.$transaction([
    prisma.questCompletion.deleteMany({}),
    prisma.userQuest.deleteMany({}),
    prisma.rewardLedger.deleteMany({ where: { sourceType: 'QUEST' } }),
    prisma.userQuestProfile.updateMany({
      data: {
        currentLevel: 1,
        totalXp: 0,
        cachedCoinBalance: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveQuestDate: null,
        lastDailyAssignPeriodKey: null,
        lastDailyAssignAt: null,
      },
    }),
  ]);
  console.log('Quest dev reset complete.', {
    completions: completions.count,
    userQuests: quests.count,
    ledger: ledger.count,
    profilesReset: profiles.count,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
