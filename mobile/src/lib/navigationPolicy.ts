/**
 * One page, one place in the history (owner 2026-10-10: a back swipe often showed the same page
 * again, and MEDIRUN sometimes landed on an empty page). Pure decisions for the router guard
 * (`navigationGuard.ts`) — no React Native imports, so `node --test` runs it.
 *
 * The app is one root stack; the four tabs live in the nested `(tabs)` stack, which holds exactly
 * one screen (the tab bar replaces it). The rules:
 *  1. the same push twice within REPEAT_MS (a double tap, two effects) opens one page;
 *  2. a push of the page already on screen does nothing;
 *  3. a push of the page right underneath (what back would show) goes back to it;
 *  4. a replace with a page already in the history goes back to it (no [list, list] after a save);
 *  5. a tab is a root: replace / navigate / dismissTo a tab goes back to the one tab root and
 *     switches the tab there; a push of a tab switches in place when a tab is on screen, and
 *     Home always returns to the root. A push of another tab from a flow (symptoms → my meds)
 *     still opens it on top, so back returns to the flow.
 * Rules 3–4 skip pages with a query: those carry one-shot intents (Medi handoff, scan type).
 */

export type NavParams = Record<string, unknown>;
export type NavRoute = { key?: string; name: string; params?: NavParams; state?: NavState };
export type NavState = { key?: string; type?: string; index?: number; routes: NavRoute[] };
export type NavHref = string | { pathname: string; params?: NavParams };
export type NavIntent = 'push' | 'navigate' | 'replace' | 'dismissTo';

export const TAB_NAMES = ['home', 'records', 'medications', 'profile'] as const;
export type TabName = (typeof TAB_NAMES)[number];

/** Two identical pushes closer than this are one tap. */
export const REPEAT_MS = 700;

export type NavPop = { target: string; count: number };
export type NavDecision =
  | { kind: 'pass' }
  | { kind: 'skip'; reason: 'repeat' | 'here' }
  | { kind: 'pop'; pop: NavPop }
  | { kind: 'tab'; tab: TabName; query: string; pops: NavPop[]; switchTab: boolean };

const ROUTER_PARAMS = new Set(['screen', 'params', 'initial', 'state', 'path', 'merge', 'pop']);
const isRouterParam = (name: string) => ROUTER_PARAMS.has(name) || name.startsWith('__') || name.startsWith('#');
const isGroup = (segment: string) => /^\(.*\)$/.test(segment);
/** expo-router wraps the app's root stack in one `__root` route; it is not part of any path. */
const ROOT_WRAPPER = '__root';

function decode(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return text;
  }
}

function paramText(value: unknown): string | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(String).join(',');
  return String(value);
}

function pathSegments(path: string): string[] {
  return path
    .split('/')
    .map(decode)
    .filter((segment) => segment && segment !== 'index' && !isGroup(segment));
}

function queryText(entries: [string, string][]): string {
  return entries
    .filter(([name]) => !isRouterParam(name))
    .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : av > bv ? 1 : 0) : a < b ? -1 : 1))
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&');
}

function keyOf(segments: string[], query: string): string {
  return '/' + segments.join('/') + (query ? '?' + query : '');
}

/**
 * „/path?sorted=query“ for an app href (groups and `index` dropped), or null when the guard
 * should not judge it (relative, external, malformed).
 */
export function hrefKey(href: NavHref): string | null {
  if (typeof href === 'string') {
    if (!href.startsWith('/') || href.startsWith('//')) return null;
    const [beforeHash] = href.split('#');
    const at = beforeHash.indexOf('?');
    const path = at >= 0 ? beforeHash.slice(0, at) : beforeHash;
    const search = at >= 0 ? beforeHash.slice(at + 1) : '';
    const entries = search
      .split('&')
      .filter(Boolean)
      .map((pair): [string, string] => {
        const eq = pair.indexOf('=');
        return eq >= 0 ? [decode(pair.slice(0, eq)), decode(pair.slice(eq + 1))] : [decode(pair), ''];
      });
    return keyOf(pathSegments(path), queryText(entries));
  }
  if (!href || typeof href.pathname !== 'string' || !href.pathname.startsWith('/')) return null;
  const params = href.params ?? {};
  const used = new Set<string>();
  const segments: string[] = [];
  for (const raw of href.pathname.split('/')) {
    const match = /^\[(\.\.\.)?([^\]]+)\]$/.exec(raw);
    if (!match) {
      segments.push(...pathSegments(raw));
      continue;
    }
    used.add(match[2]);
    const value = params[match[2]];
    if (value == null) return null;
    segments.push(...(Array.isArray(value) ? value.map(String) : String(value).split('/')));
  }
  const entries = Object.entries(params)
    .filter(([name]) => !used.has(name))
    .map(([name, value]): [string, string | null] => [name, paramText(value)])
    .filter((entry): entry is [string, string] => entry[1] != null);
  return keyOf(segments, queryText(entries));
}

function focusedIndex(state: NavState): number {
  const last = state.routes.length - 1;
  return Math.min(Math.max(state.index ?? last, 0), last);
}

/** A nested navigator's state, or the one a fresh `{ screen, params }` route is about to mount. */
function childState(route: NavRoute): NavState | undefined {
  if (route.state?.routes?.length) return route.state;
  const screen = route.params?.screen;
  if (typeof screen !== 'string') return undefined;
  return { routes: [{ name: screen, params: (route.params?.params as NavParams | undefined) ?? {} }] };
}

function focusedTail(route: NavRoute): NavRoute[] {
  const chain = [route];
  for (let state = childState(route); state; ) {
    const next: NavRoute = state.routes[focusedIndex(state)];
    chain.push(next);
    state = childState(next);
  }
  return chain;
}

/** The page key of a chain of routes from the root navigator down to a screen. */
export function chainKey(chain: NavRoute[]): string {
  const leaf = chain[chain.length - 1];
  const used = new Set<string>();
  const segments: string[] = [];
  chain.forEach((route, at) => {
    for (const raw of route.name.split('/')) {
      if (!raw || raw === 'index' || raw === ROOT_WRAPPER || isGroup(raw)) continue;
      const match = /^\[(\.\.\.)?([^\]]+)\]$/.exec(raw);
      if (!match) {
        segments.push(raw);
        continue;
      }
      used.add(match[2]);
      const value = [chain[at], leaf, ...chain].map((r) => r?.params?.[match[2]]).find((v) => v != null);
      if (value == null) segments.push(raw);
      else segments.push(...(Array.isArray(value) ? value.map(String) : String(value).split('/')));
    }
  });
  const entries = Object.entries(leaf?.params ?? {})
    .filter(([name]) => !used.has(name))
    .map(([name, value]): [string, string | null] => [name, paramText(value)])
    .filter((entry): entry is [string, string] => entry[1] != null);
  return keyOf(segments, queryText(entries));
}

type Level = { state: NavState; index: number; prefix: NavRoute[] };

function levelsOf(root: NavState): Level[] {
  const levels: Level[] = [];
  const prefix: NavRoute[] = [];
  for (let state: NavState | undefined = root; state?.routes?.length; ) {
    const index = focusedIndex(state);
    levels.push({ state, index, prefix: [...prefix] });
    const route: NavRoute = state.routes[index];
    prefix.push(route);
    state = childState(route);
  }
  return levels;
}

/** The page on screen. */
export function currentPageKey(root: NavState | null | undefined): string | null {
  if (!root?.routes?.length) return null;
  const levels = levelsOf(root);
  const last = levels[levels.length - 1];
  return chainKey([...last.prefix, last.state.routes[last.index]]);
}

/** Pages under the one on screen, nearest first (the first is what back shows), with how to return. */
export function historyPages(root: NavState): { key: string; pop: NavPop }[] {
  const pages: { key: string; pop: NavPop }[] = [];
  const levels = levelsOf(root);
  for (let depth = levels.length - 1; depth >= 0; depth--) {
    const { state, index, prefix } = levels[depth];
    if (state.type !== 'stack' || !state.key) continue;
    for (let at = index - 1; at >= 0; at--) {
      pages.push({
        key: chainKey([...prefix, ...focusedTail(state.routes[at])]),
        pop: { target: state.key, count: index - at },
      });
    }
  }
  return pages;
}

function splitKey(key: string): { path: string; query: string } {
  const at = key.indexOf('?');
  return at >= 0 ? { path: key.slice(0, at), query: key.slice(at) } : { path: key, query: '' };
}

export function tabOfKey(key: string): TabName | null {
  const { path } = splitKey(key);
  return (TAB_NAMES as readonly string[]).find((tab) => path === '/' + tab) as TabName | undefined ?? null;
}

/** The app's root stack: the navigator under expo-router's `__root` wrapper. */
function appRoot(root: NavState): NavState {
  const only = root.routes.length === 1 ? root.routes[0] : null;
  return only?.name === ROOT_WRAPPER && only.state?.routes?.length ? only.state : root;
}

function tabDecision(intent: NavIntent, tab: TabName, query: string, container: NavState): NavDecision {
  const root = appRoot(container);
  const first = root.routes.findIndex((route) => route.name === '(tabs)');
  if (first < 0) return { kind: 'pass' };
  const rootIndex = focusedIndex(root);
  const onTab = root.routes[rootIndex]?.name === '(tabs)';
  // A push of another tab from a flow opens it on top: back returns to the flow.
  if (intent === 'push' && !onTab && tab !== 'home') return { kind: 'pass' };
  // The tab on screen switches in place for a push; everything else returns to the first tab root.
  const at = intent === 'push' && onTab ? rootIndex : first;
  const pops: NavPop[] = [];
  if (rootIndex > at) {
    if (!root.key) return { kind: 'pass' };
    pops.push({ target: root.key, count: rootIndex - at });
  }
  const tabsRoute = root.routes[at];
  const tabs = childState(tabsRoute);
  let shown: string | undefined;
  if (tabs?.routes.length) {
    // Older builds could stack tabs inside (tabs); fold them back to its first screen.
    const tabsIndex = focusedIndex(tabs);
    if (tabsIndex > 0 && tabs.key) pops.push({ target: tabs.key, count: tabsIndex });
    shown = tabsIndex > 0 && tabs.key ? tabs.routes[0].name : tabs.routes[tabsIndex].name;
  }
  const switchTab = shown !== tab || query !== '';
  if (!pops.length && !switchTab) return { kind: 'skip', reason: 'here' };
  return { kind: 'tab', tab, query, pops, switchTab };
}

export function decideNavigation(input: {
  intent: NavIntent;
  href: NavHref;
  root: NavState | null | undefined;
  recent: { key: string; at: number } | null;
  /** A router call is still queued (the state has not caught up): judge nothing but repeats. */
  pending: boolean;
  now: number;
}): { decision: NavDecision; key: string | null } {
  const { intent, href, root, recent, pending, now } = input;
  const key = hrefKey(href);
  const opens = intent === 'push' || intent === 'navigate';
  if (!key) return { decision: { kind: 'pass' }, key };
  if (opens && recent && recent.key === key && now - recent.at >= 0 && now - recent.at < REPEAT_MS) {
    return { decision: { kind: 'skip', reason: 'repeat' }, key };
  }
  if (pending || !root?.routes?.length) return { decision: { kind: 'pass' }, key };

  const tab = tabOfKey(key);
  if (tab) return { decision: tabDecision(intent, tab, splitKey(key).query, root), key };
  if (intent === 'dismissTo') return { decision: { kind: 'pass' }, key };

  if (opens && key === currentPageKey(root)) return { decision: { kind: 'skip', reason: 'here' }, key };
  if (splitKey(key).query) return { decision: { kind: 'pass' }, key };

  const history = historyPages(root);
  if (opens) {
    const below = history[0];
    if (below && below.key === key && below.pop.count === 1) return { decision: { kind: 'pop', pop: below.pop }, key };
    return { decision: { kind: 'pass' }, key };
  }
  const earlier = history.find((page) => page.key === key);
  if (earlier) return { decision: { kind: 'pop', pop: earlier.pop }, key };
  return { decision: { kind: 'pass' }, key };
}
