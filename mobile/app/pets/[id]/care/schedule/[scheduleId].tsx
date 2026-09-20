import React, { useCallback, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { PetIntro, PetLoading } from '@/components/pets/PetUi';
import { PetButton as Button } from '@/components/pets/PetUi';
import { PetPanel as Card } from '@/components/pets/PetUi';
import { PetCareReminderCard } from '@/components/pets/PetCareReminderCard';
import { careKindIcon } from '@/components/pets/PetCareChips';
import { PetErrorText, PetFactRow, PetIconWell, PetPageScroll } from '@/components/pets/PetScreen';
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
    setError(null);
    const [petRes, sched] = await Promise.all([api.pets.get(id), api.pets.schedules.get(id, scheduleId)]);
    setPet(petRes.pet);
    setSchedule(sched.schedule);
  }, [id, scheduleId]);

  React.useEffect(() => {
    void load().catch((caught) => setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError })));
  }, [load]);

  const complete = () => {
    if (!id || !schedule || !schedule.nextDueOn) return;
    const occurrenceKey = `r${schedule.revision}|${schedule.nextDueOn}|${schedule.nextDueTime || 'date'}|${schedule.nextSequence ?? 0}`;
    router.push({ pathname: '/pets/[id]/care/complete', params: { id, scheduleId: schedule.id, occurrenceKey, revision: String(schedule.revision) } });
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
            void reconcilePetCareReminders({ reason: 'cancel' }).catch(() => undefined);
            router.replace(`/pets/${id}/care`);
          } catch (caught) {
            setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
          }
        },
      },
    ]);
  };

  if (!schedule) {
    return error ? <PetPageScroll><PetIntro title="გეგმა ვერ ჩაიტვირთა" body="ხელახლა სცადე, რომ შენახული დეტალები ნახო." /><PetErrorText message={error} /><Button label="ხელახლა ცდა" onPress={() => void load().catch(caught => setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError })))} /></PetPageScroll> : <PetLoading />;
  }

  return (
    <>
      <Stack.Screen options={{ title: schedule.title }} />
      <PetPageScroll>
        <PetErrorText message={error} />
        <Card>
          <View className="mb-3 flex-row items-center gap-3">
            <PetIconWell icon={careKindIcon(schedule.kind)} />
            <Text className="flex-1 text-base font-semibold text-text-100" style={{ fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
              {schedule.title || kindLabel(schedule.kind, ka.pets)}
            </Text>
          </View>
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
          <Button icon={Check} label={completeLabel(schedule.kind, ka.pets)} loading={saving} onPress={() => void complete()} />
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
