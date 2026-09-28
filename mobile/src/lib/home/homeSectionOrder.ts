/**
 * Home hub composition — order and presence only, no UI.
 *
 * Reading order follows what a person can act on right now, then what they
 * come to MEDICARD for, grouped so each block has one job:
 *   greet → today's rings → ask Medi → doses due → trainer session (only when linked) →
 *   women's health (opt-in) →
 *   news (admin cards) → nutrition → AI check-ups → services → legal
 *
 * Stable and deterministic: no health scoring, promotional ranking, or device upsells.
 * The one personal input is the onboarding goal ("რისთვის გჭირდება MEDICARD?"): its
 * section moves up to sit right after "ask Medi". Nothing is hidden because of it.
 *
 * News (admin „სიახლეები“) always sits directly above nutrition — it travels with it — and
 * renders nothing when there is no live card. `hidden` drops sections of modules an admin paused.
 */
export type HomePrimaryGoal = 'medications' | 'nutrition' | 'cycle' | 'general' | null | undefined;

const GOAL_SECTION: Record<string, HomeSectionId> = { medications: 'nextDose', nutrition: 'nutrition', cycle: 'cycle' };
export type HomeSectionId =
  | 'dashboard'
  | 'hero'
  | 'ask'
  | 'nextDose'
  | 'coach'
  | 'cycle'
  | 'news'
  | 'nutrition'
  | 'checkup'
  | 'profileNudge'
  | 'services'
  | 'disclaimer';

const ORDER: readonly HomeSectionId[] = [
  'dashboard',
  'hero',
  'ask',
  'nextDose',
  'coach',
  'cycle',
  'news',
  'nutrition',
  'checkup',
  'profileNudge',
  'services',
  'disclaimer',
];

const FEMALE_ONLY: ReadonlySet<HomeSectionId> = new Set(['cycle']);

export function buildHomeSectionOrder({
  includeCycle = false,
  primaryGoal,
  hidden,
}: { includeCycle?: boolean; primaryGoal?: HomePrimaryGoal; hidden?: ReadonlySet<HomeSectionId> } = {}): HomeSectionId[] {
  // NextDose owns schedule loading and hides itself when there are no pending doses.
  const order = ORDER.filter((id) => (includeCycle || !FEMALE_ONLY.has(id)) && !hidden?.has(id));
  const lead = primaryGoal ? GOAL_SECTION[primaryGoal] : undefined;
  if (!lead || !order.includes(lead)) return order;
  const block: HomeSectionId[] = lead === 'nutrition' && order.includes('news') ? ['news', 'nutrition'] : [lead];
  const rest = order.filter((id) => !block.includes(id));
  const at = rest.indexOf('ask') + 1;
  return [...rest.slice(0, at), ...block, ...rest.slice(at)];
}
