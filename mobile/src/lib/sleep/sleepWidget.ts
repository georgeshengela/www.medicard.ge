/**
 * Writes the MEDISLEEP widget's timeline (layout: sleepWidgetLayout.tsx). Entries change by the clock — the
 * wind-down, the bedtime, the wake-up — so the lock screen stays right without the app running. Rewritten when
 * the plan, last night or sleep mode changes, on foreground and on account change. iOS with the widget
 * extension only; elsewhere every call is a no-op.
 */
import { AppState, Platform } from 'react-native';
import { expoWidgetsAvailable } from '@/lib/nativeWidgets';
import { tx } from '@/i18n/locale';
import { getScopedPreference, localAccountId, onLocalAccountChange, setScopedPreference } from '@/lib/localAccount';
import { EMPTY_SLEEP_WIDGET as EMPTY, sleepWidgetTimeline } from './sleepWidgetSnapshot';
import type { SleepWidgetProps } from './sleepWidgetLayout';

type WidgetHandle = { updateTimeline(entries: { date: Date; props: Partial<SleepWidgetProps> }[]): void };

const LAST_NIGHT_KEY = 'medicard.sleep.widget.lastNight.v1';

let widget: WidgetHandle | null = null;
let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastJson = '';

function load(): boolean {
  if (widget) return true;
  if (Platform.OS !== 'ios' || !expoWidgetsAvailable()) return false;
  try {
    widget = require('./sleepWidgetLayout').default as WidgetHandle;
    return true;
  } catch {
    widget = null;
    return false;
  }
}

/** Last night as the hub last saw it (slept minutes only — the widget shows nothing else of her data). */
export async function rememberLastNightForWidget(night: { night: string; sleptMinutes: number | null } | null): Promise<void> {
  await setScopedPreference(LAST_NIGHT_KEY, night ? JSON.stringify(night) : '').catch(() => undefined);
  signalSleepWidget();
}

async function lastNight(): Promise<{ night: string; sleptMinutes: number | null } | null> {
  try {
    const raw = await getScopedPreference(LAST_NIGHT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function write() {
  if (!load()) return;
  const owner = localAccountId();
  if (!owner) {
    if (lastJson !== 'signed-out') {
      lastJson = 'signed-out';
      widget!.updateTimeline([{ date: new Date(), props: EMPTY }]);
    }
    return;
  }
  const { rememberedSleepPlan } = await import('./sleepReminders');
  const { sleepSession } = await import('./sleepSession');
  const { isFeatureOn } = await import('@/lib/featureFlags');
  const plan = isFeatureOn('sleep') ? await rememberedSleepPlan() : null;
  const s = sleepSession();
  const entries = sleepWidgetTimeline(plan, await lastNight(), s ? { startedAt: s.startedAt, alarmAt: s.alarmAt } : null, new Date());
  const json = JSON.stringify(entries.map((e) => [e.date.getTime(), e.props]));
  if (json === lastJson) return;
  lastJson = json;
  try {
    widget!.updateTimeline(entries);
  } catch {
    /* widget extension missing */
  }
}

/** Something the widget shows changed: rewrite shortly (coalesced). */
export function signalSleepWidget() {
  if (Platform.OS !== 'ios') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void write().catch(() => undefined);
  }, 400);
}

/** Once at startup (iOS). */
export function startSleepWidget() {
  if (started || !load()) return;
  started = true;
  onLocalAccountChange(() => {
    lastJson = '';
    signalSleepWidget();
  });
  AppState.addEventListener('change', (next) => {
    if (next === 'active') signalSleepWidget();
  });
  signalSleepWidget();
}

export { sleepWidgetTimeline };
