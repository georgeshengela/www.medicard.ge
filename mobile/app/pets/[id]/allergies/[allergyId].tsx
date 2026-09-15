import React, { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { PetAllergyForm } from '@/components/pets/PetHealthForms';
import { PetHealthStatus } from '@/components/pets/PetHealthStatus';
import { ka } from '@/i18n/ka';
import { api, type PetAllergy } from '@/lib/api';
import { petsHealthErrorMessage } from '@/lib/petsHealth';
import { useThemeColors } from '@/theme/colors';

export default function PetAllergyEditScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id, allergyId } = useLocalSearchParams<{ id: string; allergyId: string }>();
  const [row, setRow] = useState<PetAllergy | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!id || !allergyId) return;
    try {
      const { allergy } = await api.pets.allergies.get(id, allergyId);
      setRow(allergy);
      setLoadError(null);
    } catch (caught) {
      setLoadError(caught);
    } finally {
      setReady(true);
    }
  }, [id, allergyId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;
  if (loadError || !row) return <PetHealthStatus error={loadError || { status: 404 }} onRetry={() => void load()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <PetAllergyForm
        initial={row}
        saving={saving}
        error={error}
        footer={
          <Button
            icon={Trash2}
            label={ka.pets.deleteAction}
            variant="danger"
            disabled={saving}
            onPress={() => {
              Alert.alert(ka.pets.deleteConfirmTitle, ka.pets.deleteConfirmBody, [
                { text: ka.common.cancel, style: 'cancel' },
                {
                  text: ka.pets.deleteAction,
                  style: 'destructive',
                  onPress: async () => {
                    if (!id || !allergyId || saving) return;
                    setSaving(true);
                    try {
                      await api.pets.allergies.remove(id, allergyId);
                      router.replace(`/pets/${id}/allergies`);
                    } catch (caught) {
                      setError(petsHealthErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
                      setSaving(false);
                    }
                  },
                },
              ]);
            }}
          />
        }
        onSubmit={async (body) => {
          if (!id || !allergyId || saving) return;
          setSaving(true);
          setError(null);
          try {
            await api.pets.allergies.update(id, allergyId, body);
            router.replace(`/pets/${id}/allergies`);
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
