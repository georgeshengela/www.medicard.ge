import { useCallback, useState } from 'react';
import { localAccountId } from '@/lib/localAccount';
import { api, type Medication, type ScheduledDose } from '@/lib/api';
import { syncMedicationReminders } from '@/lib/notifications';
import { loadDoseLogs } from '@/lib/medications.shared';
import type { MedicationDoseLog } from '@/types/medications';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { accountKey, FRESH, invalidate, queryClient } from '@/lib/queryClient';

type MedsSnapshot = {
  medications: Medication[];
  schedule: ScheduledDose[];
  logs: MedicationDoseLog[];
  scheduled: number | null;
};

const MEDS_KEY = ['medications'] as const;

/** One request (and one reminder reschedule) for every screen that shows medications. */
async function fetchMeds(): Promise<MedsSnapshot> {
  const owner = localAccountId();
  const [response, logs] = await Promise.all([api.medications.list(), loadDoseLogs()]);
  const scheduled =
    owner && owner === localAccountId()
      ? await syncMedicationReminders(response.schedule, response.medications, owner)
      : null;
  return { medications: response.medications, schedule: response.schedule, logs, scheduled };
}

/** After adding / editing / deleting a medication anywhere: refresh every screen that shows them. */
export function invalidateMedications() {
  return invalidate(...MEDS_KEY);
}

const EMPTY_MEDS: Medication[] = [];
const EMPTY_SCHEDULE: ScheduledDose[] = [];
const EMPTY_LOGS: MedicationDoseLog[] = [];

export function useMedications() {
  const query = useAccountQuery<MedsSnapshot>({ key: [...MEDS_KEY], fetch: fetchMeds, staleTime: FRESH.SHORT });
  const [refreshing, setRefreshing] = useState(false);

  // Dose logs live on the device; keep the cached copy in step when a screen records a dose.
  const setDoseLogs = useCallback((next: MedicationDoseLog[] | ((prev: MedicationDoseLog[]) => MedicationDoseLog[])) => {
    queryClient.setQueryData<MedsSnapshot>(accountKey(...MEDS_KEY), (old) => {
      if (!old) return old;
      const logs = typeof next === 'function' ? next(old.logs) : next;
      return { ...old, logs };
    });
  }, []);

  /** Explicit reload (after a change on this screen): always goes to the server. */
  const { refetch } = query;
  const load = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return {
    medications: query.data?.medications ?? EMPTY_MEDS,
    schedule: query.data?.schedule ?? EMPTY_SCHEDULE,
    doseLogs: query.data?.logs ?? EMPTY_LOGS,
    setDoseLogs,
    reminderCount: query.data?.scheduled ?? null,
    refreshing,
    loading: query.isPending && query.fetchStatus !== 'idle',
    load,
    onRefresh,
  };
}
