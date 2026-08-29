import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
};

export function SymptomChip({ label, selected, onPress, onRemove }: Props) {
  const T = useFigmaSymptoms();
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 32,
        borderRadius: T.chipRadius,
        borderWidth: 1,
        borderColor: selected ? T.brand : T.borderTertiary,
        backgroundColor: selected ? T.brandSoft : T.cardBg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        ...T.shadowXs,
      }}
    >
      <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '500', color: selected ? T.brand : T.textPrimary }}>{label}</Text>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8}>
          <X size={16} color={T.textSecondary} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
