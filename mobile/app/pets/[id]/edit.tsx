import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PetForm, formToBody, petToForm, type LocalPhoto, type PetFormValue } from '@/components/pets/PetForm';
import { ka } from '@/i18n/ka';
import { ApiError, api, type Pet } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';

export default function EditPetScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pet, setPet] = useState<Pet | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const { pet: row } = await api.pets.get(id);
        setPet(row);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : ka.pets.loadError);
      }
    })();
  }, [id]);

  const onSubmit = useCallback(
    async (value: PetFormValue, photo: LocalPhoto | null, removePhoto: boolean) => {
      if (!pet || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        await api.pets.update(pet.id, formToBody(value));
        if (photo) await api.pets.uploadPhoto(pet.id, photo);
        else if (removePhoto && pet.photoUrl) await api.pets.removePhoto(pet.id);
        router.replace(`/pets/${pet.id}`);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : ka.common.networkError);
      } finally {
        setSubmitting(false);
      }
    },
    [pet, router, submitting],
  );

  if (!pet) {
    return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <PetForm
        initial={petToForm(pet)}
        existingPhotoUrl={pet.photoUrl}
        submitting={submitting}
        error={error}
        submitLabel={ka.pets.save}
        onSubmit={onSubmit}
      />
    </View>
  );
}
