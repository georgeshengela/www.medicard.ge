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
  {
    key: 'weekly_medi',
    category: 'MEDI',
    cadence: 'WEEKLY',
    titleKey: 'quest.weekly_medi.title',
    descriptionKey: 'quest.weekly_medi.description',
    // One Medi consultation on any day of the ISO week; the progress type keeps its historical name.
    progressType: 'MEDI_DAILY_USE',
    defaultTarget: 1,
    rewardCoins: 0,
    rewardXp: 20,
    priority: 40,
    isActive: true,
    config: { source: 'medi_use', window: 'iso_week', countsForDailyStreak: false, requiresAiConsent: true },
  },
]);

/**
 * Templates the owner retired. The seed never recreates them; an existing row is switched off and
 * pays no Medi Coins, even after an admin edit (rows already assigned keep their history).
 * daily_medi (owner 2026-10-08): a Medi conversation no longer pays Medi Coins or carries the daily
 * streak — weekly_medi replaces it. A new key rather than a cadence flip, because journey units,
 * WEEKLY achievements and the dashboard buckets read a row's cadence from its template: flipping
 * daily_medi would have turned every past daily Medi completion into a weekly one.
 */
export const RETIRED_QUEST_TEMPLATES = Object.freeze({
  daily_medi: Object.freeze({ isActive: false, rewardCoins: 0, config: { countsForDailyStreak: false, retired: true } }),
});

/**
 * Owner rules that win over the admin console (config.adminManaged) on every seed and in the admin
 * PATCH: the Medi mission is weekly, pays no Medi Coins (XP only) and never counts for the daily
 * streak; it is offered only after AI consent (quest.js isTemplateEligible).
 */
export const LOCKED_QUEST_TEMPLATE_FIELDS = Object.freeze({
  weekly_medi: Object.freeze({ cadence: 'WEEKLY', rewardCoins: 0, config: { countsForDailyStreak: false, requiresAiConsent: true } }),
  ...RETIRED_QUEST_TEMPLATES,
});

/** Locked scalar fields of a template (admin PATCH refuses other values), or null. */
export function lockedQuestTemplateFields(key) {
  const locked = LOCKED_QUEST_TEMPLATE_FIELDS[key];
  if (!locked) return null;
  const { config: _config, ...fields } = locked;
  return fields;
}

function withLockedFields(key, data) {
  const locked = LOCKED_QUEST_TEMPLATE_FIELDS[key];
  if (!locked) return data;
  const { config, ...fields } = locked;
  return { ...data, ...fields, config: { ...(data.config || {}), ...config } };
}

function satisfiesLock(row, key) {
  const locked = LOCKED_QUEST_TEMPLATE_FIELDS[key];
  if (!row || !locked) return true;
  const { config, ...fields } = locked;
  return Object.entries(fields).every(([field, value]) => row[field] === value)
    && Object.entries(config).every(([field, value]) => row.config?.[field] === value);
}

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
  const canRead = typeof db.questTemplate.findUnique === 'function';
  for (const template of INITIAL_QUEST_TEMPLATES) {
    assertTemplateEconomy(template);
    // Once an admin edits a template (config.adminManaged), its target, rewards and
    // priority belong to the admin console — the seed only keeps structure in sync
    // (and the owner's locked fields, which no admin edit overrides).
    const existing = canRead ? await db.questTemplate.findUnique({ where: { key: template.key } }) : null;
    const adminManaged = existing?.config?.adminManaged === true;
    await db.questTemplate.upsert({
      where: { key: template.key },
      create: template,
      update: withLockedFields(template.key, {
        category: template.category,
        cadence: template.cadence,
        titleKey: template.titleKey,
        descriptionKey: template.descriptionKey,
        progressType: template.progressType,
        ...(adminManaged
          ? { config: { ...template.config, ...existing.config, adminManaged: true } }
          : {
            defaultTarget: template.defaultTarget,
            rewardCoins: template.rewardCoins,
            rewardXp: template.rewardXp,
            priority: template.priority,
            config: template.config,
          }),
      }),
    });
    upserted += 1;
  }
  for (const key of Object.keys(RETIRED_QUEST_TEMPLATES)) {
    if (!canRead || typeof db.questTemplate.update !== 'function') break;
    const existing = await db.questTemplate.findUnique({ where: { key } });
    if (!existing || satisfiesLock(existing, key)) continue;
    await db.questTemplate.update({ where: { key }, data: withLockedFields(key, { config: existing.config || {} }) });
  }
  return { upserted };
}
