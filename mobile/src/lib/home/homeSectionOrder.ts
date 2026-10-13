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
 *
 * `remote` = the admin's choice for this layout (admin #/home, /api/app/status `home`): its own order and hidden
 * sections. The greeting stays first and the disclaimer last; ids this build does not know are ignored, and ids
 * the admin's order lacks go back after their default predecessor (server/src/lib/homeSections.js does the same).
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
  // MEDISLEEP (every layout)
  | 'sleep'
  // MEDIHOROSCOPE (every layout; hidden until shipped + switched on, and by the person or admin)
  | 'horoscope'
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
    'sleep',
    'horoscope',
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
    'sleep',
    'horoscope',
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
    'sleep',
    'horoscope',
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
    'sleep',
    'horoscope',
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

/** Never hidden or moved by the admin: the greeting opens every Home, the disclaimer closes it. */
export const HOME_LOCKED: ReadonlySet<HomeSectionId> = new Set(['dashboard', 'disclaimer']);

export type HomeRemoteLayout = { order?: readonly HomeSectionId[]; hidden?: readonly HomeSectionId[] };
export type HomeRemoteConfig = { v: number; layouts: Partial<Record<HomeLayoutId, HomeRemoteLayout>> };
export const EMPTY_HOME_REMOTE: HomeRemoteConfig = { v: 0, layouts: {} };

/** The `home` part of /api/app/status, kept to what this build knows. */
export function sanitizeHomeRemote(raw: unknown): HomeRemoteConfig {
  if (!raw || typeof raw !== 'object') return EMPTY_HOME_REMOTE;
  const src = (raw as { layouts?: unknown }).layouts;
  const layouts: HomeRemoteConfig['layouts'] = {};
  if (src && typeof src === 'object') {
    for (const layout of Object.keys(HOME_LAYOUT_ORDER) as HomeLayoutId[]) {
      const entry = (src as Record<string, unknown>)[layout];
      if (!entry || typeof entry !== 'object') continue;
      const known = HOME_LAYOUT_ORDER[layout] as readonly string[];
      const pick = (list: unknown): HomeSectionId[] =>
        Array.isArray(list) ? list.filter((id): id is HomeSectionId => typeof id === 'string' && known.includes(id)) : [];
      const order = pick((entry as { order?: unknown }).order);
      const hidden = pick((entry as { hidden?: unknown }).hidden).filter((id) => !HOME_LOCKED.has(id));
      const out: HomeRemoteLayout = {};
      if (order.length) out.order = order;
      if (hidden.length) out.hidden = hidden;
      if (out.order || out.hidden) layouts[layout] = out;
    }
  }
  const v = Number((raw as { v?: unknown }).v);
  return { v: Number.isFinite(v) ? v : 0, layouts };
}

/** The admin's order over this build's defaults (same rule as the server's mergeOrder). */
export function mergeHomeOrder(defaults: readonly HomeSectionId[], custom?: readonly HomeSectionId[]): HomeSectionId[] {
  if (!custom?.length) return [...defaults];
  const seen = new Set<HomeSectionId>();
  const order: HomeSectionId[] = [];
  for (const id of custom) {
    if (defaults.includes(id) && !seen.has(id) && !HOME_LOCKED.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  defaults.forEach((id, i) => {
    if (seen.has(id) || HOME_LOCKED.has(id)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = order.indexOf(defaults[j]);
      if (k >= 0) {
        at = k + 1;
        break;
      }
    }
    order.splice(at, 0, id);
    seen.add(id);
  });
  const head = defaults.filter((id, i) => HOME_LOCKED.has(id) && i === 0);
  const tail = defaults.filter((id, i) => HOME_LOCKED.has(id) && i !== 0);
  return [...head, ...order, ...tail];
}

export function buildHomeSectionOrder({
  layout = 'standard',
  includeCycle = false,
  primaryGoal,
  hidden,
  offer = false,
  remote,
}: {
  layout?: HomeLayoutId;
  includeCycle?: boolean;
  primaryGoal?: HomePrimaryGoal;
  hidden?: ReadonlySet<HomeSectionId>;
  offer?: boolean;
  remote?: HomeRemoteLayout;
} = {}): HomeSectionId[] {
  const adminHidden = new Set(remote?.hidden ?? []);
  // NextDose owns schedule loading and hides itself when there are no pending doses.
  let order = mergeHomeOrder(HOME_LAYOUT_ORDER[layout], remote?.order).filter(
    (id) => (includeCycle || !FEMALE_ONLY.has(id)) && !hidden?.has(id) && !(adminHidden.has(id) && !HOME_LOCKED.has(id)),
  );
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
