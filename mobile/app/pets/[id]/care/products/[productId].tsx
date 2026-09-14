import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { PetProductForm } from './new';
import { ka } from '@/i18n/ka';
import { api, type PetProduct } from '@/lib/api';
import { petsCareErrorMessage } from '@/lib/petsCare';
import { useThemeColors } from '@/theme/colors';

export default function PetProductEditScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id, productId } = useLocalSearchParams<{ id: string; productId: string }>();
  const [product, setProduct] = useState<PetProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!id || !productId) return;
    void api.pets.products
      .get(id, productId)
      .then((res) => setProduct(res.product))
      .catch((caught) => setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError })))
      .finally(() => setReady(true));
  }, [id, productId]);

  const archive = useCallback(() => {
    if (!id || !productId) return;
    Alert.alert(ka.pets.archiveConfirmTitle, ka.pets.productArchived, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.pets.productArchive,
        style: 'destructive',
        onPress: async () => {
          try {
            await api.pets.products.archive(id, productId);
            router.replace(`/pets/${id}/care/products`);
          } catch (caught) {
            setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
          }
        },
      },
    ]);
  }, [id, productId, router]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <PetProductForm
        initial={product}
        saving={saving}
        error={error}
        footer={<Button label={ka.pets.productArchive} variant="danger" onPress={archive} />}
        onSubmit={async (body) => {
          if (!id || !productId || saving) return;
          setSaving(true);
          setError(null);
          try {
            await api.pets.products.update(id, productId, body);
            router.replace(`/pets/${id}/care/products`);
          } catch (caught) {
            setError(petsCareErrorMessage(caught, { ...ka.pets, offline: ka.common.networkError }));
          } finally {
            setSaving(false);
          }
        }}
      />
    </View>
  );
}
