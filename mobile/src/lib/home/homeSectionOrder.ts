/**
 * Home hub composition — order and presence only, no UI.
 *
 * Four layouts (owner decision 2026-10-02, `homeLayout.ts`) arrange the same modules:
 *  - standard — rebuilt 2026-10-04 for men first (research: men track numbers, respond to
 *    challenges and rewards, want one-tap logging; in Georgia blood pressure, smoking and heart
 *    disease dominate). Each block has one job and the conditional ones vanish on ordinary days:
 *      greet → „დღეს“ (one answer, dials, one-tap actions) → ask Medi (men's questions) → doses due →
 *      „არ გამოგრჩეს“ (visit ≤ 7 days, lab ≤ 14 days) → trainer → women's health (opt-in) →
 *      „შენი კვირა“ (steps trend) → challenges (MEDIRUN + MEDIQUEST) → MEDISCAN → news → MEDIFOOD → legal
 *    The one personal input is the onboarding goal („რისთვის გჭირდება MEDICARD?“): its section
 *    moves up to sit right after "ask Medi". Nothing is hidden because of it.
 *  - women — the cycle first, then what is ahead, today's tips, her day (steps, water, food),
 *    her cycle in numbers and the check-ups women reach for.
 *  - active — today's movement first, then water/outdoors, MEDIRUN, MEDIQUEST.
 *  - weight — the day's budget and logging first, then weight progress and meals.
 *
 * Every layout keeps "ask Medi" and the doses due near the top (a missed dose matters more than
 * any layout), ends with the layout switch row and the disclaimer, and holds at most one
 * spotlight card. Stable and deterministic: no health scoring or promotional ranking.
 *
 * News (admin „სიახლეები“) always sits directly above nutrition in standard — it travels with it —
 * and renders nothing when there is no live card. `hidden` drops sections of modules an admin paused.
 * `offer` inserts the one-time layout offer card right after the doses due.
 */
import type { HomeLayoutId } from './homeLayout.ts';

export type HomePrimaryGoal = 'medications' | 'nutrition' | 'cycle' | 'general' | null | undefined;

export type HomeSectionId =
  // shared
  | 'dashboard'
  | 'ask'
  | 'nextDose'
  | 'coach'
  | 'news'
  | 'profileNudge'
  | 'layoutOffer'
  | 'attention'
  | 'customize'
  | 'disclaimer'
  // standard
  | 'hero'
  | 'cycle'
  | 'nutrition'
  | 'checkup'
  | 'week'
  | 'challenges'
  // women
  | 'cycleHero'
  | 'cycleAhead'
  | 'cycleTips'
  | 'cycleStats'
  | 'dayPair'
  | 'womenCare'
  | 'community'
  // women + active
  | 'nutritionLite'
  // active
  | 'moveHero'
  | 'waterOutdoor'
  | 'medirun'
  | 'quest'
  // weight
  | 'energy'
  | 'quickLog'
  | 'weightProgress'
  | 'meals'
  | 'waterSteps'
  | 'nutritionTools';

const GOAL_SECTION: Record<string, HomeSectionId> = { medications: 'nextDose', nutrition: 'nutrition', cycle: 'cycle' };

export const HOME_LAYOUT_ORDER: Record<HomeLayoutId, readonly HomeSectionId[]> = {
  standard: [
    'dashboard',
    'hero',
    'ask',
    'nextDose',
    'attention',
    'coach',
    'cycle',
    'week',
    'challenges',
    'checkup',
    'news',
    'nutrition',
    'profileNudge',
    'customize',
    'disclaimer',
  ],
  women: [
    'dashboard',
    'cycleHero',
    'ask',
    'nextDose',
    'attention',
    'coach',
    'cycleAhead',
    'community',
    'cycleTips',
    'dayPair',
    'nutritionLite',
    'womenCare',
    'news',
    'cycleStats',
    'profileNudge',
    'customize',
    'disclaimer',
  ],
  active: [
    'dashboard',
    'moveHero',
    'ask',
    'nextDose',
    'attention',
    'coach',
    'waterOutdoor',
    'medirun',
    'quest',
    'cycle',
    'news',
    'nutritionLite',
    'profileNudge',
    'customize',
    'disclaimer',
  ],
  weight: [
    'dashboard',
    'energy',
    'quickLog',
    'ask',
    'nextDose',
    'attention',
    'coach',
    'weightProgress',
    'meals',
    'waterSteps',
    'cycle',
    'news',
    'nutritionTools',
    'profileNudge',
    'customize',
    'disclaimer',
  ],
};

/** The one dark spotlight card each layout may show (standard: deep analysis inside check-ups). */
export const HOME_LAYOUT_SPOTLIGHT: Record<HomeLayoutId, HomeSectionId | null> = {
  standard: 'checkup',
  women: null,
  active: 'medirun',
  weight: 'energy',
};

/** Sections shown only to women (the cycle module is female-only on the server). */
export const FEMALE_ONLY: ReadonlySet<HomeSectionId> = new Set(['cycle', 'cycleHero', 'cycleAhead', 'cycleTips', 'cycleStats', 'community']);

export function buildHomeSectionOrder({
  layout = 'standard',
  includeCycle = false,
  primaryGoal,
  hidden,
  offer = false,
}: {
  layout?: HomeLayoutId;
  includeCycle?: boolean;
  primaryGoal?: HomePrimaryGoal;
  hidden?: ReadonlySet<HomeSectionId>;
  offer?: boolean;
} = {}): HomeSectionId[] {
  // NextDose owns schedule loading and hides itself when there are no pending doses.
  let order = HOME_LAYOUT_ORDER[layout].filter((id) => (includeCycle || !FEMALE_ONLY.has(id)) && !hidden?.has(id));
  if (layout === 'standard') {
    const lead = primaryGoal ? GOAL_SECTION[primaryGoal] : undefined;
    if (lead && order.includes(lead)) {
      const block: HomeSectionId[] = lead === 'nutrition' && order.includes('news') ? ['news', 'nutrition'] : [lead];
      const rest = order.filter((id) => !block.includes(id));
      order = insertAfter(rest, ['ask', 'hero', 'dashboard'], block);
    }
  }
  if (offer && !hidden?.has('layoutOffer')) order = insertAfter(order, ['nextDose', 'ask', 'dashboard'], ['layoutOffer']);
  return order;
}

/** Inserts `block` after the first anchor present (so a paused "ask Medi" never puts it above the header). */
function insertAfter(order: HomeSectionId[], anchors: HomeSectionId[], block: HomeSectionId[]): HomeSectionId[] {
  const anchor = anchors.find((id) => order.includes(id));
  const at = anchor ? order.indexOf(anchor) + 1 : 0;
  return [...order.slice(0, at), ...block, ...order.slice(at)];
}
