import { validateQuestRewardAmounts } from './questEconomy.js';

/** Controlled Phase 1.1 template set — game defaults, not medical advice. */
export const INITIAL_QUEST_TEMPLATES = Object.freeze([
  {
    key: 'daily_steps',
    category: 'MOVEMENT',
    cadence: 'DAILY',
    titleKey: 'quest.daily_steps.title',
    descriptionKey: 'quest.daily_steps.description',
    progressType: 'STEPS',
    defaultTarget: 5000,
    rewardCoins: 30,
    rewardXp: 50,
    priority: 10,
    isActive: true,
    config: { metric: 'steps', countsForDailyStreak: true },
  },
  {
    key: 'daily_hydration',
    category: 'HYDRATION',
    cadence: 'DAILY',
    titleKey: 'quest.daily_hydration.title',
    descriptionKey: 'quest.daily_hydration.description',
    progressType: 'HYDRATION_GOAL_PERCENT',
    defaultTarget: 100,
    rewardCoins: 20,
    rewardXp: 35,
    priority: 20,
    isActive: true,
    config: { metric: 'hydrationGoalPercent', countsForDailyStreak: true },
  },
  {
    key: 'daily_medi',
    category: 'MEDI',
    cadence: 'DAILY',
    titleKey: 'quest.daily_medi.title',
    descriptionKey: 'quest.daily_medi.description',
    progressType: 'MEDI_DAILY_USE',
    defaultTarget: 1,
    rewardCoins: 10,
    rewardXp: 20,
    priority: 5,
    isActive: true,
    config: { source: 'medi_daily_use', countsForDailyStreak: true },
  },
  {
    key: 'weekly_steps',
    category: 'MOVEMENT',
    cadence: 'WEEKLY',
    titleKey: 'quest.weekly_steps.title',
    descriptionKey: 'quest.weekly_steps.description',
    progressType: 'STEPS',
    defaultTarget: 35_000,
    rewardCoins: 150,
    rewardXp: 200,
    priority: 30,
    isActive: true,
    config: { metric: 'steps', window: 'iso_week', countsForDailyStreak: false },
  },
]);

export function countsForDailyStreak(template) {
  const flag = template?.config?.countsForDailyStreak;
  if (flag === true) return true;
  if (flag === false) return false;
  return template?.cadence === 'DAILY';
}

export function assertTemplateEconomy(template) {
  validateQuestRewardAmounts({
    cadence: template.cadence,
    rewardXp: template.rewardXp,
    rewardCoins: template.rewardCoins,
  });
  return template;
}

export async function ensureQuestTemplates(db) {
  if (typeof db?.questTemplate?.upsert !== 'function') return { upserted: 0 };
  let upserted = 0;
  for (const template of INITIAL_QUEST_TEMPLATES) {
    assertTemplateEconomy(template);
    await db.questTemplate.upsert({
      where: { key: template.key },
      create: template,
      update: {
        category: template.category,
        cadence: template.cadence,
        titleKey: template.titleKey,
        descriptionKey: template.descriptionKey,
        progressType: template.progressType,
        defaultTarget: template.defaultTarget,
        rewardCoins: template.rewardCoins,
        rewardXp: template.rewardXp,
        priority: template.priority,
        config: template.config,
      },
    });
    upserted += 1;
  }
  return { upserted };
}
