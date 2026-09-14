import React, { useCallback, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PetCareReminderCard } from '@/components/pets/PetCareReminderCard';
import { PetErrorText, PetFactRow, PetPageScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { api, type Pet, type PetCareSchedule } from '@/lib/api';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { reconcilePetCareReminders } from '@/lib/petCareReminders';
import { completeLabel, kindLabel, newPetsRequestId, petsCareErrorMessage, sourceLabel } from '@/lib/petsCare';
import { todayIsoLocal } from '@/lib/visitReminders';
import { useThemeColors } from '@/theme/colors';

export default function PetScheduleDetailScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id, scheduleId } = useLocalSearchParams<{ id: string; scheduleId: string }>();
  const requestId = useRef(newPetsRequestId()).current;
  const [pet, setPet] = useState<Pet | null>(null);
  const [schedule, setSchedule] = useState<PetCareSchedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !scheduleId) return;
    const [petRes, sched] = await Promise.all([api.pets.get(id), api.pets.schedules.get(id, scheduleId)]);
    setPet(petRes.pet);
    setSchedule(sched.schedule);
  }, [id, scheduleId]);

  React.useEffect(() => {
    void load().catch((caught) => setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError })));
  }, [load]);

  const complete = async () => {
    if (!id || !schedule || !schedule.nextDueOn || saving) return;
    setSaving(true);
    setError(null);
    try {
      const timePart = schedule.nextDueTime || 'date';
      const occurrenceKey = `r${schedule.revision}|${schedule.nextDueOn}|${timePart}|${schedule.nextSequence ?? 0}`;
      await api.pets.schedules.complete(id, schedule.id, {
        occurrenceKey,
        revision: schedule.revision,
        administeredOn: todayIsoLocal(),
        clientRequestId: requestId,
      });
      await reconcilePetCareReminders({ reason: 'complete' });
      await load();
    } catch (caught) {
      setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (!id || !schedule) return;
    Alert.alert(ka.pets.cancelSchedule, ka.pets.cancelScheduleBody, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.pets.cancelSchedule,
        style: 'destructive',
        onPress: async () => {
          try {
            await api.pets.schedules.cancel(id, schedule.id);
            await reconcilePetCareReminders({ reason: 'cancel' });
            router.replace(`/pets/${id}/care`);
          } catch (caught) {
            setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
          }
        },
      },
    ]);
  };

  if (!schedule) {
    return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;
  }

  return (
    <>
      <Stack.Screen options={{ title: schedule.title }} />
      <PetPageScroll>
        <PetErrorText message={error} />
        <Card>
          <PetFactRow label={ka.pets.careKind} value={kindLabel(schedule.kind, ka.pets)} />
          <PetFactRow
            label={ka.pets.upcomingCare}
            value={schedule.nextDueOn ? formatCycleDateKa(schedule.nextDueOn) : ka.pets.noUpcoming}
          />
          <PetFactRow label={ka.pets.source} value={sourceLabel(schedule.source, ka.pets)} last />
          <Text className="mt-3 text-sm text-text-300">{ka.pets.plannedDisclaimer}</Text>
        </Card>
        <Card>
          <PetCareReminderCard petId={id} schedule={schedule} onSchedule={setSchedule} onError={setError} />
        </Card>
        {schedule.status === 'ACTIVE' && schedule.nextDueOn ? (
          <Button label={completeLabel(schedule.kind, ka.pets)} loading={saving} onPress={() => void complete()} />
        ) : null}
        {schedule.status === 'ACTIVE' ? (
          <Button label={ka.pets.cancelSchedule} variant="danger" onPress={cancel} />
        ) : (
          <Text className="text-sm text-text-300">{ka.pets.scheduleCancelled}</Text>
        )}
      </PetPageScroll>
    </>
  );
}
