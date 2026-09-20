import { PetLoading } from '@/components/pets/PetUi';
import React, { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { PetButton as Button } from '@/components/pets/PetUi';
import { PetHealthStatus } from '@/components/pets/PetHealthStatus';
import { PetWeightForm } from '@/components/pets/PetHealthForms';
import { ka } from '@/i18n/ka';
import { api, type PetWeightLog } from '@/lib/api';
import { petsHealthErrorKind, petsHealthErrorMessage } from '@/lib/petsHealth';
import { useThemeColors } from '@/theme/colors';

export default function PetWeightEditScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id, logId } = useLocalSearchParams<{ id: string; logId: string }>();
  const [log, setLog] = useState<PetWeightLog | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!id || !logId) return;
    try {
      const { log: row } = await api.pets.weight.get(id, logId);
      setLog(row);
      setLoadError(null);
    } catch (caught) {
      setLoadError(caught);
    } finally {
      setReady(true);
    }
  }, [id, logId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const remove = () => {
    Alert.alert(ka.pets.deleteConfirmTitle, ka.pets.deleteConfirmBody, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.pets.deleteAction,
        style: 'destructive',
        onPress: async () => {
          if (!id || !logId || saving) return;
          setSaving(true);
          try {
            await api.pets.weight.remove(id, logId);
            router.replace(`/pets/${id}/weight`);
          } catch (caught) {
            setError(petsHealthErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
            setSaving(false);
          }
        },
      },
    ]);
  };

  if (!ready) return <PetLoading />;
  if (loadError || !log) {
    return <PetHealthStatus error={loadError || { status: 404 }} onRetry={() => void load()} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <PetWeightForm
        initial={log}
        saving={saving}
        error={error}
        footer={<Button icon={Trash2} label={ka.pets.deleteAction} variant="danger" disabled={saving} onPress={remove} />}
        onSubmit={async (body) => {
          if (!id || !logId || saving) return;
          setSaving(true);
          setError(null);
          try {
            await api.pets.weight.update(id, logId, body);
            router.replace(`/pets/${id}/weight`);
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
