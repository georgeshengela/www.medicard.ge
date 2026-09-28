/**
 * Pure part of the admin module switches (no React, no storage) so node tests can load it.
 * The store and hooks live in featureFlags.ts.
 */
export type FeatureKey =
  | 'cycle'
  | 'nutrition'
  | 'nutritionAi'
  | 'medi'
  | 'pets'
  | 'mediVet'
  | 'medirun'
  | 'quest'
  | 'rewardsStore'
  | 'coach'
  | 'community'
  | 'pharmacy'
  | 'news';

export type FeatureState = {
  flags: Partial<Record<string, boolean>>;
  messages: Partial<Record<string, string>>;
};

export const EMPTY_FEATURE_STATE: FeatureState = { flags: {}, messages: {} };

/** Only booleans and short strings survive — a malformed answer can never hide a module by accident. */
export function sanitizeFeatureState(raw: unknown): FeatureState {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const flags: Record<string, boolean> = {};
  const messages: Record<string, string> = {};
  const f = src.flags && typeof src.flags === 'object' ? (src.flags as Record<string, unknown>) : {};
  const m = src.messages && typeof src.messages === 'object' ? (src.messages as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(f)) if (typeof v === 'boolean') flags[k] = v;
  for (const [k, v] of Object.entries(m)) if (typeof v === 'string' && v.trim()) messages[k] = v.trim().slice(0, 240);
  return { flags, messages };
}

/** Unknown or missing keys count as ON. */
export function featureOnIn(state: FeatureState, key: string): boolean {
  return state.flags[key] !== false;
}

/**
 * Which switch owns a route (expo-router segments). The most specific rule wins
 * (pets/[id]/chat → Medi Vet). The gate is the safety net for deep links, notification taps
 * and anything that still links to a paused module.
 */
export function featureForPath(segments: readonly string[]): FeatureKey | null {
  const [first, , third] = segments;
  switch (first) {
    case 'cycle':
      return 'cycle';
    case 'nutrition':
      return 'nutrition';
    case 'pets':
      // The server reports Medi Vet as off whenever pets is off, with the pets message.
      return third === 'chat' ? 'mediVet' : 'pets';
    case 'run':
    case 'medipulsi':
      return 'medirun';
    case 'medi-quest':
    case 'medi-companion':
      return 'quest';
    case 'community':
      return 'community';
    case 'pharmacy':
      return 'pharmacy';
    case 'coach':
    case 'trainer':
      return 'coach';
    case 'assistant':
    case 'chat':
    case 'symptoms':
    case 'module':
      return 'medi';
    case 'news':
      return 'news';
    default:
      return null;
  }
}

/** Route string (a Home tile, a news button) → owning switch. Groups like `(tabs)` are ignored. */
export function featureForHref(href: string): FeatureKey | null {
  const path = String(href || '').split('?')[0];
  return featureForPath(path.split('/').filter((s) => s && !s.startsWith('(')));
}

/** False when the href leads into a paused module — hide that entry. */
export function hrefAvailableIn(state: FeatureState, href: string): boolean {
  const key = featureForHref(href);
  return !key || featureOnIn(state, key);
}
