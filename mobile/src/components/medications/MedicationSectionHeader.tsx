import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useFigmaMeds } from '@/constants/figmaMedicationsLayout';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function MedicationSectionHeader({ title, actionLabel, onAction }: Props) {
  const FIGMA_MEDS = useFigmaMeds();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: FIGMA_MEDS.textPrimary }}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: FIGMA_MEDS.brand }}>{actionLabel}</Text>
          <ChevronRight size={16} color={FIGMA_MEDS.brand} strokeWidth={2.5} />
        </Pressable>
      ) : null}
    </View>
  );
}
