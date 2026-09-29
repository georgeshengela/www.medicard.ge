import { useCallback, useEffect, useState } from 'react';
import { onReturnToForeground } from '@/lib/appForeground';
import { localAccountId } from '@/lib/localAccount';
import { useFocusEffect } from 'expo-router';
import { api, type Medication, type ScheduledDose } from '@/lib/api';
import { syncMedicationReminders } from '@/lib/notifications';
import { loadDoseLogs } from '@/lib/medications.shared';
import type { MedicationDoseLog } from '@/types/medications';

type MedsSnapshot = {
  response: Awaited<ReturnType<typeof api.medications.list>>;
  logs: MedicationDoseLog[];
  scheduled: number;
};

/**
 * Up to 7 screens use this hook and stay mounted in the stack. Focus / foreground loads that start
 * while another instance is already loading share its request (and its reminder reschedule)
 * instead of each firing their own. Explicit loads (after a change, pull-to-refresh) never share.
 */
let sharedLoad: { owner: string; promise: Promise<MedsSnapshot> } | null = null;

function fetchMeds(owner: string): Promise<MedsSnapshot> {
  return (async () => {
    const [response, logs] = await Promise.all([api.medications.list(), loadDoseLogs()]);
    const scheduled = owner === localAccountId() ? await syncMedicationReminders(response.schedule, response.medications, owner) : 0;
    return { response, logs, scheduled };
  })();
}

function loadMeds(owner: string, share: boolean): Promise<MedsSnapshot> {
  if (share && sharedLoad?.owner === owner) return sharedLoad.promise;
  const promise = fetchMeds(owner);
  const entry = { owner, promise };
  sharedLoad = entry;
  void promise.catch(() => undefined).finally(() => {
    if (sharedLoad === entry) sharedLoad = null;
  });
  return promise;
}

export function useMedications() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [schedule, setSchedule] = useState<ScheduledDose[]>([]);
  const [doseLogs, setDoseLogs] = useState<MedicationDoseLog[]>([]);
  const [reminderCount, setReminderCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (opts: { share?: boolean } = {}) => {
    const owner = localAccountId();
    if (!owner) return;
    try {
      const { response, logs, scheduled } = await loadMeds(owner, Boolean(opts.share));
      if (owner !== localAccountId()) return;
      setMedications(response.medications);
      setSchedule(response.schedule);
      setDoseLogs(logs);
      setReminderCount(scheduled);
    } catch {
      /* pull-to-refresh is retry */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load({ share: true });
    }, [load]),
  );

  useEffect(() => {
    return onReturnToForeground(() => void load({ share: true }));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return {
    medications,
    schedule,
    doseLogs,
    setDoseLogs,
    reminderCount,
    refreshing,
    loading,
    load,
    onRefresh,
  };
}
