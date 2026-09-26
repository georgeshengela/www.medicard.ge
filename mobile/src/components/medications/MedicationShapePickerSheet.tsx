import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { MedicationSheetApplyButton, MedicationSheetModal } from '@/components/medications/MedicationSheetUI';
import { ALL_PILL_SHAPES } from '@/constants/figmaMedicationsLayout';
import { pillShapeLabel } from '@/constants/medicationPillAssets';
import { ka } from '@/i18n/ka';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { hubInk, hubText, hubTint } from '@/theme/hub';
import type { PillShape } from '@/types/medications';

type Props = {
  visible: boolean;
  value: PillShape;
  onClose: () => void;
  onApply: (shape: PillShape) => void;
};

export function MedicationShapePickerSheet({ visible, value, onClose, onApply }: Props) {
  const c = useThemeColors();
  const dark = useIsDark();
  const teal = hubInk('teal', dark);
  const [draft, setDraft] = useState<PillShape>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  return (
    <MedicationSheetModal
      visible={visible}
      title={ka.meds.shapePickerTitle}
      onClose={onClose}
      scrollable
      footer={
        <MedicationSheetApplyButton
          onPress={() => {
            onApply(draft);
            onClose();
          }}
        />
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 8 }}>
        {ALL_PILL_SHAPES.map((shape) => {
          const active = draft === shape;
          const label = pillShapeLabel(shape, ka.meds.shapeLabels);
          return (
            <Pressable
              key={shape}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              onPress={() => setDraft(shape)}
              style={{
                flexBasis: '22%',
                flexGrow: 1,
                alignItems: 'center',
                gap: 8,
                paddingVertical: 12,
                borderRadius: 18,
                backgroundColor: active ? hubTint(teal, dark) : c.bg200,
              }}
            >
              <MedicationPillIcon shape={shape} size={52} />
              <Text numberOfLines={1} style={[hubText.small, { color: active ? teal : c.text200, fontFamily: active ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_400Regular' }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </MedicationSheetModal>
  );
}
