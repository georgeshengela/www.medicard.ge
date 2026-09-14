/**
 * Home section composition — order + presence only.
 * Does not render UI. Does not invent medical priority.
 *
 * Canonical groups (primary job of each section):
 * IMMEDIATE → TODAY → HEALTH_CONTEXT → WELLNESS → DISCOVERY → HISTORY → LEGAL
 *
 * Medi Quest + Companion live on Profile, not Home.
 * Lab lives on Records, not Home.
 */

export const HOME_PRIORITY = {
  IMMEDIATE: 'immediate',
  TODAY: 'today',
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
  | 'cycle'
  | 'weather'
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
  cycle: HOME_PRIORITY.HEALTH_CONTEXT,
  weather: HOME_PRIORITY.WELLNESS,
  symptom: HOME_PRIORITY.DISCOVERY,
  analysis: HOME_PRIORITY.DISCOVERY,
  consilium: HOME_PRIORITY.DISCOVERY,
  recentActivity: HOME_PRIORITY.HISTORY,
  disclaimer: HOME_PRIORITY.LEGAL,
};

/**
 * Stable fixed order.
 * TODAY (steps/hydration/weight) before Health Context — health state first.
 */
const FIXED_ORDER: HomeSectionId[] = [
  'dashboard',
  'nextDose',
  'steps',
  'hydration',
  'weight',
  'cycle',
  'weather',
  'symptom',
  'analysis',
  'consilium',
  'recentActivity',
  'disclaimer',
];

/**
 * Deterministic Home section order.
 * IMMEDIATE → TODAY → HEALTH_CONTEXT → WELLNESS → DISCOVERY → HISTORY → LEGAL
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
