import React from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MedicationHeaderPlus } from '@/components/medications/MedicationNavHeader';
import { MedicationSetupForm } from '@/components/medications/MedicationSetupForm';
import { ka } from '@/i18n/ka';

export default function MedicationSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; generic?: string }>();

  return (
    <>
      <Stack.Screen
        options={{
          title: ka.meds.addMedicationScreenTitle,
          headerRight: () => (
            <MedicationHeaderPlus onPress={() => router.push('/medications/add/search')} />
          ),
        }}
      />
      <MedicationSetupForm
        initialName={params.name ?? ''}
        initialGeneric={params.generic}
        onSaved={() => router.replace('/(tabs)/medications')}
      />
    </>
  );
}
