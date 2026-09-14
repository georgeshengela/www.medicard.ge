import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Scale } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/EmptyState';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { PetHealthStatus } from '@/components/pets/PetHealthStatus';
import { PetListRow, PetPageScroll } from '@/components/pets/PetScreen';
import { PetWeightTrend } from '@/components/pets/PetWeightTrend';
import { ka } from '@/i18n/ka';
import { api, type Pet, type PetWeightLog } from '@/lib/api';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { formatPetWeight } from '@/lib/petsHealth';
import { useThemeColors } from '@/theme/colors';

export default function PetWeightHistoryScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pet, setPet] = useState<Pet | null>(null);
  const [latest, setLatest] = useState<PetWeightLog | null>(null);
  const [items, setItems] = useState<PetWeightLog[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [petRes, weightRes] = await Promise.all([api.pets.get(id), api.pets.weight.list(id, { limit: 50 })]);
      setPet(petRes.pet);
      setLatest(weightRes.latest);
      setItems(weightRes.items);
    } catch (caught) {
      setError(caught);
      setItems([]);
      setLatest(null);
    } finally {
      setReady(true);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;
  if (error && !items.length) {
    return <PetHealthStatus error={error} onRetry={() => void load()} />;
  }

  return (
    <>
      <Stack.Screen options={{ title: pet ? `${ka.pets.weightTitle} · ${pet.name}` : ka.pets.weightTitle }} />
      <PetPageScroll>
        {latest ? (
          <Card>
            <Text className="text-sm font-semibold text-text-200">{ka.pets.current}</Text>
            <Text className="mt-1 text-3xl font-bold text-text-100" style={{ fontFamily: 'NotoSansGeorgian_700Bold' }}>
              {formatPetWeight(latest, ka.pets)}
            </Text>
            <Text className="mt-1 text-sm text-text-300">{formatCycleDateKa(latest.recordedOn)}</Text>
          </Card>
        ) : (
          <EmptyState icon={Scale} title={ka.pets.weightEmpty} body={ka.pets.weightEmptyBody} />
        )}
        {items.length > 1 ? (
          <View>
            <HomeSectionTitle title={ka.pets.weightTrendLabel} />
            <Card>
              <PetWeightTrend items={items} />
            </Card>
          </View>
        ) : items.length === 1 ? (
          <PetWeightTrend items={items} />
        ) : null}
        {items.map((row) => (
          <PetListRow
            key={row.id}
            title={formatPetWeight(row, ka.pets)}
            subtitle={[formatCycleDateKa(row.recordedOn), row.note].filter(Boolean).join(' · ')}
            onPress={() => router.push(`/pets/${id}/weight/${row.id}`)}
          />
        ))}
        <Button label={ka.pets.weightAdd} onPress={() => router.push(`/pets/${id}/weight/new`)} />
      </PetPageScroll>
    </>
  );
}
