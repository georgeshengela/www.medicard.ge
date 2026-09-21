import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localAccountId } from '@/lib/localAccount';
import { useFocusEffect } from 'expo-router';
import { api, type Medication, type ScheduledDose } from '@/lib/api';
import { syncMedicationReminders } from '@/lib/notifications';
import { loadDoseLogs } from '@/lib/medications.shared';
import type { MedicationDoseLog } from '@/types/medications';

export function useMedications() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [schedule, setSchedule] = useState<ScheduledDose[]>([]);
  const [doseLogs, setDoseLogs] = useState<MedicationDoseLog[]>([]);
  const [reminderCount, setReminderCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const owner = localAccountId();
    if (!owner) return;
    try {
      const [response, logs] = await Promise.all([api.medications.list(), loadDoseLogs()]);
      if (owner !== localAccountId()) return;
      setMedications(response.medications);
      setSchedule(response.schedule);
      setDoseLogs(logs);
      const scheduled = await syncMedicationReminders(response.schedule, response.medications, owner);
      if (owner === localAccountId()) setReminderCount(scheduled);
    } catch {
      /* pull-to-refresh is retry */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => subscription.remove();
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
