import React from 'react';
import { View } from 'react-native';
import { MedicationHubScreen } from '@/components/medications/MedicationHubScreen';

export default function MedicationsTab() {
  return (
    <View style={{ flex: 1 }}>
      <MedicationHubScreen />
    </View>
  );
}
