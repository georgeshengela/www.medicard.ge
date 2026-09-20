import { PetLoading } from '@/components/pets/PetUi';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { History, Plus } from 'lucide-react-native';
import { PetButton as Button } from '@/components/pets/PetUi';
import { EmptyState } from '@/components/EmptyState';
import { careKindIcon } from '@/components/pets/PetCareChips';
import { PetListRow, PetPageScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { api, type PetCareEvent } from '@/lib/api';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { kindLabel, petsCareErrorKind } from '@/lib/petsCare';
import { useThemeColors } from '@/theme/colors';

export default function PetCareHistoryScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<PetCareEvent[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const events = await api.pets.events.list(id, { limit: 50 });
      setItems(events.items);
    } catch (caught) {
      setError(caught);
    } finally {
      setReady(true);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!ready) return <PetLoading />;
  if (error && !items.length) {
    const kind = petsCareErrorKind(error);
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
        <EmptyState icon={History} title={kind === 'unavailable' ? ka.pets.careUnavailable : ka.pets.healthLoadError}>
          <Button label={ka.pets.retry} onPress={() => void load()} />
        </EmptyState>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: ka.pets.careHistory,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ka.pets.recordAdmin}
              onPress={() => router.push(`/pets/${id}/care/record`)}
              hitSlop={12}
              className="active:opacity-70"
            >
              <Plus size={22} color={colors.primary200} strokeWidth={2.2} />
            </Pressable>
          ),
        }}
      />
      <PetPageScroll>
        {!items.length ? (
          <EmptyState icon={History} title={ka.pets.careEmpty} body={ka.pets.careHistoryEmptyBody}>
            <Button icon={Plus} label={ka.pets.recordAdmin} onPress={() => router.push(`/pets/${id}/care/record`)} />
          </EmptyState>
        ) : null}
        {items.map((row) => (
          <PetListRow
            key={row.id}
            icon={careKindIcon(row.kind)}
            title={row.titleSnapshot}
            subtitle={[
              kindLabel(row.kind, ka.pets),
              formatCycleDateKa(row.administeredOn),
              row.administeredTime,
              row.status === 'VOIDED' ? ka.pets.eventVoided : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            onPress={() => router.push(`/pets/${id}/care/event/${row.id}`)}
            tone={row.status === 'VOIDED' ? 'muted' : 'default'}
          />
        ))}
        {items.length ? (
          <Button icon={Plus} label={ka.pets.recordAdmin} onPress={() => router.push(`/pets/${id}/care/record`)} />
        ) : null}
      </PetPageScroll>
    </>
  );
}
