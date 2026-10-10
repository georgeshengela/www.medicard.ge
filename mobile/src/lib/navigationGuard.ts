import { router } from 'expo-router';
import { currentPageKey, decideNavigation, type NavHref, type NavIntent, type NavPop, type NavState } from './navigationPolicy';

/**
 * Every `router.push / navigate / replace / dismissTo` in the app passes through the rules in
 * `navigationPolicy.ts` (owner 2026-10-10: back swipes showed the same page twice). `useRouter()`
 * and `import { router }` return the same object, so wrapping it once covers all call sites.
 * A call with options (relative, anchor, singular) and any failure fall back to expo-router as is.
 */

type NavigationRef = {
  isReady(): boolean;
  getRootState(): unknown;
  dispatch(action: { type: string; payload?: object; target?: string }): void;
  addListener(type: 'state', listener: () => void): () => void;
};

type Push = typeof router.push;
type Replace = typeof router.replace;
type Navigate = typeof router.navigate;
type DismissTo = typeof router.dismissTo;

/** A queued expo-router call older than this has either landed or done nothing. */
const PENDING_MS = 700;

let ref: NavigationRef | null = null;
let offState: (() => void) | null = null;
let installed = false;
let pendingAt = 0;
let recent: { key: string; at: number; landed: boolean } | null = null;

function readRoot(): NavState | null {
  if (!ref?.isReady()) return null;
  const root = ref.getRootState() as NavState | undefined;
  return root?.routes?.length ? root : null;
}

function onState() {
  pendingAt = 0;
  if (!recent) return;
  // Once the page from the last call has been on screen and is left again, the same tap is new.
  const here = currentPageKey(readRoot()) === recent.key;
  if (here) recent.landed = true;
  else if (recent.landed) recent = null;
}

function pop({ target, count }: NavPop) {
  ref?.dispatch({ type: 'POP', payload: { count }, target });
}

function hasOptions(options: unknown): boolean {
  return Boolean(options && typeof options === 'object' && Object.keys(options).length);
}

function guarded(intent: NavIntent, href: NavHref, original: () => void, switchTab: (href: string) => void) {
  let decided: ReturnType<typeof decideNavigation>;
  const now = Date.now();
  try {
    decided = decideNavigation({
      intent,
      href,
      root: readRoot(),
      recent,
      pending: pendingAt > 0 && now - pendingAt < PENDING_MS,
      now,
    });
  } catch {
    pendingAt = now;
    original();
    return;
  }
  const { decision, key } = decided;
  if (decision.kind === 'skip') return;
  if (key) recent = { key, at: now, landed: false };
  try {
    if (decision.kind === 'pop') {
      pop(decision.pop);
      return;
    }
    if (decision.kind === 'tab') {
      decision.pops.forEach(pop);
      if (decision.switchTab) {
        pendingAt = now;
        switchTab(`/(tabs)/${decision.tab}${decision.query}`);
      }
      return;
    }
  } catch {
    /* fall through to the call as written */
  }
  pendingAt = now;
  original();
}

/** Root layout: hands over the container ref; wraps the router on the first call. */
export function attachNavigationGuard(navigationRef: NavigationRef): void {
  if (ref !== navigationRef) {
    offState?.();
    ref = navigationRef;
    offState = navigationRef.addListener('state', onState);
  }
  if (!installed) {
    installed = true;
    const push = router.push as Push;
    const navigate = router.navigate as Navigate;
    const replace = router.replace as Replace;
    const dismissTo = router.dismissTo as DismissTo;
    const toTab = (href: string) => replace(href as never);
    const queued = <A extends unknown[], R>(call: (...args: A) => R) => (...args: A): R => {
      pendingAt = Date.now();
      return call(...args);
    };
    Object.assign(router, {
      push: ((href, options) =>
        hasOptions(options) ? queued(push)(href, options) : guarded('push', href as NavHref, () => push(href), toTab)) as Push,
      navigate: ((href, options) =>
        hasOptions(options) ? queued(navigate)(href, options) : guarded('navigate', href as NavHref, () => navigate(href), toTab)) as Navigate,
      replace: ((href, options) =>
        hasOptions(options) ? queued(replace)(href, options) : guarded('replace', href as NavHref, () => replace(href), toTab)) as Replace,
      dismissTo: ((href, options) =>
        hasOptions(options) ? queued(dismissTo)(href, options) : guarded('dismissTo', href as NavHref, () => dismissTo(href), toTab)) as DismissTo,
      back: queued(router.back),
      dismiss: queued(router.dismiss),
      dismissAll: queued(router.dismissAll),
    });
  }
}
