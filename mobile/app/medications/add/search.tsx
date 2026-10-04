import React from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { MedCatalogBrowser } from '@/components/pharmacy/MedCatalogBrowser';
import { ka } from '@/i18n/ka';

function paramStr(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/** Adding a medication: the shared MEDIPILL catalogue, opened with the hub's query (or ready to type). */
export default function MedicationSearchScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const q = paramStr(params.q);
  return (
    <>
      <Stack.Screen options={{ title: ka.meds.addTitle }} />
      <MedCatalogBrowser initialQuery={q} autoFocus={!q} />
    </>
  );
}
