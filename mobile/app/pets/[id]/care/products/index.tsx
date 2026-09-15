import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Package, Plus } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/EmptyState';
import { careKindIcon } from '@/components/pets/PetCareChips';
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

  const goNew = () => router.push(`/pets/${id}/care/products/new`);

  return (
    <>
      <Stack.Screen
        options={{
          title: ka.pets.productsTitle,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ka.pets.productAdd}
              onPress={goNew}
              hitSlop={12}
              className="active:opacity-70"
            >
              <Plus size={22} color={colors.primary200} strokeWidth={2.2} />
            </Pressable>
          ),
        }}
      />
      <PetPageScroll>
        {!items.length ? (
          <EmptyState icon={Package} title={ka.pets.productsEmpty} body={ka.pets.expiresHint}>
            <Button icon={Plus} label={ka.pets.productAdd} onPress={goNew} />
          </EmptyState>
        ) : null}
        {items.map((row) => (
          <PetListRow
            key={row.id}
            icon={careKindIcon(row.kind)}
            title={row.name}
            subtitle={[kindLabel(row.kind, ka.pets), row.expiresOn].filter(Boolean).join(' · ')}
            onPress={() => router.push(`/pets/${id}/care/products/${row.id}`)}
          />
        ))}
        {items.length ? <Button icon={Plus} label={ka.pets.productAdd} onPress={goNew} /> : null}
      </PetPageScroll>
    </>
  );
}
