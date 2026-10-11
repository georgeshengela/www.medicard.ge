import { useEffect } from 'react';
import { api } from '@/lib/api';
import { FRESH, queryClient, accountKey } from '@/lib/queryClient';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { isFeatureOn } from '@/lib/featureFlags';
import { configureMixer } from './sleepAudio';
import { rememberSleepPlan, syncSleepReminders } from './sleepReminders';
import { rememberLastNightForWidget, signalSleepWidget } from './sleepWidget';
import type { SleepCatalog, SleepHub, SleepInsights, SleepPlan } from './sleepTypes';

export function useSleepHub(enabled = true) {
  return useAccountQuery<SleepHub>({ key: ['sleep', 'hub'], fetch: () => api.sleep.hub(), staleTime: FRESH.SHORT, enabled });
}

export function useSleepCatalog(enabled = true) {
  return useAccountQuery<SleepCatalog>({ key: ['sleep', 'sounds'], fetch: () => api.sleep.sounds(), staleTime: FRESH.LONG, enabled });
}

export function useSleepInsights(days: 7 | 30 | 90 | 365) {
  return useAccountQuery<SleepInsights>({ key: ['sleep', 'insights', days], fetch: () => api.sleep.insights(days), staleTime: FRESH.SHORT });
}

let lastPlanJson = '';

/** What the phone keeps from the hub: the plan (reminders, widget), last night (widget), mixer settings. */
export function useSleepHubEffects(hub: SleepHub | undefined) {
  useEffect(() => {
    if (!hub) return;
    configureMixer(hub.config);
    const json = JSON.stringify(hub.plan);
    if (json !== lastPlanJson) {
      lastPlanJson = json;
      void rememberSleepPlan(hub.plan).then(() => syncSleepReminders(hub.plan, { featureOn: isFeatureOn('sleep') }));
    }
    const last = [...hub.nights].sort((a, b) => b.night.localeCompare(a.night))[0] ?? null;
    void rememberLastNightForWidget(last && last.night >= shiftDay(hub.today, -1) ? { night: last.night, sleptMinutes: last.sleptMinutes } : null);
  }, [hub]);
}

function shiftDay(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Saves the plan and makes every phone-side consumer follow at once (reminders, widget, cached hub). */
export async function saveSleepPlan(plan: SleepPlan): Promise<SleepPlan> {
  const { plan: saved } = await api.sleep.savePlan(plan);
  queryClient.setQueryData<SleepHub>(accountKey('sleep', 'hub'), (old) => (old ? { ...old, plan: saved } : old));
  lastPlanJson = JSON.stringify(saved);
  await rememberSleepPlan(saved);
  await syncSleepReminders(saved, { featureOn: isFeatureOn('sleep') });
  signalSleepWidget();
  return saved;
}
