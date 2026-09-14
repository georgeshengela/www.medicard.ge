import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { PawPrint } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/EmptyState';
import { PetCard } from '@/components/pets/PetCard';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { ka } from '@/i18n/ka';
import { ApiError, api, type Pet } from '@/lib/api';
import { cachePetsList, loadCachedPetsList } from '@/lib/petsDraft';
import { useThemeColors } from '@/theme/colors';

export default function PetsHubScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { pets: rows } = await api.pets.list();
      setPets(rows);
      await cachePetsList(rows);
      setOffline(false);
    } catch (caught) {
      const cached = await loadCachedPetsList();
      setPets(cached as Pet[]);
      setOffline(cached.length > 0);
      if (caught instanceof ApiError && caught.status === 503) {
        setError(ka.pets.schemaUnavailable);
      } else {
        setError(cached.length ? ka.common.offlineCached : ka.pets.loadError);
      }
    } finally {
      setReady(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100, padding: 16 }}>
        <ListRowsSkeleton />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg100 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {pets.length === 0 ? (
        <EmptyState icon={PawPrint} title={ka.pets.emptyTitle} body={error || ka.pets.emptyBody}>
          {error ? (
            <Button label={ka.pets.retry} variant="secondary" onPress={() => void load()} />
          ) : (
            <Button label={ka.pets.add} onPress={() => router.push('/pets/new')} />
          )}
        </EmptyState>
      ) : (
        <>
          {error ? (
            <EmptyState icon={PawPrint} title={offline ? ka.common.offlineMode : ka.common.error} body={error}>
              <Button label={ka.pets.retry} variant="secondary" onPress={() => void load()} />
            </EmptyState>
          ) : null}
          {pets.map((pet) => (
            <PetCard key={pet.id} pet={pet} onPress={() => router.push(`/pets/${pet.id}`)} />
          ))}
          <Button label={ka.pets.addAnother} variant="secondary" onPress={() => router.push('/pets/new')} />
        </>
      )}
    </ScrollView>
  );
}
