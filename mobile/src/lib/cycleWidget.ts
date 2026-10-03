/**
 * Keeps the „MEDICARD ციკლი“ Home-screen widget and the optional expected-day Live Activity in step with
 * the app (iOS, train 1.0.0.20 — the widget extension ships with the store build).
 *
 * The app writes a 14-day timeline of small, precomputed props to the app group (`group.ge.medicard.app`,
 * through expo-widgets) whenever the cycle view in the server-data cache changes, the account changes,
 * the app returns to the foreground, the cycle module is paused / resumed, or a privacy switch changes.
 * Words come from `cycleWidgetSnapshot.ts`; the widget never sees the bundle. Sign-out, another account
 * and a paused cycle module write the neutral tile at once. Without a cached view the last timeline is
 * kept (its final entry is the neutral tile, so a stale number never outlives it).
 *
 * Every call is a no-op on Android, web and binaries without the widget extension.
 */
import { AppState, Platform } from 'react-native';
import type { CycleBundle } from '@/lib/api';
import { onReturnToForeground } from '@/lib/appForeground';
import { CYCLE_QUERY_KEYS } from '@/lib/cycleQueryKeys';
import { fetchCycleView, peekCycleView } from '@/lib/cycleViewCache';
import { getCycleExpectedDayActivity, onCycleWidgetSignal, readCycleWidgetPrivacy } from '@/lib/cycleWidgetPrefs';
import {
  activityKey,
  civilDayStart,
  cycleDayActivityPlan,
  cycleWidgetDiscreet,
  cycleWidgetTimeline,
  neutralCycleWidget,
  type CycleWidgetProps,
} from '@/lib/cycleWidgetSnapshot';
import { featureState, isFeatureOn, subscribeFeatureState } from '@/lib/featureFlags';
import { getScopedPreference, localAccountId, onLocalAccountChange, setScopedPreference } from '@/lib/localAccount';
import { accountKey, FRESH, queryClient } from '@/lib/queryClient';
import { getPreference, setPreference } from '@/lib/storage';

type WidgetHandle = { updateTimeline(entries: { date: Date; props: CycleWidgetProps }[]): void };
type ActivityInstance = {
  update(props: CycleWidgetProps, staleDate?: Date): Promise<void>;
  end(policy?: 'default' | 'immediate'): Promise<void>;
};
type ActivityFactory = { start(props: CycleWidgetProps, url?: string, staleDate?: Date): ActivityInstance; getInstances(): ActivityInstance[] };

/** Timeline length: two weeks of numbers, then the neutral tile until the app writes again. */
const TIMELINE_DAYS = 14;
const DEBOUNCE_MS = 400;
/** Which expected day the Live Activity already ran for (per account) — a dismissed one never returns. */
const SHOWN_FOR_KEY = 'medicard.cycle.lockscreen.shownFor';
/** The running Live Activity, for a later process (device-wide: ended on any account change). */
const RUNNING_KEY = 'medicard.cycle.lockscreen.running';
const OWNER_KEY = 'medicard.cycle.widget.owner';
/** Background read of the cycle view for the widget: at most this often. */
const REFETCH_MS = 30 * 60 * 1000;

let widget: WidgetHandle | null = null;
let activities: ActivityFactory | null = null;
let started = false;
let lastWritten = '';
let timer: ReturnType<typeof setTimeout> | null = null;
let busy = false;
let again = false;
let running: { startedAt: number; dueDay: string; key: string; account: string } | null = null;
let instance: ActivityInstance | null = null;
let lastFetchAt = 0;

function localDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function load(): boolean {
  if (widget) return true;
  if (Platform.OS !== 'ios') return false;
  try {
    // A binary without the widget extension / native module throws here: stay silent.
    widget = require('./cycleWidgetLayout').default as WidgetHandle;
  } catch {
    widget = null;
    return false;
  }
  try {
    activities = require('./cycleDayActivityLayout').default as ActivityFactory;
  } catch {
    activities = null;
  }
  return true;
}

/** True where the widget and the Live Activity exist (the settings rows hide elsewhere). */
export function cycleLockScreenSupported(): boolean {
  return load();
}

function write(entries: { day: string; props: CycleWidgetProps }[]): void {
  if (!widget) return;
  // One entry when every day looks the same (neutral); otherwise the days, then the neutral end.
  const same = entries.every((e) => JSON.stringify(e.props) === JSON.stringify(entries[0].props));
  const list = same ? [entries[0]] : entries;
  const timeline = list.map((e) => ({ date: civilDayStart(e.day), props: e.props }));
  if (!same) {
    const last = entries[entries.length - 1];
    const end = civilDayStart(last.day);
    end.setDate(end.getDate() + 1);
    timeline.push({ date: end, props: neutralCycleWidget() });
  }
  const json = JSON.stringify(timeline.map((t) => [t.date.getTime(), t.props]));
  if (json === lastWritten) return;
  try {
    widget.updateTimeline(timeline);
    lastWritten = json;
  } catch {
    /* the extension is missing or the app group is unavailable */
  }
}

function writeNeutral(): void {
  write([{ day: localDay(), props: neutralCycleWidget() }]);
}

async function readRunning(): Promise<typeof running> {
  try {
    const raw = await getPreference(RUNNING_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.startedAt === 'number' && typeof parsed.dueDay === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

async function rememberRunning(next: typeof running): Promise<void> {
  running = next;
  await setPreference(RUNNING_KEY, next ? JSON.stringify(next) : '').catch(() => undefined);
}

function endAllActivities(): void {
  try {
    for (const old of activities?.getInstances() ?? []) void old.end('immediate').catch(() => undefined);
  } catch {
    /* iOS < 16.2 */
  }
  instance = null;
  void rememberRunning(null);
}

async function syncActivity(bundle: CycleBundle | null, today: string, discreet: boolean, available: boolean, owner: string | null) {
  if (!activities) return;
  const enabled = await getCycleExpectedDayActivity().catch(() => false);
  if (running && running.account !== owner) endAllActivities();
  const shownFor = owner ? await getScopedPreference(SHOWN_FOR_KEY).catch(() => null) : null;
  const plan = cycleDayActivityPlan({ enabled, available, bundle, today, discreet, now: Date.now(), running, shownFor });
  if (plan.action === 'end') {
    endAllActivities();
    return;
  }
  if (plan.action === 'update') {
    const current = instance ?? activities.getInstances()[0] ?? null;
    if (!current || !running) {
      await rememberRunning(null);
      return;
    }
    instance = current;
    await current.update(plan.props).catch(() => undefined);
    await rememberRunning({ ...running, key: activityKey(plan.props) });
    return;
  }
  if (plan.action === 'start' && owner) {
    // ActivityKit starts only from the foreground; the next return to the app tries again.
    if (AppState.currentState !== 'active') return;
    try {
      instance = activities.start(plan.props, plan.props.openUrl, new Date(Date.now() + 24 * 3600 * 1000));
      await rememberRunning({ startedAt: Date.now(), dueDay: plan.dueDay, key: activityKey(plan.props), account: owner });
    } catch {
      instance = null; // Live Activities switched off in Settings, or unsupported
    }
    // Once per expected day, even when iOS refused it: no retry loop on every foreground.
    await setScopedPreference(SHOWN_FOR_KEY, plan.dueDay).catch(() => undefined);
  }
}

/** The account whose cycle the widget shows now ('' = neutral). Another account never inherits it. */
async function writtenBy(): Promise<string> {
  return (await getPreference(OWNER_KEY).catch(() => null)) ?? '';
}

function setWrittenBy(owner: string): void {
  void setPreference(OWNER_KEY, owner).catch(() => undefined);
}

async function syncOnce(): Promise<void> {
  const owner = localAccountId();
  // Not known yet (cold start before the session is restored): leave the widget as it is. A real
  // sign-out arrives through the account listener, which clears it.
  if (!owner) return;
  const today = localDay();
  const shown = await writtenBy();
  if (shown && shown !== owner) {
    writeNeutral();
    setWrittenBy('');
  }
  const available = isFeatureOn('cycle', featureState());
  if (!available) {
    writeNeutral();
    setWrittenBy('');
    await syncActivity(null, today, true, false, owner);
    return;
  }
  const view = peekCycleView();
  const bundle = view?.display ?? null;
  const privacy = await readCycleWidgetPrivacy(bundle);
  if (localAccountId() !== owner) return; // switched meanwhile — the account listener re-syncs
  const discreet = cycleWidgetDiscreet(privacy);
  if (discreet) {
    writeNeutral();
  } else if (bundle) {
    write(cycleWidgetTimeline({ bundle, today, discreet, available, days: TIMELINE_DAYS }));
    setWrittenBy(owner);
  } else if (shown === owner && Date.now() - lastFetchAt > REFETCH_MS) {
    // Her widget shows a cycle but nothing is cached in this process yet (another Home layout, a cold
    // start): read the view once in a while so the numbers stay right. The cache event re-syncs.
    lastFetchAt = Date.now();
    void queryClient
      .fetchQuery({ queryKey: accountKey(...CYCLE_QUERY_KEYS.view), queryFn: () => fetchCycleView(owner), staleTime: FRESH.SHORT })
      .catch(() => undefined);
  }
  await syncActivity(bundle, today, discreet, available, owner);
}

/** Coalesced rewrite (cache events arrive in bursts). */
export function requestCycleWidgetSync(delay = DEBOUNCE_MS): void {
  if (!started) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void runSync();
  }, delay);
}

async function runSync(): Promise<void> {
  if (busy) {
    again = true;
    return;
  }
  busy = true;
  try {
    do {
      again = false;
      await syncOnce();
    } while (again);
  } catch {
    /* never surfaces: the widget keeps its last timeline */
  } finally {
    busy = false;
  }
}

const VIEW_KEY = JSON.stringify(CYCLE_QUERY_KEYS.view);

/** Once at startup (iOS). */
export function startCycleWidget(): void {
  if (started || !load()) return;
  started = true;
  void readRunning().then((saved) => {
    // A previous process left an activity behind: keep following it only for the same account.
    running = saved;
    if (!saved) {
      try {
        for (const old of activities?.getInstances() ?? []) void old.end('immediate').catch(() => undefined);
      } catch {
        /* iOS < 16.2 */
      }
    }
  });
  queryClient.getQueryCache().subscribe((event) => {
    const key = event?.query?.queryKey;
    if (!Array.isArray(key) || key[0] !== 'acct' || key[1] !== localAccountId()) return;
    if (JSON.stringify(key.slice(2)) !== VIEW_KEY) return;
    if (event.type === 'updated' || event.type === 'added' || event.type === 'removed') requestCycleWidgetSync();
  });
  onLocalAccountChange((next, previous) => {
    // Sign-out / another account: nothing of the previous person stays on the screen, not even briefly.
    // (A session restored at launch — nobody → the same person — keeps her widget; syncOnce checks.)
    if (previous || !next) {
      lastWritten = '';
      writeNeutral();
      setWrittenBy('');
      endAllActivities();
    }
    requestCycleWidgetSync(0);
  });
  subscribeFeatureState(() => requestCycleWidgetSync());
  onCycleWidgetSignal(() => requestCycleWidgetSync(0));
  void import('@/lib/cycleReminderPrefs').then(({ subscribeCyclePrivacyLock }) => subscribeCyclePrivacyLock(() => requestCycleWidgetSync(0)));
  onReturnToForeground(() => requestCycleWidgetSync(0));
  requestCycleWidgetSync(0);
}
