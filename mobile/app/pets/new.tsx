import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { PetForm, formToBody, hydratePetForm, type LocalPhoto, type PetFormValue } from '@/components/pets/PetForm';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { clearPetsDraft, loadPetsDraft, savePetsDraft } from '@/lib/petsDraft';
import { useThemeColors } from '@/theme/colors';

export default function NewPetScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [initial, setInitial] = useState<PetFormValue | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      const draft = await loadPetsDraft();
      if (draft && typeof draft === 'object') setInitial(hydratePetForm(draft as PetFormValue));
      else setInitial(hydratePetForm());
      setReady(true);
    })();
  }, []);

  const onChange = useCallback((value: PetFormValue) => {
    void savePetsDraft(value);
  }, []);

  const onSubmit = async (value: PetFormValue, photo: LocalPhoto | null, _removePhoto: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { pet } = await api.pets.create(formToBody(value));
      if (photo) {
        try {
          await api.pets.uploadPhoto(pet.id, photo);
        } catch {
          /* profile can retry photo */
        }
      }
      await clearPetsDraft();
      router.replace(`/pets/${pet.id}`);
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : ka.common.networkError;
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <PetForm
        initial={initial}
        submitting={submitting}
        error={error}
        submitLabel={ka.pets.save}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    </View>
  );
}
