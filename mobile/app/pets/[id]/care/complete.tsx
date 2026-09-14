import React, { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { PetErrorText, PetFactRow, PetPageScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { ApiError, api, type Pet, type PetCareSchedule } from '@/lib/api';
import { isoToDigits, parseBirthDate } from '@/lib/birthdate';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { conflictExplanation } from '@/lib/petCareReminderContract.js';
import { queuePetCareConfirm, reconcilePetCareReminders } from '@/lib/petCareReminders';
import { completeLabel, kindLabel, newPetsRequestId, petsCareErrorKind, petsCareErrorMessage } from '@/lib/petsCare';
import { localAccountId } from '@/lib/localAccount';
import { todayIsoLocal } from '@/lib/visitReminders';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

function digitsToIso(digits: string): string | null {
  if (!digits) return null;
  const parsed = parseBirthDate(digits);
  return parsed.ok ? parsed.iso : '';
}

export default function PetCareCompleteScreen() {
  const colors = useThemeColors();
  const { ready, user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    scheduleId?: string;
    occurrenceKey?: string;
    revision?: string;
    action?: string;
  }>();
  const requestId = useRef(newPetsRequestId()).current;
  const [pet, setPet] = useState<Pet | null>(null);
  const [schedule, setSchedule] = useState<PetCareSchedule | null>(null);
  const [dateDigits, setDateDigits] = useState(isoToDigits(todayIsoLocal()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!params.id || !params.scheduleId) return;
    try {
      const [petRes, sched] = await Promise.all([
        api.pets.get(params.id),
        api.pets.schedules.get(params.id, params.scheduleId),
      ]);
      setPet(petRes.pet);
      setSchedule(sched.schedule);
      if (params.revision && Number(params.revision) !== sched.schedule.revision) {
        setStale(ka.pets.reminderStaleRevision);
      }
    } catch (caught) {
      setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
    }
  }, [params.id, params.scheduleId, params.revision]);

  React.useEffect(() => {
    if (!ready || !user) return;
    void load();
  }, [load, ready, user]);

  const administeredOn = digitsToIso(dateDigits);
  const skip = params.action === 'skip';

  const submit = async (kind: 'complete' | 'skip') => {
    if (!params.id || !params.scheduleId || !params.occurrenceKey || !schedule || saving) return;
    if (kind === 'complete' && !administeredOn) {
      setError(ka.pets.administeredOn);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (kind === 'skip') {
        await api.pets.schedules.skip(params.id, params.scheduleId, {
          occurrenceKey: String(params.occurrenceKey),
          revision: Number(params.revision || schedule.revision),
          clientRequestId: requestId,
        });
      } else {
        await api.pets.schedules.complete(params.id, params.scheduleId, {
          occurrenceKey: String(params.occurrenceKey),
          revision: Number(params.revision || schedule.revision),
          administeredOn: administeredOn as string,
          clientRequestId: requestId,
        });
      }
      await reconcilePetCareReminders({ reason: kind });
      router.replace(`/pets/${params.id}/care`);
    } catch (caught) {
      const kindKind = petsCareErrorKind(caught);
      if (caught instanceof ApiError && caught.status === 409) {
        const why = conflictExplanation(caught.code || '');
        setError(
          why === 'other_device'
            ? ka.pets.reminderCompletedElsewhere
            : why === 'schedule_changed'
              ? ka.pets.reminderScheduleChanged
              : ka.pets.careConflict,
        );
        void load();
        return;
      }
      if (kindKind === 'offline') {
        const userId = localAccountId();
        if (userId && administeredOn) {
          await queuePetCareConfirm({
            userId,
            petId: params.id,
            scheduleId: params.scheduleId,
            occurrenceKey: String(params.occurrenceKey),
            revision: Number(params.revision || schedule.revision),
            clientRequestId: requestId,
            administeredOn,
            kind,
            createdAt: Date.now(),
          });
          setError(ka.pets.reminderPendingOffline);
          return;
        }
      }
      setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
    } finally {
      setSaving(false);
    }
  };

  if (!ready || !user) {
    return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;
  }

  return (
    <>
      <Stack.Screen options={{ title: skip ? ka.pets.skipOccurrence : ka.pets.confirmCare }} />
      <PetPageScroll>
        <PetErrorText message={error} />
        <PetErrorText message={stale} />
        <Card>
          {schedule ? <PetFactRow label={ka.pets.careKind} value={kindLabel(schedule.kind, ka.pets)} /> : null}
          {schedule?.nextDueOn ? (
            <PetFactRow
              label={ka.pets.upcomingCare}
              value={`${formatCycleDateKa(schedule.nextDueOn)}${schedule.nextDueTime ? ` · ${schedule.nextDueTime}` : ''}`}
              last
            />
          ) : null}
          <Text className="mt-3 text-sm text-text-300">{ka.pets.plannedDisclaimer}</Text>
        </Card>
        {!skip ? (
          <DateField label={ka.pets.administeredOn} value={dateDigits} onChangeText={setDateDigits} showAge={false} />
        ) : (
          <Text className="text-sm text-text-300">{ka.pets.skipDoesNotAdminister}</Text>
        )}
        {schedule ? (
          <Button
            label={skip ? ka.pets.skipOccurrence : completeLabel(schedule.kind, ka.pets)}
            loading={saving}
            onPress={() => void submit(skip ? 'skip' : 'complete')}
          />
        ) : null}
        <Button label={ka.common.cancel} variant="ghost" onPress={() => router.back()} />
      </PetPageScroll>
    </>
  );
}
