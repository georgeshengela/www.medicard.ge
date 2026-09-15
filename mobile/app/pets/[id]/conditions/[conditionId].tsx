import React, { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { PetConditionForm } from '@/components/pets/PetHealthForms';
import { PetHealthStatus } from '@/components/pets/PetHealthStatus';
import { ka } from '@/i18n/ka';
import { api, type PetCondition } from '@/lib/api';
import { petsHealthErrorMessage } from '@/lib/petsHealth';
import { useThemeColors } from '@/theme/colors';

export default function PetConditionEditScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id, conditionId } = useLocalSearchParams<{ id: string; conditionId: string }>();
  const [row, setRow] = useState<PetCondition | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!id || !conditionId) return;
    try {
      const { condition } = await api.pets.conditions.get(id, conditionId);
      setRow(condition);
      setLoadError(null);
    } catch (caught) {
      setLoadError(caught);
    } finally {
      setReady(true);
    }
  }, [id, conditionId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;
  if (loadError || !row) return <PetHealthStatus error={loadError || { status: 404 }} onRetry={() => void load()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <PetConditionForm
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
                    if (!id || !conditionId || saving) return;
                    setSaving(true);
                    try {
                      await api.pets.conditions.remove(id, conditionId);
                      router.replace(`/pets/${id}/conditions`);
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
          if (!id || !conditionId || saving) return;
          setSaving(true);
          setError(null);
          try {
            await api.pets.conditions.update(id, conditionId, body);
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
