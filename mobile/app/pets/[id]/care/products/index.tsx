import { PetLoading } from '@/components/pets/PetUi';
import { PetHeaderButton } from '@/components/pets/PetUi';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import { tx } from '@/i18n/locale';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { PetButton as Button } from '@/components/pets/PetUi';
import { EmptyState } from '@/components/EmptyState';
import { PETS_ART } from '@/constants/appArt';
import { careKindArt } from '@/components/pets/PetCareChips';
import { PetListGroup, PetListRow, PetPageScroll } from '@/components/pets/PetScreen';
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

  if (!ready) return <PetLoading />;

  const goNew = () => router.push(`/pets/${id}/care/products/new`);

  return (
    <>
      <Stack.Screen
        options={{
          title: ka.pets.productsTitle,
          headerRight: () => <PetHeaderButton label={ka.pets.productAdd} icon={Plus} onPress={goNew} />,
        }}
      />
      <PetPageScroll>
        {!items.length ? (
          <EmptyState art={PETS_ART.products} title={ka.pets.productsEmpty} body={ka.pets.expiresHint}>
            <Button icon={Plus} label={ka.pets.productAdd} onPress={goNew} />
          </EmptyState>
        ) : null}
        {items.length ? <PetListGroup>{items.map((row) => (
          <PetListRow
            key={row.id}
            art={careKindArt(row.kind)}
            title={row.name}
            subtitle={[kindLabel(row.kind, ka.pets), row.expiresOn ? tx(`ვადა ${formatCycleDateKa(row.expiresOn)}`, `Expires ${formatCycleDateKa(row.expiresOn)}`) : null].filter(Boolean).join(' · ')}
            onPress={() => router.push(`/pets/${id}/care/products/${row.id}`)}
          />
        ))}</PetListGroup> : null}
        {items.length ? <Button icon={Plus} label={ka.pets.productAdd} onPress={goNew} /> : null}
      </PetPageScroll>
    </>
  );
}
