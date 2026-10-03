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
  // A removable chip without its own tap is a plain View, so its ✕ is not a button inside a button.
  const Outer: React.ElementType = onPress ? Pressable : View;
  return (
    <Outer
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      style={{
        minHeight: 36,
        borderRadius: 18,
        backgroundColor: selected ? T.brandDark : T.cardBg,
        paddingHorizontal: 13,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Text style={{ fontFamily: selected ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_500Medium', fontSize: 13.5, lineHeight: 19, color: selected ? '#FFFFFF' : T.textPrimary }}>{label}</Text>
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onRemove} hitSlop={8}>
          <X size={15} color={selected ? '#FFFFFF' : T.textSecondary} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </Outer>
  );
}
