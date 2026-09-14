import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/EmptyState';
import { PetHealthStatus } from '@/components/pets/PetHealthStatus';
import { PetListRow, PetPageScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { api, type Pet, type PetAllergy } from '@/lib/api';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { useThemeColors } from '@/theme/colors';

function statusLabel(status: PetAllergy['reportedStatus']) {
  return status === 'veterinarian_confirmed' ? ka.pets.allergyVetConfirmed : ka.pets.allergySuspected;
}

export default function PetAllergiesScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pet, setPet] = useState<Pet | null>(null);
  const [items, setItems] = useState<PetAllergy[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [petRes, allergyRes] = await Promise.all([api.pets.get(id), api.pets.allergies.list(id)]);
      setPet(petRes.pet);
      setItems(allergyRes.items);
    } catch (caught) {
      setError(caught);
      setItems([]);
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
  if (error && !items.length) return <PetHealthStatus error={error} onRetry={() => void load()} />;

  return (
    <>
      <Stack.Screen options={{ title: pet ? `${ka.pets.allergiesTitle} · ${pet.name}` : ka.pets.allergiesTitle }} />
      <PetPageScroll>
        {items.length === 0 ? (
          <EmptyState icon={ShieldAlert} title={ka.pets.allergiesEmpty} body={ka.pets.allergiesEmptyBody} />
        ) : (
          items.map((row) => (
            <PetListRow
              key={row.id}
              title={row.name}
              subtitle={[statusLabel(row.reportedStatus), row.notedOn ? formatCycleDateKa(row.notedOn) : null]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => router.push(`/pets/${id}/allergies/${row.id}`)}
            />
          ))
        )}
        <Button label={ka.pets.allergyAdd} onPress={() => router.push(`/pets/${id}/allergies/new`)} />
      </PetPageScroll>
    </>
  );
}
