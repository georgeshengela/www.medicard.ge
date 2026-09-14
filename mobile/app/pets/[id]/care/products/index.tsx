import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Package } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/EmptyState';
import { PetListRow, PetPageScroll } from '@/components/pets/PetScreen';
import { ka } from '@/i18n/ka';
import { api, type PetProduct } from '@/lib/api';
import { kindLabel } from '@/lib/petsCare';
import { useThemeColors } from '@/theme/colors';

export default function PetProductsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<PetProduct[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const products = await api.pets.products.list(id);
      setItems(products.items);
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

  return (
    <PetPageScroll>
      {!items.length ? <EmptyState icon={Package} title={ka.pets.productsTitle} body={ka.pets.expiresHint} /> : null}
      {items.map((row) => (
        <PetListRow
          key={row.id}
          title={row.name}
          subtitle={[kindLabel(row.kind, ka.pets), row.expiresOn].filter(Boolean).join(' · ')}
          onPress={() => router.push(`/pets/${id}/care/products/${row.id}`)}
        />
      ))}
      <Button label={ka.pets.productAdd} onPress={() => router.push(`/pets/${id}/care/products/new`)} />
    </PetPageScroll>
  );
}
