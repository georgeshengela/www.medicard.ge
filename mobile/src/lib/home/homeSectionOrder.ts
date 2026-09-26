/**
 * Home hub composition — order and presence only, no UI.
 *
 * Reading order follows what a person can act on right now, then what they
 * come to MEDICARD for, grouped so each block has one job:
 *   greet → today's rings → ask Medi → doses due → women's health (opt-in) →
 *   nutrition → AI check-ups → movement → services → history → legal
 *
 * Stable and deterministic: no health scoring, promotional ranking, or device upsells.
 */
export type HomeSectionId =
  | 'dashboard'
  | 'hero'
  | 'ask'
  | 'nextDose'
  | 'cycle'
  | 'nutrition'
  | 'checkup'
  | 'movement'
  | 'services'
  | 'recentActivity'
  | 'disclaimer';

const ORDER: readonly HomeSectionId[] = [
  'dashboard',
  'hero',
  'ask',
  'nextDose',
  'cycle',
  'nutrition',
  'checkup',
  'movement',
  'services',
  'recentActivity',
  'disclaimer',
];

const FEMALE_ONLY: ReadonlySet<HomeSectionId> = new Set(['cycle']);

export function buildHomeSectionOrder({
  includeCycle = false,
}: { includeCycle?: boolean } = {}): HomeSectionId[] {
  // NextDose owns schedule loading and hides itself when there are no pending doses.
  return ORDER.filter((id) => includeCycle || !FEMALE_ONLY.has(id));
}
