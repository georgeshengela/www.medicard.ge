import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Stethoscope } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/EmptyState';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { PetHealthStatus } from '@/components/pets/PetHealthStatus';
import { PetListRow, PetPageScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { api, type Pet, type PetCondition } from '@/lib/api';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { useThemeColors } from '@/theme/colors';

function basisLabel(basis: PetCondition['reportedBasis']) {
  return basis === 'veterinarian_confirmed' ? ka.pets.conditionVetConfirmed : ka.pets.conditionOwnerReported;
}

function statusLabel(status: PetCondition['status']) {
  if (status === 'resolved') return ka.pets.conditionResolved;
  if (status === 'unknown') return ka.pets.conditionUnknown;
  return ka.pets.conditionActive;
}

export default function PetConditionsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pet, setPet] = useState<Pet | null>(null);
  const [items, setItems] = useState<PetCondition[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [petRes, conditionRes] = await Promise.all([api.pets.get(id), api.pets.conditions.list(id)]);
      setPet(petRes.pet);
      setItems(conditionRes.items);
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

  const active = items.filter((row) => row.status !== 'resolved');
  const resolved = items.filter((row) => row.status === 'resolved');

  return (
    <>
      <Stack.Screen options={{ title: pet ? `${ka.pets.conditionsTitle} · ${pet.name}` : ka.pets.conditionsTitle }} />
      <PetPageScroll>
        {items.length === 0 ? (
          <EmptyState icon={Stethoscope} title={ka.pets.conditionsEmpty} body={ka.pets.conditionsEmptyBody} />
        ) : (
          <>
            {active.map((row) => (
              <PetListRow
                key={row.id}
                title={row.name}
                subtitle={[statusLabel(row.status), basisLabel(row.reportedBasis), row.onsetOn ? formatCycleDateKa(row.onsetOn) : null]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => router.push(`/pets/${id}/conditions/${row.id}`)}
              />
            ))}
            {resolved.length ? <HomeSectionTitle title={ka.pets.conditionHistory} /> : null}
            {resolved.map((row) => (
              <PetListRow
                key={row.id}
                title={row.name}
                subtitle={[ka.pets.conditionResolved, basisLabel(row.reportedBasis), row.resolvedOn ? formatCycleDateKa(row.resolvedOn) : null]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => router.push(`/pets/${id}/conditions/${row.id}`)}
              />
            ))}
          </>
        )}
        <Button label={ka.pets.conditionAdd} onPress={() => router.push(`/pets/${id}/conditions/new`)} />
      </PetPageScroll>
    </>
  );
}
