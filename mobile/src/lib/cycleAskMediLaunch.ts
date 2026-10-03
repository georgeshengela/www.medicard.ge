/**
 * Opening Medi from a cycle entry point (W2-8): read the privacy switches, build the cycle context
 * (`cycleMediContext`), put it aside in memory (`mediHandoff`) and open the consultation with only the
 * question in the route. Nothing is sent here — the consultation shows the context as a removable chip
 * and sends it with her first question through the consented `/api/ai/query` path.
 */
import { todayKey } from '@/components/cycle/CycleCalendar';
import type { CycleBundle } from '@/lib/api';
import { cycleToday } from '@/lib/cycleCanonical';
import { cycleMediContext, type CycleMediContext } from '@/lib/cycleMediContext';
import { getCycleReminderPrefs, isCyclePrivacyLockEnabled } from '@/lib/cycleReminderPrefs';
import { clearMediHandoff, stageMediCycleContext } from '@/lib/mediHandoff';
import { loadEngagePrefs } from '@/lib/mediEngagePrefs';
import { mediRoute } from '@/lib/mediModes';

/** Lock, privacy mode and discreet / masked notifications — any of them means „no context“. */
async function privacySwitches(bundle: CycleBundle | null | undefined): Promise<{ locked: boolean | null; privacy: boolean }> {
  try {
    const [locked, engage, prefs] = await Promise.all([
      isCyclePrivacyLockEnabled(),
      loadEngagePrefs(),
      getCycleReminderPrefs({ mode: bundle?.profile?.mode ?? null }),
    ]);
    return { locked, privacy: Boolean(bundle?.profile?.privacyEnabled) || Boolean(engage.discreet) || Boolean(prefs.maskNotifications) };
  } catch {
    // A switch that cannot be read counts as on.
    return { locked: null, privacy: true };
  }
}

/** The context this account would hand over right now (null = only the question goes). */
export async function cycleMediContextFor(bundle: CycleBundle | null | undefined): Promise<CycleMediContext | null> {
  if (!bundle) return null;
  const { locked, privacy } = await privacySwitches(bundle);
  return cycleMediContext({ bundle, today: cycleToday(bundle, todayKey()), locked, privacy });
}

/** Stage the context for `question` and return the route to push (`/assistant?mode=doctor&prefill=…`). */
export async function prepareCycleAskMedi(owner: string | null | undefined, bundle: CycleBundle | null | undefined, question: string): Promise<string> {
  const route = mediRoute({ mode: 'doctor', prefill: question });
  if (!owner) {
    clearMediHandoff();
    return route;
  }
  try {
    stageMediCycleContext(owner, question, await cycleMediContextFor(bundle));
  } catch {
    clearMediHandoff();
  }
  return route;
}
