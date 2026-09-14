import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { HuntEncounterView } from '@/components/hunt/HuntEncounterView';
import { cancelEncounter, completeEncounter, useHuntSession } from '@/lib/hunt/store';

export default function HuntEncounterScreen() {
  const router = useRouter();
  const { snap } = useHuntSession();
  const preview = Boolean(snap?.simulation || snap?.previewLocal || snap?.encounter?.preview);

  return (
    <View style={{ flex: 1 }}>
      <HuntEncounterView
        preview={preview}
        onNeutralize={() => {
          void completeEncounter().then(() => router.back());
        }}
        onCancel={() => {
          void cancelEncounter().then(() => router.back());
        }}
      />
    </View>
  );
}
