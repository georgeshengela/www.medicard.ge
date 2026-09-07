/**
 * Home section composition — order + presence only.
 * Does not render UI. Does not invent medical priority.
 *
 * Canonical groups (primary job of each section):
 * IMMEDIATE → TODAY → MEDI_ENGAGEMENT → HEALTH_CONTEXT → WELLNESS → DISCOVERY → HISTORY → LEGAL
 *
 * Quest is MEDI_ENGAGEMENT (gamification), not "MEDI identity" just because Companion overlays it.
 * Companion remains visually attached to Quest; placement moves the pair together.
 */

export const HOME_PRIORITY = {
  IMMEDIATE: 'immediate',
  TODAY: 'today',
  MEDI_ENGAGEMENT: 'medi_engagement',
  HEALTH_CONTEXT: 'health_context',
  WELLNESS: 'wellness',
  DISCOVERY: 'discovery',
  HISTORY: 'history',
  LEGAL: 'legal',
} as const;

export type HomePriority = (typeof HOME_PRIORITY)[keyof typeof HOME_PRIORITY];

export type HomeSectionId =
  | 'dashboard'
  | 'nextDose'
  | 'steps'
  | 'hydration'
  | 'weight'
  | 'mediQuest'
  | 'cycle'
  | 'lab'
  | 'weather'
  | 'run'
  | 'symptom'
  | 'analysis'
  | 'consilium'
  | 'recentActivity'
  | 'disclaimer';

export type HomeSectionContext = {
  /**
   * True when there is at least one pending dose today (scenario maps / tests).
   * Live Home mounts NextDose and lets the section self-hide — see mountNextDoseSlot.
   */
  hasPendingDoses?: boolean;
  /** Consilium tile present (module list). Default true. */
  includeConsilium?: boolean;
  /** Cycle spotlight (FEMALE). Default false. */
  includeCycle?: boolean;
  /**
   * Live Home default: always mount NextDose so it owns meds fetch + self-hide.
   * Composition cannot know pending doses without duplicating useMedications work.
   * Scenario maps set this false and filter with hasPendingDoses.
   */
  mountNextDoseSlot?: boolean;
};

/** Primary job classification — not visual attachment. */
const SECTION_PRIORITY: Record<HomeSectionId, HomePriority> = {
  dashboard: HOME_PRIORITY.IMMEDIATE,
  nextDose: HOME_PRIORITY.IMMEDIATE,
  steps: HOME_PRIORITY.TODAY,
  hydration: HOME_PRIORITY.TODAY,
  weight: HOME_PRIORITY.TODAY,
  mediQuest: HOME_PRIORITY.MEDI_ENGAGEMENT,
  cycle: HOME_PRIORITY.HEALTH_CONTEXT,
  lab: HOME_PRIORITY.HEALTH_CONTEXT,
  weather: HOME_PRIORITY.WELLNESS,
  run: HOME_PRIORITY.WELLNESS,
  symptom: HOME_PRIORITY.DISCOVERY,
  analysis: HOME_PRIORITY.DISCOVERY,
  consilium: HOME_PRIORITY.DISCOVERY,
  recentActivity: HOME_PRIORITY.HISTORY,
  disclaimer: HOME_PRIORITY.LEGAL,
};

/**
 * Stable fixed order.
 * TODAY (steps/hydration/weight) before Quest — health state before gamification.
 * Quest stays prominent (right after the Today block), not buried.
 */
const FIXED_ORDER: HomeSectionId[] = [
  'dashboard',
  'nextDose',
  'steps',
  'hydration',
  'weight',
  'mediQuest',
  'cycle',
  'lab',
  'weather',
  'run',
  'symptom',
  'analysis',
  'consilium',
  'recentActivity',
  'disclaimer',
];

/**
 * Deterministic Home section order.
 * IMMEDIATE → TODAY → MEDI_ENGAGEMENT → HEALTH_CONTEXT → WELLNESS → DISCOVERY → HISTORY → LEGAL
 */
export function buildHomeSectionOrder(ctx: HomeSectionContext = {}): HomeSectionId[] {
  const mountNextDoseSlot = ctx.mountNextDoseSlot ?? true;
  const includeConsilium = ctx.includeConsilium ?? true;
  const includeCycle = ctx.includeCycle ?? false;
  const hasPendingDoses = ctx.hasPendingDoses ?? true;

  return FIXED_ORDER.filter((id) => {
    if (id === 'nextDose') {
      if (mountNextDoseSlot) return true;
      return hasPendingDoses;
    }
    if (id === 'consilium') return includeConsilium;
    if (id === 'cycle') return includeCycle;
    return true;
  });
}

export function homeSectionPriority(id: HomeSectionId): HomePriority {
  return SECTION_PRIORITY[id];
}

/** Scenario helpers for audits / tests — not used for live metric reshuffling. */
export function homeOrderForScenario(
  scenario:
    | 'new'
    | 'normal'
    | 'power'
    | 'medicationDue'
    | 'noAttention'
    | 'cycleEnabled'
    | 'cycleDisabled',
): HomeSectionId[] {
  switch (scenario) {
    case 'medicationDue':
      return buildHomeSectionOrder({
        mountNextDoseSlot: false,
        hasPendingDoses: true,
        includeConsilium: true,
        includeCycle: false,
      });
    case 'noAttention':
    case 'new':
    case 'normal':
    case 'cycleDisabled':
      return buildHomeSectionOrder({
        mountNextDoseSlot: false,
        hasPendingDoses: false,
        includeConsilium: true,
        includeCycle: false,
      });
    case 'power':
      return buildHomeSectionOrder({
        mountNextDoseSlot: false,
        hasPendingDoses: true,
        includeConsilium: true,
        includeCycle: true,
      });
    case 'cycleEnabled':
      return buildHomeSectionOrder({
        mountNextDoseSlot: false,
        hasPendingDoses: false,
        includeConsilium: true,
        includeCycle: true,
      });
    default:
      return buildHomeSectionOrder();
  }
}
