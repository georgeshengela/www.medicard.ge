/**
 * Device switches for the cycle widget and the expected-day Live Activity (train 1.0.0.20), plus the
 * one place that reads every privacy switch the widget obeys. Both switches live on this phone only
 * (like the Face ID / PIN cycle lock): the widget and the Live Activity are this phone's screens.
 *
 * `signalCycleWidget()` asks the widget controller (`cycleWidget.ts`) to rewrite at once — called
 * whenever a switch it reads changes (cycle reminder mask, Medi's discreet notifications, these two).
 */
import type { CycleBundle } from '@/lib/api';
import { getPreference, setPreference } from '@/lib/storage';

export const CYCLE_WIDGET_PREF_KEYS = {
  /** Her own „დამალე ციკლი ვიჯეტზე“ — on = the neutral tile even without the lock. */
  discreet: 'medicard.cycle.widget.discreet',
  /** „სავარაუდო დღე ჩაკეტილ ეკრანზე“ — off by default. */
  expectedDay: 'medicard.cycle.lockscreen.expectedDay',
} as const;

const signalListeners = new Set<() => void>();

export function signalCycleWidget(): void {
  signalListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* never blocks the caller */
    }
  });
}

export function onCycleWidgetSignal(fn: () => void): () => void {
  signalListeners.add(fn);
  return () => {
    signalListeners.delete(fn);
  };
}

export async function getCycleWidgetDiscreet(): Promise<boolean> {
  return (await getPreference(CYCLE_WIDGET_PREF_KEYS.discreet)) === '1';
}

export async function setCycleWidgetDiscreet(on: boolean): Promise<void> {
  await setPreference(CYCLE_WIDGET_PREF_KEYS.discreet, on ? '1' : '0');
  signalCycleWidget();
}

export async function getCycleExpectedDayActivity(): Promise<boolean> {
  return (await getPreference(CYCLE_WIDGET_PREF_KEYS.expectedDay)) === '1';
}

export async function setCycleExpectedDayActivity(on: boolean): Promise<void> {
  await setPreference(CYCLE_WIDGET_PREF_KEYS.expectedDay, on ? '1' : '0');
  signalCycleWidget();
}

export type CycleWidgetPrivacyInputs = {
  lockOn: boolean | null;
  privacyEnabled: boolean | null | undefined;
  maskNotifications: boolean | null;
  engageDiscreet: boolean | null;
  widgetDiscreet: boolean | null;
};

/** Every switch the widget obeys; one that cannot be read is `null` (= counts as on). */
export async function readCycleWidgetPrivacy(bundle: CycleBundle | null | undefined): Promise<CycleWidgetPrivacyInputs> {
  const settle = async <T,>(work: () => Promise<T>): Promise<T | null> => {
    try {
      return await work();
    } catch {
      return null;
    }
  };
  // Lazy: these pull in notification / engage modules the widget controller does not need at start.
  const [{ getCycleReminderPrefs, isCyclePrivacyLockEnabled }, { loadEngagePrefs }] = await Promise.all([
    import('@/lib/cycleReminderPrefs'),
    import('@/lib/mediEngagePrefs'),
  ]);
  const [lockOn, prefs, engage, widgetDiscreet] = await Promise.all([
    settle(() => isCyclePrivacyLockEnabled()),
    settle(() => getCycleReminderPrefs({ mode: bundle?.profile?.mode ?? null })),
    settle(() => loadEngagePrefs()),
    settle(() => getCycleWidgetDiscreet()),
  ]);
  return {
    lockOn,
    privacyEnabled: bundle ? Boolean(bundle.profile?.privacyEnabled) : null,
    maskNotifications: prefs ? Boolean(prefs.maskNotifications) : null,
    engageDiscreet: engage ? Boolean(engage.discreet) : null,
    widgetDiscreet,
  };
}
