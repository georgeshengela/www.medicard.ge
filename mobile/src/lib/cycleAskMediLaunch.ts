/**
 * Opening Medi from a cycle entry point (W2-8): read the privacy switches, build the cycle context
 * (`cycleMediContext`), put it and the question aside in memory (`mediHandoff`) and open the
 * consultation with only the `handoff=1` marker in the route. Nothing is sent here — the consultation
 * shows the context as a removable chip and sends it with her first question through the consented
 * `/api/ai/query` path.
 */
import { todayKey } from '@/components/cycle/CycleCalendar';
import type { CycleBundle } from '@/lib/api';
import { cycleToday } from '@/lib/cycleCanonical';
import { cycleMediContext, type CycleMediContext } from '@/lib/cycleMediContext';
import { getCycleReminderPrefs, isCyclePrivacyLockEnabled } from '@/lib/cycleReminderPrefs';
import { clearMediHandoff, mediPrefillRoute, stageMediCycleContext } from '@/lib/mediHandoff';
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

/**
 * Stage the question and the context for `question`, return the route to push. The route is
 * `/assistant?mode=doctor&handoff=1` — the question waits in memory beside the context (W2-8b: no text
 * in the URL at all, even fixed copy, so one rule covers every cycle entry point).
 */
export async function prepareCycleAskMedi(owner: string | null | undefined, bundle: CycleBundle | null | undefined, question: string): Promise<string> {
  if (!owner) {
    clearMediHandoff();
    return mediRoute({ mode: 'doctor' });
  }
  let context: CycleMediContext | null = null;
  try {
    context = await cycleMediContextFor(bundle);
  } catch {
    context = null;
  }
  const route = mediPrefillRoute(owner, question, 'doctor');
  stageMediCycleContext(owner, question, context);
  return route;
}
