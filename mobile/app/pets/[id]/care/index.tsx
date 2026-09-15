import React, { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, ChevronRight, History, Package, Plus, Syringe } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/EmptyState';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { careKindIcon } from '@/components/pets/PetCareChips';
import { PetIconWell, PetListRow, PetPageScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { api, type Pet, type PetCareOccurrence } from '@/lib/api';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { completeLabel, kindLabel, newPetsRequestId, petsCareErrorKind, petsCareErrorMessage } from '@/lib/petsCare';
import { todayIsoLocal } from '@/lib/visitReminders';
import { useThemeColors } from '@/theme/colors';

function OccurrenceCard({
  row,
  petId,
  completing,
  tone,
  onComplete,
}: {
  row: PetCareOccurrence;
  petId: string;
  completing: string | null;
  tone?: 'overdue' | 'due' | 'upcoming';
  onComplete: (row: PetCareOccurrence) => void;
}) {
  const colors = useThemeColors();
  const router = useRouter();
  const dateColor = tone === 'overdue' ? colors.danger : colors.text300;

  return (
    <View>
      <Card onPress={() => router.push(`/pets/${petId}/care/schedule/${row.scheduleId}`)}>
        <View className="flex-row items-center">
          <PetIconWell icon={careKindIcon(row.kind)} />
          <View className="flex-1 px-3">
            <Text className="text-base font-semibold text-text-100" style={{ fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
              {row.title || kindLabel(row.kind, ka.pets)}
            </Text>
            <Text className="mt-1 text-sm" style={{ color: dateColor }}>
              {[formatCycleDateKa(row.plannedOn), row.plannedTime, kindLabel(row.kind, ka.pets)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.text300} strokeWidth={2} />
        </View>
      </Card>
      <View className="mt-2">
        <Button
          label={completeLabel(row.kind, ka.pets)}
          size="sm"
          loading={completing === row.occurrenceKey}
          onPress={() => onComplete(row)}
        />
      </View>
    </View>
  );
}

export default function PetCareHubScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = useRef(newPetsRequestId());
  const [pet, setPet] = useState<Pet | null>(null);
  const [overdue, setOverdue] = useState<PetCareOccurrence[]>([]);
  const [due, setDue] = useState<PetCareOccurrence[]>([]);
  const [upcoming, setUpcoming] = useState<PetCareOccurrence[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [petRes, careRes] = await Promise.all([api.pets.get(id), api.pets.care.upcoming(id)]);
      setPet(petRes.pet);
      setOverdue(careRes.overdue);
      setDue(careRes.due);
      setUpcoming(careRes.upcoming);
    } catch (caught) {
      setError(caught);
    } finally {
      setReady(true);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      requestId.current = newPetsRequestId();
      void load();
    }, [load]),
  );

  const goAdd = () => {
    if (!id) return;
    router.push(`/pets/${id}/care/add`);
  };

  const complete = async (row: PetCareOccurrence) => {
    if (!id || completing) return;
    setCompleting(row.occurrenceKey);
    try {
      await api.pets.schedules.complete(id, row.scheduleId, {
        occurrenceKey: row.occurrenceKey,
        revision: row.revision,
        administeredOn: todayIsoLocal(),
        clientRequestId: requestId.current,
      });
      requestId.current = newPetsRequestId();
      await import('@/lib/petCareReminders').then(({ reconcilePetCareReminders }) =>
        reconcilePetCareReminders({ reason: 'complete' }),
      );
      await load();
    } catch (caught) {
      const kind = petsCareErrorKind(caught);
      Alert.alert(kind === 'conflict' ? ka.pets.careConflict : ka.pets.saveError, petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
      if (kind === 'conflict') void load();
    } finally {
      setCompleting(null);
    }
  };

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;
  if (error && !pet) {
    const kind = petsCareErrorKind(error);
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
        <EmptyState
          icon={kind === 'unavailable' ? AlertTriangle : Syringe}
          title={kind === 'unavailable' ? ka.pets.careUnavailable : ka.pets.healthLoadError}
        >
          <Button label={ka.pets.retry} onPress={() => void load()} />
        </EmptyState>
      </View>
    );
  }

  const empty = !overdue.length && !due.length && !upcoming.length;

  return (
    <>
      <Stack.Screen
        options={{
          title: pet ? `${ka.pets.careTitle} · ${pet.name}` : ka.pets.careTitle,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ka.pets.careAdd}
              onPress={goAdd}
              hitSlop={12}
              className="active:opacity-70"
            >
              <Plus size={22} color={colors.primary200} strokeWidth={2.2} />
            </Pressable>
          ),
        }}
      />
      <PetPageScroll>
        {overdue.length ? (
          <View className="gap-2">
            <HomeSectionTitle title={ka.pets.overdue} />
            {overdue.map((row) => (
              <OccurrenceCard
                key={row.occurrenceKey}
                row={row}
                petId={id}
                completing={completing}
                tone="overdue"
                onComplete={complete}
              />
            ))}
          </View>
        ) : null}
        {due.length ? (
          <View className="gap-2">
            <HomeSectionTitle title={ka.pets.dueToday} />
            {due.map((row) => (
              <OccurrenceCard
                key={row.occurrenceKey}
                row={row}
                petId={id}
                completing={completing}
                tone="due"
                onComplete={complete}
              />
            ))}
          </View>
        ) : null}
        {upcoming.length ? (
          <View className="gap-2">
            <HomeSectionTitle title={ka.pets.upcomingCare} />
            {upcoming.map((row) => (
              <OccurrenceCard
                key={row.occurrenceKey}
                row={row}
                petId={id}
                completing={completing}
                tone="upcoming"
                onComplete={complete}
              />
            ))}
          </View>
        ) : null}

        {empty ? (
          <EmptyState icon={Syringe} title={ka.pets.careEmpty} body={ka.pets.careEmptyBody}>
            <Button icon={Plus} label={ka.pets.careAdd} onPress={goAdd} />
          </EmptyState>
        ) : (
          <Button icon={Plus} label={ka.pets.careAdd} onPress={goAdd} />
        )}

        <PetListRow
          icon={History}
          title={ka.pets.careHistory}
          subtitle={ka.pets.careHistoryHint}
          onPress={() => router.push(`/pets/${id}/care/history`)}
        />
        <PetListRow
          icon={Package}
          title={ka.pets.productsTitle}
          subtitle={ka.pets.expiresHint}
          onPress={() => router.push(`/pets/${id}/care/products`)}
        />
        <Text className="text-sm text-text-300">{ka.pets.plannedDisclaimer}</Text>
      </PetPageScroll>
    </>
  );
}
