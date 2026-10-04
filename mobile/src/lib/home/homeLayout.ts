/**
 * Home layouts (owner decision 2026-10-02): one Home screen, four arrangements of the same
 * modules — „ქალის ჯანმრთელობა“ (cycle first, women only), „აქტიური“ (steps, water, MEDIRUN),
 * „კვება და წონა“ (budget, logging, weight) and „სტანდარტული“ (rebuilt 2026-10-04 for men first).
 *
 * Pure: no React Native, so node tests load it. Module pages and the bottom tab bar never change
 * with the layout — only the Home tab's order and accent do.
 *
 * Storage: `HealthProfile.extraAnswers.homeLayout` (+ `homeLayoutOfferDone`), written only from a
 * person's tap (picker, offer card, onboarding step). Defaults are computed, never written.
 */
import type { FeatureState } from '../featureRoutes.ts';
import { tx } from '../../i18n/locale.js';

export type HomeLayoutId = 'standard' | 'women' | 'active' | 'weight';
export const HOME_LAYOUT_IDS: readonly HomeLayoutId[] = ['women', 'active', 'weight', 'standard'];

/** Keys this feature owns in `extraAnswers`. Full-profile writers must not re-send them. */
export const HOME_LAYOUT_EXTRA_KEYS = ['homeLayout', 'homeLayoutOfferDone'] as const;

export const HOME_LAYOUT_NAMES: Record<HomeLayoutId, string> = {
  women: tx('ქალის ჯანმრთელობა', "Women's health"),
  active: tx('აქტიური', 'Active'),
  weight: tx('კვება და წონა', 'Nutrition & weight'),
  standard: tx('სტანდარტული', 'Standard'),
};

export const HOME_LAYOUT_DESCRIPTIONS: Record<HomeLayoutId, string> = {
  women: tx('ციკლი, დღის რჩევები და შენი დღე — ერთ ნაზ გვერდზე', 'Your cycle, daily tips and your day on one calm page'),
  active: tx('ნაბიჯები, წყალი, MEDIRUN და მისიები — წინ', 'Steps, water, MEDIRUN and missions up front'),
  weight: tx('დღის ბიუჯეტი, სწრაფი ჩაწერა და წონის გზა', 'Daily budget, quick logging and your weight path'),
  standard: tx('დღის მთავარი: წამლები, აქტიურობა, ანალიზები და კვება', 'Today’s essentials: medicines, activity, labs and food'),
};

type Gender = 'MALE' | 'FEMALE' | 'OTHER' | string | null | undefined;
type Goal = 'medications' | 'nutrition' | 'cycle' | 'general' | string | null | undefined;

const on = (features: FeatureState | undefined, key: string) => features?.flags[key] !== false;

export function parseHomeLayout(raw: unknown): HomeLayoutId | null {
  return typeof raw === 'string' && (HOME_LAYOUT_IDS as readonly string[]).includes(raw) ? (raw as HomeLayoutId) : null;
}

/** The whole feature (picker, offer, accents) — admin „მოდულები“ → homeLayouts. */
export function homeLayoutsEnabled(features?: FeatureState): boolean {
  return on(features, 'homeLayouts');
}

/**
 * Whether a layout can be shown right now. A layout whose core modules an admin paused falls
 * back to standard; the stored choice is kept and returns by itself.
 */
export function homeLayoutAvailable(id: HomeLayoutId, gender: Gender, features?: FeatureState): boolean {
  if (id === 'standard') return true;
  if (!homeLayoutsEnabled(features)) return false;
  if (id === 'women') return gender === 'FEMALE' && on(features, 'cycle');
  if (id === 'active') return on(features, 'steps') || on(features, 'hydration') || on(features, 'medirun');
  if (id === 'weight') return on(features, 'nutrition') || on(features, 'weight');
  return false;
}

/** Picker order: the women's layout first (women only), standard last. */
export function availableHomeLayouts(gender: Gender): HomeLayoutId[] {
  return HOME_LAYOUT_IDS.filter((id) => id !== 'women' || gender === 'FEMALE');
}

/** The „შენთვის“ badge (never switches anything by itself): women → women's, nutrition goal → weight. */
export function recommendedHomeLayout(goal: Goal, gender: Gender, features?: FeatureState): HomeLayoutId {
  if (gender === 'FEMALE' && homeLayoutAvailable('women', gender, features)) return 'women';
  if (goal === 'nutrition' && homeLayoutAvailable('weight', gender, features)) return 'weight';
  return 'standard';
}

export type HomeLayoutResolution = {
  /** What Home renders now. */
  layout: HomeLayoutId;
  /** The person's own choice, if any (kept even while it cannot be shown). */
  chosen: HomeLayoutId | null;
  /** Show the one-time women's offer card on Home. */
  offer: boolean;
};

export function resolveHomeLayout({
  chosen,
  offerDone,
  gender,
  features,
  cycleLocked = false,
}: {
  chosen: HomeLayoutId | null;
  offerDone: boolean;
  gender: Gender;
  features?: FeatureState;
  cycleLocked?: boolean;
}): HomeLayoutResolution {
  if (!homeLayoutsEnabled(features)) return { layout: 'standard', chosen, offer: false };
  if (chosen) {
    return { layout: homeLayoutAvailable(chosen, gender, features) ? chosen : 'standard', chosen, offer: false };
  }
  // Existing women who never chose: offered once on Home (new accounts choose during sign-up).
  // Not while the cycle is behind Face ID / PIN — Home must not advertise cycle content then.
  const offer = !offerDone && !cycleLocked && homeLayoutAvailable('women', gender, features);
  return { layout: 'standard', chosen: null, offer };
}

/** Drops the layout keys from an `extraAnswers` copy before a full-profile write re-sends it. */
export function omitHomeLayoutKeys<T extends Record<string, unknown>>(extra: T): T {
  const copy = { ...extra };
  for (const key of HOME_LAYOUT_EXTRA_KEYS) delete copy[key];
  return copy;
}

export function storedHomeLayout(extra: unknown): { layout: HomeLayoutId | null; offerDone: boolean } {
  const src = extra && typeof extra === 'object' ? (extra as Record<string, unknown>) : {};
  return { layout: parseHomeLayout(src.homeLayout), offerDone: src.homeLayoutOfferDone === true };
}
