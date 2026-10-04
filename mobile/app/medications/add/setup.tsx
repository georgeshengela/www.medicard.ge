import React from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MedicationSetupForm } from '@/components/medications/MedicationSetupForm';
import { ka } from '@/i18n/ka';

function paramStr(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function MedicationSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    generic?: string;
    imageUrl?: string;
    catalogProductId?: string;
    manufacturer?: string;
    strength?: string;
    formLabel?: string;
  }>();

  return (
    <>
      <Stack.Screen options={{ title: ka.meds.addMedicationScreenTitle }} />
      <MedicationSetupForm
        initialName={paramStr(params.name)}
        initialGeneric={paramStr(params.generic) || undefined}
        initialImageUrl={paramStr(params.imageUrl) || undefined}
        catalogProductId={paramStr(params.catalogProductId) || undefined}
        manufacturer={paramStr(params.manufacturer) || undefined}
        strength={paramStr(params.strength) || undefined}
        formLabel={paramStr(params.formLabel) || undefined}
        onSaved={() => router.replace('/(tabs)/medications')}
      />
    </>
  );
}
