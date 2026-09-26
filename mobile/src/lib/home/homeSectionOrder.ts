/**
 * Home hub composition — order and presence only, no UI.
 *
 * Reading order follows what a person can act on right now:
 *   greet → today's rings → ask Medi → doses due → quick actions →
 *   women's health (opt-in) → movement → discover → history → legal
 *
 * Stable and deterministic: no health scoring, promotional ranking, or device upsells.
 */
export type HomeSectionId =
  | 'dashboard'
  | 'hero'
  | 'ask'
  | 'nextDose'
  | 'actions'
  | 'cycle'
  | 'community'
  | 'movement'
  | 'discover'
  | 'recentActivity'
  | 'disclaimer';

const ORDER: readonly HomeSectionId[] = [
  'dashboard',
  'hero',
  'ask',
  'nextDose',
  'actions',
  'cycle',
  'community',
  'movement',
  'discover',
  'recentActivity',
  'disclaimer',
];

const FEMALE_ONLY: ReadonlySet<HomeSectionId> = new Set(['cycle', 'community']);

export function buildHomeSectionOrder({
  includeCycle = false,
}: { includeCycle?: boolean } = {}): HomeSectionId[] {
  // NextDose owns schedule loading and hides itself when there are no pending doses.
  return ORDER.filter((id) => includeCycle || !FEMALE_ONLY.has(id));
}
