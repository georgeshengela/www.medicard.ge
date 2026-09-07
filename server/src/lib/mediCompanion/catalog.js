/**
 * Phase 9 / 9.1 — Medi Companion catalogs.
 * Every ACTIVE cosmetic must have a visualKey with a real renderer (see visualRegistry).
 */

export const COMPANION_STAGES = Object.freeze([
  { key: 'STAGE_1', minLevel: 1, maxLevel: 4 },
  { key: 'STAGE_2', minLevel: 5, maxLevel: 9 },
  { key: 'STAGE_3', minLevel: 10, maxLevel: 19 },
  { key: 'STAGE_4', minLevel: 20, maxLevel: 29 },
  { key: 'STAGE_5', minLevel: 30, maxLevel: 39 },
  { key: 'STAGE_6', minLevel: 40, maxLevel: 49 },
  { key: 'STAGE_7', minLevel: 50, maxLevel: null },
]);

export const COMPANION_MOODS = Object.freeze([
  'CALM', 'CHEERFUL', 'PROUD', 'CURIOUS', 'FOCUSED', 'RESTING', 'EXCITED', 'WELCOME_BACK',
]);

export const COMPANION_EQUIP_SLOTS = Object.freeze(['accent', 'accessory', 'background', 'decoration']);

export const COSMETIC_TYPES = Object.freeze([
  'COMPANION_ACCENT',
  'COMPANION_BADGE',
  'COMPANION_POSE',
  'HOME_DECORATION',
  'HOME_BACKGROUND',
  'COMPANION_ACCESSORY',
]);

export const COSMETIC_STYLE_TIERS = Object.freeze(['COMMON', 'SPECIAL', 'PREMIUM', 'LEGACY']);

export const JOURNEY_THRESHOLDS = Object.freeze([
  1, 3, 5, 8, 12, 17, 23, 30, 38, 47, 57, 68, 80, 93, 107, 122, 138, 155, 173, 192, 212, 233, 255, 278, 302,
]);

export const JOURNEY_CHAPTERS = Object.freeze([
  { key: 'CHAPTER_1', titleKey: 'companion.journey.chapter.1', milestoneCount: 5 },
  { key: 'CHAPTER_2', titleKey: 'companion.journey.chapter.2', milestoneCount: 5 },
  { key: 'CHAPTER_3', titleKey: 'companion.journey.chapter.3', milestoneCount: 5 },
  { key: 'CHAPTER_4', titleKey: 'companion.journey.chapter.4', milestoneCount: 5 },
  { key: 'CHAPTER_5', titleKey: 'companion.journey.chapter.5', milestoneCount: 5 },
]);

function buildMilestones() {
  const out = [];
  for (let i = 0; i < JOURNEY_THRESHOLDS.length; i += 1) {
    const chapterIndex = Math.floor(i / 5);
    const chapter = JOURNEY_CHAPTERS[chapterIndex];
    const indexInChapter = (i % 5) + 1;
    const key = `MILESTONE_${String(i + 1).padStart(2, '0')}`;
    out.push({
      key,
      index: i + 1,
      at: JOURNEY_THRESHOLDS[i],
      chapterKey: chapter.key,
      titleKey: `companion.journey.milestone.${key.toLowerCase()}.title`,
      descriptionKey: `companion.journey.milestone.${key.toLowerCase()}.description`,
      cosmeticKey: `COSMETIC_${key}`,
      major: indexInChapter === 5,
      sortOrder: i + 1,
    });
  }
  return Object.freeze(out);
}

export const JOURNEY_MILESTONES = buildMilestones();

/**
 * Explicit Journey cosmetics — one unique visualKey each.
 * Keys stay COSMETIC_MILESTONE_NN for unlock record stability.
 */
const JOURNEY_COSMETIC_SPECS = Object.freeze([
  { type: 'COMPANION_POSE', slot: 'accessory', visualKey: 'pose.wave', styleTier: 'COMMON' },
  { type: 'HOME_DECORATION', slot: 'decoration', visualKey: 'decor.plant', styleTier: 'COMMON' },
  { type: 'COMPANION_ACCESSORY', slot: 'accessory', visualKey: 'accessory.pin', styleTier: 'COMMON' },
  { type: 'COMPANION_ACCENT', slot: 'accent', visualKey: 'accent.gold', styleTier: 'COMMON' },
  { type: 'HOME_BACKGROUND', slot: 'background', visualKey: 'bg.dawn', styleTier: 'SPECIAL' },

  { type: 'COMPANION_POSE', slot: 'accessory', visualKey: 'pose.focused', styleTier: 'COMMON' },
  { type: 'HOME_DECORATION', slot: 'decoration', visualKey: 'decor.lamp', styleTier: 'COMMON' },
  { type: 'COMPANION_ACCESSORY', slot: 'accessory', visualKey: 'accessory.visor', styleTier: 'COMMON' },
  { type: 'COMPANION_ACCENT', slot: 'accent', visualKey: 'accent.soft_blue', styleTier: 'COMMON' },
  { type: 'HOME_BACKGROUND', slot: 'background', visualKey: 'bg.teal_room', styleTier: 'SPECIAL' },

  { type: 'COMPANION_POSE', slot: 'accessory', visualKey: 'pose.proud', styleTier: 'COMMON' },
  { type: 'HOME_DECORATION', slot: 'decoration', visualKey: 'decor.shelf', styleTier: 'COMMON' },
  { type: 'COMPANION_ACCESSORY', slot: 'accessory', visualKey: 'accessory.scarf', styleTier: 'COMMON' },
  { type: 'COMPANION_ACCENT', slot: 'accent', visualKey: 'accent.coral', styleTier: 'COMMON' },
  { type: 'HOME_BACKGROUND', slot: 'background', visualKey: 'bg.city_night', styleTier: 'SPECIAL' },

  { type: 'COMPANION_POSE', slot: 'accessory', visualKey: 'pose.resting', styleTier: 'COMMON' },
  { type: 'HOME_DECORATION', slot: 'decoration', visualKey: 'decor.frame', styleTier: 'COMMON' },
  { type: 'COMPANION_ACCESSORY', slot: 'accessory', visualKey: 'accessory.orbit', styleTier: 'COMMON' },
  { type: 'COMPANION_ACCENT', slot: 'accent', visualKey: 'accent.violet', styleTier: 'COMMON' },
  { type: 'HOME_BACKGROUND', slot: 'background', visualKey: 'bg.garden_light', styleTier: 'SPECIAL' },

  { type: 'COMPANION_ACCESSORY', slot: 'accessory', visualKey: 'accessory.badge', styleTier: 'COMMON' },
  { type: 'HOME_DECORATION', slot: 'decoration', visualKey: 'decor.window', styleTier: 'COMMON' },
  { type: 'COMPANION_POSE', slot: 'accessory', visualKey: 'pose.curious', styleTier: 'COMMON' },
  { type: 'COMPANION_ACCENT', slot: 'accent', visualKey: 'accent.mint', styleTier: 'COMMON' },
  { type: 'HOME_BACKGROUND', slot: 'background', visualKey: 'bg.summit_dusk', styleTier: 'SPECIAL' },
]);

function cosmetic(def) {
  return Object.freeze({
    key: def.key,
    type: def.type,
    unlockSource: def.unlockSource,
    unlockKey: def.unlockKey,
    styleTier: def.styleTier,
    assetKey: def.visualKey,
    visualKey: def.visualKey,
    titleKey: def.titleKey,
    descriptionKey: def.descriptionKey,
    slot: def.slot,
    isActive: def.isActive !== false,
  });
}

export const COMPANION_COSMETICS = Object.freeze([
  cosmetic({
    key: 'COSMETIC_DEFAULT_ACCENT',
    type: 'COMPANION_ACCENT',
    unlockSource: 'DEFAULT',
    unlockKey: 'DEFAULT',
    styleTier: 'COMMON',
    visualKey: 'accent.teal_core',
    titleKey: 'companion.cosmetic.default_accent.title',
    descriptionKey: 'companion.cosmetic.default_accent.description',
    slot: 'accent',
  }),
  cosmetic({
    key: 'COSMETIC_DEFAULT_BACKGROUND',
    type: 'HOME_BACKGROUND',
    unlockSource: 'DEFAULT',
    unlockKey: 'DEFAULT',
    styleTier: 'COMMON',
    visualKey: 'bg.calm_navy',
    titleKey: 'companion.cosmetic.default_bg.title',
    descriptionKey: 'companion.cosmetic.default_bg.description',
    slot: 'background',
  }),
  ...JOURNEY_MILESTONES.map((m, i) => {
    const spec = JOURNEY_COSMETIC_SPECS[i];
    return cosmetic({
      key: m.cosmeticKey,
      type: spec.type,
      unlockSource: 'JOURNEY',
      unlockKey: m.key,
      styleTier: m.major ? 'SPECIAL' : spec.styleTier,
      visualKey: spec.visualKey,
      titleKey: `companion.cosmetic.${m.cosmeticKey.toLowerCase()}.title`,
      descriptionKey: `companion.cosmetic.${m.cosmeticKey.toLowerCase()}.description`,
      slot: spec.slot,
      isActive: true,
    });
  }),
]);

/** All visualKeys that must have a renderer. */
export const ACTIVE_VISUAL_KEYS = Object.freeze(
  [...new Set(COMPANION_COSMETICS.filter((c) => c.isActive).map((c) => c.visualKey))],
);

export const COMPANION_MESSAGE_KEYS = Object.freeze([
  'COMPANION_MORNING_READY',
  'COMPANION_QUEST_PROGRESS',
  'COMPANION_ALL_COMPLETE',
  'COMPANION_LEVEL_UP',
  'COMPANION_ACHIEVEMENT',
  'COMPANION_COMEBACK',
  'COMPANION_REWARD_REDEEMED',
  'COMPANION_RAIN',
  'COMPANION_EVENING',
  'COMPANION_CALM',
  'COMPANION_CHEERFUL',
  'COMPANION_FOCUSED',
  'COMPANION_EXCITED',
  'COMPANION_CURIOUS',
]);

export const JOURNEY_DAILY_UNITS = 1;
export const JOURNEY_WEEKLY_UNITS = 3;

export function cosmeticByKey(key) {
  return COMPANION_COSMETICS.find((c) => c.key === key) || null;
}

export function milestoneByKey(key) {
  return JOURNEY_MILESTONES.find((m) => m.key === key) || null;
}

export function milestonesAtOrBelow(units) {
  return JOURNEY_MILESTONES.filter((m) => m.at <= units);
}

export function assertActiveCosmeticsHaveVisualKeys() {
  for (const c of COMPANION_COSMETICS) {
    if (!c.isActive) continue;
    if (!c.visualKey || typeof c.visualKey !== 'string') {
      const err = new Error(`Active cosmetic missing visualKey: ${c.key}`);
      err.code = 'COMPANION_VISUAL_MISSING';
      throw err;
    }
  }
  return true;
}
