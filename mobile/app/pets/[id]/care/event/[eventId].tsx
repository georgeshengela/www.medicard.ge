import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { careKindIcon } from '@/components/pets/PetCareChips';
import { PetErrorText, PetFactRow, PetIconWell, PetPageScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { api, type Pet, type PetCareEvent } from '@/lib/api';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { kindLabel, petsCareErrorKind, petsCareErrorMessage } from '@/lib/petsCare';
import { useThemeColors } from '@/theme/colors';

export default function PetCareEventScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id, eventId } = useLocalSearchParams<{ id: string; eventId: string }>();
  const [pet, setPet] = useState<Pet | null>(null);
  const [event, setEvent] = useState<PetCareEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !eventId) return;
    const [petRes, ev] = await Promise.all([api.pets.get(id), api.pets.events.get(id, eventId)]);
    setPet(petRes.pet);
    setEvent(ev.event);
  }, [id, eventId]);

  React.useEffect(() => {
    void load().catch((caught) => setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError })));
  }, [load]);

  const voidEvent = () => {
    if (!id || !event) return;
    Alert.alert(ka.pets.voidConfirmTitle, ka.pets.voidConfirmBody, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.pets.voidEvent,
        style: 'destructive',
        onPress: async () => {
          try {
            await api.pets.events.void(id, event.id);
            router.replace(`/pets/${id}/care/history`);
          } catch (caught) {
            if (petsCareErrorKind(caught) === 'conflict') {
              Alert.alert(ka.pets.voidConfirmTitle, ka.pets.voidRecalcBody, [
                { text: ka.pets.voidKeepPlan, style: 'cancel' },
                {
                  text: ka.pets.confirmRecalc,
                  onPress: async () => {
                    await api.pets.events.void(id, event.id, { confirmRecalculate: true });
                    router.replace(`/pets/${id}/care/history`);
                  },
                },
              ]);
              return;
            }
            setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
          }
        },
      },
    ]);
  };

  if (!event) return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;

  return (
    <>
      <Stack.Screen options={{ title: event.titleSnapshot }} />
      <PetPageScroll>
        <PetErrorText message={error} />
        <Card>
          <View className="mb-3 flex-row items-center gap-3">
            <PetIconWell icon={careKindIcon(event.kind)} />
            <Text className="flex-1 text-base font-semibold text-text-100" style={{ fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
              {event.titleSnapshot}
            </Text>
          </View>
          <PetFactRow label={ka.pets.careKind} value={kindLabel(event.kind, ka.pets)} />
          <PetFactRow
            label={ka.pets.administeredOn}
            value={`${formatCycleDateKa(event.administeredOn)}${event.administeredTime ? ` · ${event.administeredTime}` : ''}`}
            last={!event.doseSnapshot && !event.notes && event.status !== 'VOIDED'}
          />
          {event.doseSnapshot ? (
            <PetFactRow
              label={ka.pets.dose}
              value={`${event.doseSnapshot} ${event.doseUnitSnapshot || ''}`.trim()}
              last={!event.notes && event.status !== 'VOIDED'}
            />
          ) : null}
          {event.notes ? <PetFactRow label={ka.pets.note} value={event.notes} last={event.status !== 'VOIDED'} /> : null}
          {event.status === 'VOIDED' ? (
            <Text className="mt-3 text-sm text-state-danger">{ka.pets.eventVoided}</Text>
          ) : null}
        </Card>
        {event.status === 'RECORDED' ? <Button label={ka.pets.voidEvent} variant="danger" onPress={voidEvent} /> : null}
      </PetPageScroll>
    </>
  );
}
