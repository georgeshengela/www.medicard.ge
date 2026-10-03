/**
 * Pure part of the admin module switches (no React, no storage) so node tests can load it.
 * The store and hooks live in featureFlags.ts.
 */
/** Every switch the app acts on (server: `server/src/lib/featureFlags.js` FEATURES — a test keeps them in sync). */
export const FEATURE_KEYS = [
  'cycle',
  'nutrition',
  'nutritionAi',
  'medi',
  'mediDoctor',
  'mediDeep',
  'symptoms',
  'imaging',
  'skin',
  'voice',
  'pets',
  'mediVet',
  'medirun',
  'quest',
  'rewardsStore',
  'coach',
  'community',
  'pharmacy',
  'news',
  'visits',
  'medications',
  'records',
  'labs',
  'hydration',
  'steps',
  'weight',
  'weather',
  'weeklyReport',
  'healthPassport',
  'invites',
  'homeLayouts',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

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
 * (pets/[id]/chat → MEDIVET, health-metrics/steps → steps). Groups such as `(tabs)` are not part
 * of the URL and are skipped. The gate is the safety net for deep links, notification taps and
 * anything that still links to a paused module. The server reports a child as off whenever its
 * parent is off (Medi → symptoms, pets → MEDIVET), so one key per route is enough.
 */
export function featureForPath(segments: readonly string[]): FeatureKey | null {
  const [first, second, third] = segments.filter((s) => s && !s.startsWith('('));
  switch (first) {
    case 'cycle':
      return 'cycle';
    case 'nutrition':
      return 'nutrition';
    case 'pets':
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
      // The mode lives in the query (?mode=doctor|deep): see featureForHref. /assistant itself
      // falls back to the regular Medi chat when a mode is paused.
      return 'medi';
    case 'symptoms':
      return 'symptoms';
    case 'scan':
      // MEDISCAN: the choice lives in the query (?type=lab|imaging|skin), see featureForHref. The screen
      // itself only offers the choices that are on.
      return null;
    case 'module':
      if (second === 'lab') return 'labs';
      if (second === 'imaging') return 'imaging';
      if (second === 'skin' || second === 'skincare') return 'skin';
      return 'medi';
    case 'lab':
      return 'labs';
    case 'news':
      return 'news';
    case 'visits':
      return 'visits';
    case 'medications':
      return 'medications';
    case 'records':
    case 'record':
      return 'records';
    case 'health-metrics':
      // The index lists several metrics; each one hides its own block there.
      if (second === 'hydration') return 'hydration';
      if (second === 'steps') return 'steps';
      if (second === 'weight') return 'weight';
      return null;
    case 'weather':
      return 'weather';
    case 'week':
      return 'weeklyReport';
    case 'profile':
      if (second === 'health-passport') return 'healthPassport';
      if (second === 'invite' || second === 'invite-code') return 'invites';
      return null;
    case 'invite':
      return 'invites';
    default:
      return null;
  }
}

/** Medi's mode from a query string, accepting every historic spelling (see mediModes.ts). */
function mediModeKey(query: string): FeatureKey {
  const mode = (/(?:^|&)mode=([^&#]*)/.exec(query)?.[1] ?? '').trim().toLowerCase();
  if (mode === 'doctor') return 'mediDoctor';
  if (mode === 'deep' || mode === 'consilium') return 'mediDeep';
  return 'medi';
}

/**
 * Route string (a Home tile, a news button, a Medi handoff) → owning switch. Groups like `(tabs)`
 * are ignored; `/assistant?mode=deep` belongs to Medi's deep analysis, `/assistant` to Medi.
 */
export function featureForHref(href: string): FeatureKey | null {
  const [path, query = ''] = String(href || '').split('#')[0].split('?');
  const segments = path.split('/').filter((s) => s && !s.startsWith('('));
  if (segments[0] === 'scan') {
    const type = (/(?:^|&)type=([^&#]*)/.exec(query)?.[1] ?? '').trim().toLowerCase();
    return type === 'lab' || type === 'labs' ? 'labs' : type === 'imaging' ? 'imaging' : type === 'skin' ? 'skin' : null;
  }
  const key = featureForPath(segments);
  if (key !== 'medi') return key;
  if (segments[0] === 'assistant') return mediModeKey(query);
  if (segments[0] === 'chat' && segments[1]) {
    // Legacy /chat/<mode>: anything that is not deep analysis opens the doctor mode (legacyChatRouteToMedi).
    return mediModeKey(`mode=${segments[1]}`) === 'mediDeep' ? 'mediDeep' : 'mediDoctor';
  }
  return key;
}

/** False when the href leads into a paused module — hide that entry. */
export function hrefAvailableIn(state: FeatureState, href: string): boolean {
  const key = featureForHref(href);
  return !key || featureOnIn(state, key);
}

/**
 * Notification Brain families that exist for one module only. While that module is paused the
 * family is not scheduled (and not shown if it fires in the foreground). Medication and visit
 * reminders the person set are not engage families and are never touched by a switch.
 * Each family here has a topic of its own (checked by a test), so switching one off silences nothing else.
 */
export const ENGAGE_FAMILY_FEATURES: ReadonlyMap<string, FeatureKey> = new Map<string, FeatureKey>([
  ['weatherWellness', 'weather'],
  ['weekly', 'weeklyReport'],
  // "Medi can now sum up your week" — it opens the weekly report.
  ['feature', 'weeklyReport'],
  ['visitFollowup', 'visits'],
  ['hydration', 'hydration'],
  ['stepsQuiet', 'steps'],
]);

export function engageFamilyOnIn(state: FeatureState, family: string): boolean {
  const key = ENGAGE_FAMILY_FEATURES.get(family);
  return !key || featureOnIn(state, key);
}
