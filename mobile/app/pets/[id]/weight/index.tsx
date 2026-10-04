import { PetLoading } from '@/components/pets/PetUi';
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Scale } from 'lucide-react-native';
import { PetButton as Button } from '@/components/pets/PetUi';
import { PetPanel as Card } from '@/components/pets/PetUi';
import { EmptyState } from '@/components/EmptyState';
import { PETS_ART } from '@/constants/appArt';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { PetHealthStatus } from '@/components/pets/PetHealthStatus';
import { PetListGroup, PetListRow, PetPageScroll } from '@/components/pets/PetScreen';
import { PetWeightTrend } from '@/components/pets/PetWeightTrend';
import { PetIconWell } from '@/components/pets/PetScreen';
import { PetIntro } from '@/components/pets/PetUi';
import { ka } from '@/i18n/ka';
import { api, type Pet, type PetWeightLog } from '@/lib/api';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { formatPetWeight, petWeightDeltaPercent } from '@/lib/petsHealth';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

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

  if (!ready) return <PetLoading />;
  if (error && !items.length) {
    return <PetHealthStatus error={error} onRetry={() => void load()} />;
  }


  return (
    <>
      <Stack.Screen options={{ title: pet ? `${ka.pets.weightTitle} · ${pet.name}` : ka.pets.weightTitle }} />
      <PetPageScroll>
        {/* With measurements the trend card already leads with the latest value; this card only for a single one. */}
        {latest && items.length < 2 ? (
          <Card>
            <View className="flex-row items-center">
              <PetIconWell art={PETS_ART.weight} size={56} />
              <View className="flex-1 pl-4">
                <Text className="text-sm font-semibold text-text-200">{ka.pets.current}</Text>
                <Text className="mt-1 text-3xl font-bold text-text-100" style={{ fontFamily: 'NotoSansGeorgian_700Bold' }}>
                  {formatPetWeight(latest, ka.pets)}
                </Text>
                <Text className="mt-1 text-sm text-text-300">{formatCycleDateKa(latest.recordedOn)}</Text>
              </View>
            </View>
          </Card>
        ) : !latest ? (
          <EmptyState art={PETS_ART.weight} title={ka.pets.weightEmpty} body={ka.pets.weightEmptyBody} />
        ) : null}
        {items.length ? (
          <View>
            <HomeSectionTitle title={ka.pets.weightTrendLabel} />
            <PetWeightTrend items={items} pet={pet} />
          </View>
        ) : null}
        {items.length ? (
          <View>
            <HomeSectionTitle title={tx('ყველა გაზომვა', 'All measurements')} />
            <PetListGroup>
              {items.map((row) => (
                <PetListRow
                  key={row.id}
                  title={formatCycleDateKa(row.recordedOn)}
                  subtitle={row.note ?? undefined}
                  right={formatPetWeight(row, ka.pets)}
                  onPress={() => router.push(`/pets/${id}/weight/${row.id}`)}
                />
              ))}
            </PetListGroup>
            <Text style={{ marginTop: 10, marginHorizontal: 4, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17, color: colors.text300 }}>
              {tx('წონის ცვლილება ვეტერინართან ერთად შეაფასე.', 'Review weight changes together with your vet.')}
            </Text>
          </View>
        ) : null}
        <Button icon={Scale} label={ka.pets.weightAdd} onPress={() => router.push(`/pets/${id}/weight/new`)} />
      </PetPageScroll>
    </>
  );
}
