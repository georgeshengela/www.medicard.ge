import React, { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { MedCatalogBrowser } from '@/components/pharmacy/MedCatalogBrowser';
import { ka } from '@/i18n/ka';
import { api } from '@/lib/api';

/** One category of the catalogue; the header's line names it once the categories load. */
export default function PharmacyCategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [name, setName] = useState('');

  useEffect(() => {
    if (!slug) return;
    void api.pharmacy
      .categories()
      .then((res) => {
        const flat = res.categories.flatMap((cat) => (cat.children?.length ? [cat, ...cat.children] : [cat]));
        setName(flat.find((cat) => cat.slug === slug)?.nameKa ?? '');
      })
      .catch(() => undefined);
  }, [slug]);

  return (
    <>
      <Stack.Screen options={{ title: name || ka.pharmacy.categories }} />
      <MedCatalogBrowser category={String(slug ?? '')} sort="best_price" />
    </>
  );
}
