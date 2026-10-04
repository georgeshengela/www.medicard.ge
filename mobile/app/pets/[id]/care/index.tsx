import React, { useCallback, useRef, useState } from 'react';
import { PetHeaderButton } from '@/components/pets/PetUi';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Check, ChevronRight, History, Package, Plus, Syringe } from 'lucide-react-native';
import { PetButton as Button } from '@/components/pets/PetUi';
import { PetPanel as Card } from '@/components/pets/PetUi';
import { EmptyState } from '@/components/EmptyState';
import { PETS_ART } from '@/constants/appArt';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { careKindArt } from '@/components/pets/PetCareChips';
import { PetIntro, PetLoading } from '@/components/pets/PetUi';
import { PetErrorText, PetIconWell, PetListGroup, PetListRow, PetPageScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { api, type Pet, type PetCareOccurrence } from '@/lib/api';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { completeLabel, kindLabel, newPetsRequestId, petsCareErrorKind, petsCareErrorMessage } from '@/lib/petsCare';
import { todayIsoLocal } from '@/lib/visitReminders';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';
import { HUB } from '@/theme/hub';

/**
 * One planned care item in a section card: tap the row for the plan, the pill to log it as given.
 * Overdue dates are amber-red; the row and the pill are siblings (no button inside a button).
 */
function OccurrenceRow({
  row,
  petId,
  completing,
  tone,
  first,
  onComplete,
}: {
  row: PetCareOccurrence;
  petId: string;
  completing: string | null;
  tone?: 'overdue' | 'due' | 'upcoming';
  first: boolean;
  onComplete: (row: PetCareOccurrence) => void;
}) {
  const colors = useThemeColors();
  const router = useRouter();
  const dateColor = tone === 'overdue' ? colors.danger : colors.text300;
  const busy = completing === row.occurrenceKey;
  const title = row.title || kindLabel(row.kind, ka.pets);
  const when = [formatCycleDateKa(row.plannedOn), row.plannedTime].filter(Boolean).join(' · ');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 14, backgroundColor: colors.surface }}>
      <PetIconWell art={careKindArt(row.kind)} />
      <View
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginLeft: 12,
          paddingVertical: 14,
          paddingRight: 14,
          borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: colors.bg300,
          alignSelf: 'stretch',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${when}`}
          onPress={() => router.push(`/pets/${petId}/care/schedule/${row.scheduleId}`)}
          style={{ flex: 1, minWidth: 0, gap: 2 }}
        >
          <Text numberOfLines={3} style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, lineHeight: 21, color: colors.text100 }}>{title}</Text>
          <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12.5, lineHeight: 18, color: dateColor }}>{when}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${completeLabel(row.kind, ka.pets)} — ${title}`}
          accessibilityState={{ busy, disabled: busy }}
          disabled={busy}
          onPress={() => onComplete(row)}
          hitSlop={6}
          style={{ minHeight: 36, minWidth: 76, paddingHorizontal: 12, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, backgroundColor: colors.accent100 }}
        >
          {busy ? <ActivityIndicator size="small" color={colors.primary100} /> : (
            <>
              <Check size={15} color={colors.primary100} strokeWidth={2.6} />
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, color: colors.primary100 }}>{completeLabel(row.kind, ka.pets)}</Text>
            </>
          )}
        </Pressable>
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

  const complete = (row: PetCareOccurrence) => {
    if (!id) return;
    router.push({ pathname: '/pets/[id]/care/complete', params: { id, scheduleId: row.scheduleId, occurrenceKey: row.occurrenceKey, revision: String(row.revision) } });
  };

  if (!ready) return <PetLoading />;
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
          headerRight: () => <PetHeaderButton label={ka.pets.careAdd} icon={Plus} onPress={goAdd} />,
        }}
      />
      <PetPageScroll>
        {error ? <><PetErrorText message={petsCareErrorMessage(error, { ...ka.pets, offline: ka.common.networkError })} /><Button label={tx('განახლება', 'Refresh')} variant="secondary" onPress={() => void load()} /></> : null}
        {overdue.length ? (
          <View>
            <HomeSectionTitle title={ka.pets.overdue} />
            <View style={{ borderRadius: HUB.cardRadius, overflow: 'hidden' }}>
              {overdue.map((row, index) => (
                <OccurrenceRow
                  key={row.occurrenceKey}
                  row={row}
                  petId={id}
                  completing={completing}
                  tone="overdue"
                  first={index === 0}
                  onComplete={complete}
                />
              ))}
            </View>
          </View>
        ) : null}
        {due.length ? (
          <View>
            <HomeSectionTitle title={ka.pets.dueToday} />
            <View style={{ borderRadius: HUB.cardRadius, overflow: 'hidden' }}>
              {due.map((row, index) => (
                <OccurrenceRow
                  key={row.occurrenceKey}
                  row={row}
                  petId={id}
                  completing={completing}
                  tone="due"
                  first={index === 0}
                  onComplete={complete}
                />
              ))}
            </View>
          </View>
        ) : null}
        {upcoming.length ? (
          <View>
            <HomeSectionTitle title={ka.pets.upcomingCare} />
            <View style={{ borderRadius: HUB.cardRadius, overflow: 'hidden' }}>
              {upcoming.map((row, index) => (
                <OccurrenceRow
                  key={row.occurrenceKey}
                  row={row}
                  petId={id}
                  completing={completing}
                  tone="upcoming"
                  first={index === 0}
                  onComplete={complete}
                />
              ))}
            </View>
          </View>
        ) : null}

        {empty ? (
          <EmptyState art={PETS_ART.care_vaccine} title={ka.pets.careEmpty} body={ka.pets.careEmptyBody}>
            <Button icon={Plus} label={ka.pets.careAdd} onPress={goAdd} />
          </EmptyState>
        ) : (
          <Button icon={Plus} label={ka.pets.careAdd} onPress={goAdd} />
        )}

        <PetListGroup>
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
        </PetListGroup>
        <Text style={{ marginHorizontal: 4, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17, color: colors.text300 }}>
          {tx('დაგეგმილი პროცედურა შესრულებულად მხოლოდ შენი დადასტურების შემდეგ ჩაიწერება.', 'A planned procedure is marked done only after you confirm it.')} {ka.pets.plannedDisclaimer}
        </Text>
      </PetPageScroll>
    </>
  );
}
