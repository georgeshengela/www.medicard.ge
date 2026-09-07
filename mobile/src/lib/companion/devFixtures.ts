/**
 * DEV-only Medi Companion UI fixtures. Never activates in production builds.
 * Does not write production companion cache or touch quest economy.
 */
import type {
  CompanionCosmetic,
  CompanionEquipment,
  CompanionJourney,
  CompanionOverview,
  CompanionState,
  JourneyMilestone,
} from './api';
import { COSMETIC_VISUAL_BY_KEY } from './cosmeticVisuals';

export const COMPANION_DEV_SCENARIOS = Object.freeze([
  'LIVE',
  'NEW_USER',
  'EARLY_STAGE',
  'MID_JOURNEY',
  'NEAR_MILESTONE',
  'MULTI_UNLOCK_1',
  'MULTI_UNLOCK',
  'MULTI_UNLOCK_4',
  'JOURNEY_COMPLETE',
  'LEVEL_STAGE_CHANGE',
  'ALL_DAILY_COMPLETE',
  'COMEBACK',
  'EVENING',
  'RAIN',
  'LARGE_COLLECTION',
  'OFFLINE',
  'ERROR',
] as const);

export type CompanionDevScenario = (typeof COMPANION_DEV_SCENARIOS)[number];

export const COMPANION_DEV_LABELS: Record<CompanionDevScenario, string> = Object.freeze({
  LIVE: 'Live API',
  NEW_USER: 'New user',
  EARLY_STAGE: 'Early stage',
  MID_JOURNEY: 'Mid journey',
  NEAR_MILESTONE: 'Near milestone',
  MULTI_UNLOCK_1: 'Unlock ×1',
  MULTI_UNLOCK: 'Multi unlock 2–3',
  MULTI_UNLOCK_4: 'Unlock 4+',
  JOURNEY_COMPLETE: 'Journey complete',
  LEVEL_STAGE_CHANGE: 'Level/stage change',
  ALL_DAILY_COMPLETE: 'All daily complete',
  COMEBACK: 'Comeback',
  EVENING: 'Evening',
  RAIN: 'Rain',
  LARGE_COLLECTION: 'Large collection',
  OFFLINE: 'Offline cached',
  ERROR: 'Error',
});

const THRESHOLDS = [
  1, 3, 5, 8, 12, 17, 23, 30, 38, 47, 57, 68, 80, 93, 107, 122, 138, 155, 173, 192, 212, 233, 255, 278, 302,
];

let current: CompanionDevScenario = 'LIVE';
const listeners = new Set<(s: CompanionDevScenario) => void>();

export function isCompanionDevEnabled() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function getCompanionDevScenario(): CompanionDevScenario {
  return isCompanionDevEnabled() ? current : 'LIVE';
}

export function setCompanionDevScenario(key: string) {
  if (!isCompanionDevEnabled()) return;
  const next = (COMPANION_DEV_SCENARIOS as readonly string[]).includes(key)
    ? (key as CompanionDevScenario)
    : 'LIVE';
  current = next;
  listeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      /* ignore */
    }
  });
}

export function subscribeCompanionDevScenario(listener: (s: CompanionDevScenario) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function defaultEquipment(): CompanionEquipment {
  return {
    accent: 'COSMETIC_DEFAULT_ACCENT',
    accessory: null,
    background: 'COSMETIC_DEFAULT_BACKGROUND',
    decoration: null,
  };
}

function milestones(units: number, newly: string[] = []): JourneyMilestone[] {
  return THRESHOLDS.map((at, i) => {
    const key = `MILESTONE_${String(i + 1).padStart(2, '0')}`;
    const chapterIndex = Math.floor(i / 5) + 1;
    const indexInChapter = (i % 5) + 1;
    return {
      key,
      at,
      chapterKey: `CHAPTER_${chapterIndex}`,
      titleKey: `companion.journey.milestone.${key.toLowerCase()}.title`,
      descriptionKey: `companion.journey.milestone.${key.toLowerCase()}.description`,
      major: indexInChapter === 5,
      unlocked: units >= at,
      cosmeticKey: `COSMETIC_${key}`,
    };
  }).map((m) => (newly.includes(m.key) ? { ...m, unlocked: true } : m));
}

function journeyFromUnits(units: number, newlyUnlockedKeys: string[] = []): CompanionJourney {
  const list = milestones(units, newlyUnlockedKeys);
  const unlocked = list.filter((m) => m.unlocked);
  const next = list.find((m) => !m.unlocked) || null;
  const current = unlocked[unlocked.length - 1] || null;
  const chapterKey = current?.chapterKey || next?.chapterKey || 'CHAPTER_1';
  return {
    units,
    chapterKey,
    currentMilestoneKey: current?.key || null,
    nextMilestoneKey: next?.key || null,
    nextAt: next?.at ?? null,
    milestones: list,
    newlyUnlockedKeys,
    aggregateUnlockCount: newlyUnlockedKeys.length,
  };
}

function cosmeticForMilestone(m: JourneyMilestone, _i: number): CompanionCosmetic {
  const key = m.cosmeticKey || `COSMETIC_${m.key}`;
  const visualKey = COSMETIC_VISUAL_BY_KEY[key] || `journey.${m.key.toLowerCase()}`;
  const slot =
    visualKey.startsWith('bg.')
      ? 'background'
      : visualKey.startsWith('decor.')
        ? 'decoration'
        : visualKey.startsWith('accent.')
          ? 'accent'
          : 'accessory';
  const type =
    slot === 'background'
      ? 'HOME_BACKGROUND'
      : slot === 'decoration'
        ? 'HOME_DECORATION'
        : slot === 'accent'
          ? 'COMPANION_ACCENT'
          : visualKey.startsWith('pose.')
            ? 'COMPANION_POSE'
            : 'COMPANION_ACCESSORY';
  return {
    key,
    type,
    styleTier: m.major ? 'SPECIAL' : 'COMMON',
    assetKey: visualKey,
    titleKey: `companion.cosmetic.${key.toLowerCase()}.title`,
    descriptionKey: `companion.cosmetic.${key.toLowerCase()}.description`,
    slot,
    unlocked: true,
  };
}

function baseCollection(unlockedCount: number): CompanionCosmetic[] {
  const defaults: CompanionCosmetic[] = [
    {
      key: 'COSMETIC_DEFAULT_ACCENT',
      type: 'COMPANION_ACCENT',
      styleTier: 'COMMON',
      assetKey: 'accent.teal_core',
      titleKey: 'companion.cosmetic.default_accent.title',
      descriptionKey: 'companion.cosmetic.default_accent.description',
      slot: 'accent',
      unlocked: true,
    },
    {
      key: 'COSMETIC_DEFAULT_BACKGROUND',
      type: 'HOME_BACKGROUND',
      styleTier: 'COMMON',
      assetKey: 'bg.calm_navy',
      titleKey: 'companion.cosmetic.default_bg.title',
      descriptionKey: 'companion.cosmetic.default_bg.description',
      slot: 'background',
      unlocked: true,
    },
  ];
  const journey = milestones(THRESHOLD_AT(unlockedCount))
    .filter((m) => m.unlocked)
    .map((m, i) => cosmeticForMilestone(m, i));
  return [...defaults, ...journey];
}

function THRESHOLD_AT(count: number) {
  if (count <= 0) return 0;
  const idx = Math.min(count, THRESHOLDS.length) - 1;
  return THRESHOLDS[idx];
}

function companion(
  partial: Partial<CompanionState> & Pick<CompanionState, 'level' | 'stage' | 'moodKey' | 'messageKey'>,
): CompanionState {
  return {
    poseKey: `pose.${partial.stage.toLowerCase()}`,
    environmentKey: 'env.day',
    daypart: 'day',
    reducedMotion: false,
    ...partial,
  };
}

function overview(parts: {
  companion: CompanionState;
  journey: CompanionJourney;
  equipment?: CompanionEquipment;
  collection?: CompanionCosmetic[];
  recentUnlocks?: Array<{ kind: string; key: string }>;
}): CompanionOverview {
  return {
    companion: parts.companion,
    journey: parts.journey,
    equipment: parts.equipment || defaultEquipment(),
    collection: parts.collection || baseCollection(parts.journey.milestones.filter((m) => m.unlocked).length),
    recentUnlocks: parts.recentUnlocks || [],
  };
}

export function buildCompanionFixture(scenario: CompanionDevScenario): CompanionOverview | null {
  if (!isCompanionDevEnabled() || scenario === 'LIVE' || scenario === 'ERROR') return null;

  switch (scenario) {
    case 'NEW_USER':
      return overview({
        companion: companion({
          level: 1,
          stage: 'STAGE_1',
          moodKey: 'CHEERFUL',
          messageKey: 'COMPANION_MORNING_READY',
          daypart: 'morning',
          environmentKey: 'env.sunrise',
        }),
        journey: journeyFromUnits(0),
        collection: baseCollection(0),
      });
    case 'EARLY_STAGE':
      return overview({
        companion: companion({
          level: 3,
          stage: 'STAGE_1',
          moodKey: 'FOCUSED',
          messageKey: 'COMPANION_QUEST_PROGRESS',
        }),
        journey: journeyFromUnits(4),
      });
    case 'MID_JOURNEY':
      return overview({
        companion: companion({
          level: 12,
          stage: 'STAGE_3',
          moodKey: 'CHEERFUL',
          messageKey: 'COMPANION_CHEERFUL',
        }),
        journey: journeyFromUnits(80),
      });
    case 'NEAR_MILESTONE':
      return overview({
        companion: companion({
          level: 8,
          stage: 'STAGE_2',
          moodKey: 'CURIOUS',
          messageKey: 'COMPANION_CURIOUS',
        }),
        journey: journeyFromUnits(29),
      });
    case 'MULTI_UNLOCK_1': {
      const newly = ['MILESTONE_05'];
      return overview({
        companion: companion({
          level: 5,
          stage: 'STAGE_2',
          moodKey: 'EXCITED',
          messageKey: 'COMPANION_EXCITED',
        }),
        journey: journeyFromUnits(12, newly),
        recentUnlocks: newly.map((key) => ({ kind: 'JOURNEY_MILESTONE', key })),
      });
    }
    case 'MULTI_UNLOCK': {
      const newly = ['MILESTONE_05', 'MILESTONE_06', 'MILESTONE_07'];
      return overview({
        companion: companion({
          level: 6,
          stage: 'STAGE_2',
          moodKey: 'EXCITED',
          messageKey: 'COMPANION_EXCITED',
        }),
        journey: journeyFromUnits(23, newly),
        recentUnlocks: newly.map((key) => ({ kind: 'JOURNEY_MILESTONE', key })),
      });
    }
    case 'MULTI_UNLOCK_4': {
      const newly = ['MILESTONE_08', 'MILESTONE_09', 'MILESTONE_10', 'MILESTONE_11'];
      return overview({
        companion: companion({
          level: 9,
          stage: 'STAGE_2',
          moodKey: 'PROUD',
          messageKey: 'COMPANION_EXCITED',
        }),
        journey: journeyFromUnits(57, newly),
        recentUnlocks: newly.map((key) => ({ kind: 'JOURNEY_MILESTONE', key })),
      });
    }
    case 'JOURNEY_COMPLETE':
      return overview({
        companion: companion({
          level: 50,
          stage: 'STAGE_7',
          moodKey: 'PROUD',
          messageKey: 'COMPANION_CHEERFUL',
        }),
        journey: journeyFromUnits(302),
        collection: baseCollection(25),
      });
    case 'LEVEL_STAGE_CHANGE':
      return overview({
        companion: companion({
          level: 10,
          stage: 'STAGE_3',
          moodKey: 'EXCITED',
          messageKey: 'COMPANION_LEVEL_UP',
        }),
        journey: journeyFromUnits(47),
      });
    case 'ALL_DAILY_COMPLETE':
      return overview({
        companion: companion({
          level: 7,
          stage: 'STAGE_2',
          moodKey: 'PROUD',
          messageKey: 'COMPANION_ALL_COMPLETE',
        }),
        journey: journeyFromUnits(17),
      });
    case 'COMEBACK':
      return overview({
        companion: companion({
          level: 5,
          stage: 'STAGE_2',
          moodKey: 'WELCOME_BACK',
          messageKey: 'COMPANION_COMEBACK',
        }),
        journey: journeyFromUnits(12),
      });
    case 'EVENING':
      return overview({
        companion: companion({
          level: 4,
          stage: 'STAGE_1',
          moodKey: 'RESTING',
          messageKey: 'COMPANION_EVENING',
          daypart: 'evening',
          environmentKey: 'env.dusk',
        }),
        journey: journeyFromUnits(8),
      });
    case 'RAIN':
      return overview({
        companion: companion({
          level: 4,
          stage: 'STAGE_1',
          moodKey: 'CURIOUS',
          messageKey: 'COMPANION_RAIN',
          environmentKey: 'env.rain',
        }),
        journey: journeyFromUnits(5),
      });
    case 'LARGE_COLLECTION': {
      const j = journeyFromUnits(192);
      const collection = baseCollection(20);
      const equipment: CompanionEquipment = {
        accent: collection.find((c) => c.slot === 'accent' && c.key !== 'COSMETIC_DEFAULT_ACCENT')?.key || 'COSMETIC_DEFAULT_ACCENT',
        accessory: collection.find((c) => c.slot === 'accessory')?.key || null,
        background: collection.find((c) => c.slot === 'background' && c.key !== 'COSMETIC_DEFAULT_BACKGROUND')?.key || 'COSMETIC_DEFAULT_BACKGROUND',
        decoration: collection.find((c) => c.slot === 'decoration')?.key || null,
      };
      return overview({
        companion: companion({
          level: 28,
          stage: 'STAGE_4',
          moodKey: 'PROUD',
          messageKey: 'COMPANION_CHEERFUL',
          poseKey: equipment.accessory || 'pose.stage_4',
        }),
        journey: j,
        equipment,
        collection,
      });
    }
    case 'OFFLINE':
      return overview({
        companion: companion({
          level: 9,
          stage: 'STAGE_2',
          moodKey: 'CALM',
          messageKey: 'COMPANION_CALM',
        }),
        journey: journeyFromUnits(38),
      });
    default:
      return null;
  }
}

export function applyCompanionDevView(input: {
  overview: CompanionOverview | null;
  loading: boolean;
  error: boolean;
  stale: boolean;
  scenario: CompanionDevScenario;
}): {
  overview: CompanionOverview | null;
  loading: boolean;
  error: boolean;
  stale: boolean;
  fixtureOffline: boolean;
} {
  if (!isCompanionDevEnabled() || input.scenario === 'LIVE') {
    return { ...input, fixtureOffline: false };
  }
  if (input.scenario === 'ERROR') {
    return { overview: null, loading: false, error: true, stale: false, fixtureOffline: false };
  }
  const fixture = buildCompanionFixture(input.scenario);
  return {
    overview: fixture,
    loading: false,
    error: false,
    stale: input.scenario === 'OFFLINE',
    fixtureOffline: input.scenario === 'OFFLINE',
  };
}
