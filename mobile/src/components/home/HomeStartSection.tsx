import React from 'react';
import { View } from 'react-native';
import { HomeCyclePreviewCard } from '@/components/home/HomeCyclePreviewCard';
import { HomeSymptomAssistantCard } from '@/components/home/HomeSymptomAssistantCard';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import type { ModuleTile } from '@/constants/modules';

type Props = {
  spotlights: ModuleTile[];
  firstName?: string;
  onPress: (tile: ModuleTile) => void;
};

export function HomeStartSection({ spotlights, firstName, onPress }: Props) {
  const doctor = spotlights.find((t) => t.key === 'doctor');
  const cycle = spotlights.find((t) => t.key === 'cycle');

  return (
    <View style={{ marginTop: S.sectionTop, gap: 4 }}>
      {doctor ? <HomeSymptomAssistantCard firstName={firstName} onPress={() => onPress(doctor)} /> : null}
      {cycle ? <HomeCyclePreviewCard onPress={() => onPress(cycle)} /> : null}
    </View>
  );
}
