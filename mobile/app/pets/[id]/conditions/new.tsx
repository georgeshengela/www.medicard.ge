import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PetConditionForm } from '@/components/pets/PetHealthForms';
import { ka } from '@/i18n/ka';
import { api } from '@/lib/api';
import { newPetsRequestId, petsHealthErrorMessage } from '@/lib/petsHealth';
import { useThemeColors } from '@/theme/colors';

export default function PetConditionNewScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = useRef(newPetsRequestId()).current;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <PetConditionForm
        saving={saving}
        error={error}
        onSubmit={async (body) => {
          if (!id || saving) return;
          setSaving(true);
          setError(null);
          try {
            await api.pets.conditions.create(id, { ...body, clientRequestId: requestId });
            router.replace(`/pets/${id}/conditions`);
          } catch (caught) {
            setError(petsHealthErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
          } finally {
            setSaving(false);
          }
        }}
      />
    </View>
  );
}
