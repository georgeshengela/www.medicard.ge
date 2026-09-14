import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { MessageCircle, Pencil } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/EmptyState';
import { PetPhoto } from '@/components/pets/PetPhoto';
import { PetFactRow, PetPageScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { ApiError, api, type Pet } from '@/lib/api';
import { isoToDisplay } from '@/lib/birthdate';
import { formatPetAgeKa } from '@/lib/petsAge';
import { getSpecies } from '@/lib/petsCatalog';
import { PetCareSummary } from '@/components/pets/PetCareSummary';
import { PetHealthSummaries } from '@/components/pets/PetHealthSummaries';
import { useThemeColors } from '@/theme/colors';

function breedLabel(pet: Pet): string {
  if (pet.breedId === 'custom' && pet.customBreed) return pet.customBreed;
  if (pet.breedId === 'mixed') return ka.pets.breedMixed;
  if (pet.breedId === 'unknown') return ka.pets.breedUnknown;
  return getSpecies(pet.speciesId)?.breeds.find((row) => row.id === pet.breedId)?.label || ka.pets.breedUnknown;
}

function neuteredLabel(value: boolean | null): string {
  if (value === true) return ka.pets.neuteredYes;
  if (value === false) return ka.pets.neuteredNo;
  return ka.pets.neuteredUnknown;
}

function sexLabel(value: Pet['sex']): string {
  if (value === 'MALE') return ka.pets.sexMale;
  if (value === 'FEMALE') return ka.pets.sexFemale;
  return ka.pets.sexUnknown;
}

export default function PetProfileScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pet, setPet] = useState<Pet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const { pet: row } = await api.pets.get(id);
      setPet(row);
    } catch (caught) {
      setPet(null);
      setError(caught instanceof ApiError ? caught.message : ka.pets.loadError);
    } finally {
      setReady(true);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const archive = () => {
    if (!pet) return;
    Alert.alert(ka.pets.archiveConfirmTitle, ka.pets.archiveConfirmBody, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.pets.archiveAction,
        style: 'destructive',
        onPress: async () => {
          if (archiving) return;
          setArchiving(true);
          try {
            await api.pets.archive(pet.id);
            void import('@/lib/petCareReminders').then(({ reconcilePetCareReminders }) =>
              reconcilePetCareReminders({ reason: 'archive' }),
            );
            router.replace('/pets');
          } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : ka.common.networkError);
          } finally {
            setArchiving(false);
          }
        },
      },
    ]);
  };

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;
  }

  if (!pet) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
        <EmptyState icon={Pencil} title={ka.pets.loadError} body={error || undefined}>
          <Button label={ka.pets.retry} onPress={() => void load()} />
        </EmptyState>
      </View>
    );
  }

  const species = getSpecies(pet.speciesId);
  const age = formatPetAgeKa(pet.age, ka.pets);
  const hasVet = Boolean(pet.vetClinicName || pet.vetName || pet.vetPhone || pet.vetAddress);

  return (
    <>
      <Stack.Screen
        options={{
          title: pet.name,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ka.common.edit}
              onPress={() => router.push(`/pets/${pet.id}/edit`)}
              hitSlop={12}
              className="active:opacity-70"
            >
              <Pencil size={20} color={colors.primary200} strokeWidth={2} />
            </Pressable>
          ),
        }}
      />
      <PetPageScroll>
        <View className="items-center gap-3 pt-1">
          <PetPhoto photoUrl={pet.photoUrl} name={pet.name} size={112} />
          <Text className="text-2xl font-bold text-text-100" style={{ fontFamily: 'NotoSansGeorgian_700Bold' }}>
            {pet.name}
          </Text>
          <Text className="text-base text-text-300">{[species?.labelKa, breedLabel(pet)].filter(Boolean).join(' · ')}</Text>
        </View>

        <Card>
          <PetFactRow label={ka.pets.age} value={age} />
          {pet.ageKind === 'EXACT' && pet.birthDate ? (
            <PetFactRow label={ka.pets.birthDate} value={isoToDisplay(pet.birthDate) || ka.pets.missing} />
          ) : null}
          <PetFactRow label={ka.pets.sex} value={sexLabel(pet.sex)} />
          <PetFactRow label={ka.pets.neutered} value={neuteredLabel(pet.neutered)} last={!hasVet} />
          {hasVet ? (
            <>
              <PetFactRow label={ka.pets.vetClinic} value={pet.vetClinicName || ka.pets.missing} />
              <PetFactRow label={ka.pets.vetDoctor} value={pet.vetName || ka.pets.missing} />
              <PetFactRow label={ka.pets.vetPhone} value={pet.vetPhone || ka.pets.missing} last={!pet.vetAddress} />
              {pet.vetAddress ? <PetFactRow label={ka.pets.vetAddress} value={pet.vetAddress} last /> : null}
            </>
          ) : null}
        </Card>

        <PetCareSummary pet={pet} />

        <Card onPress={() => router.push(`/pets/${pet.id}/chat`)}>
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-accent-100">
              <MessageCircle size={20} color={colors.primary200} strokeWidth={2} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-text-100">{ka.pets.vetOpen}</Text>
              <Text className="mt-0.5 text-sm text-text-300">{ka.pets.vetDescription}</Text>
            </View>
          </View>
        </Card>

        <PetHealthSummaries petId={pet.id} />

        <Button label={ka.common.edit} variant="secondary" onPress={() => router.push(`/pets/${pet.id}/edit`)} />
        <Button label={ka.pets.archive} variant="danger" loading={archiving} onPress={archive} />
      </PetPageScroll>
    </>
  );
}
