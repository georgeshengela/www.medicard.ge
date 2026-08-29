import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { MedicationSheetApplyButton, MedicationSheetModal } from '@/components/medications/MedicationSheetUI';
import { FIGMA_SHAPE_PICKER_ROWS, pillShapeLabel } from '@/constants/medicationPillAssets';
import { useFigmaMeds } from '@/constants/figmaMedicationsLayout';
import { ka } from '@/i18n/ka';
import type { PillShape } from '@/types/medications';

type Props = {
  visible: boolean;
  value: PillShape;
  onClose: () => void;
  onApply: (shape: PillShape) => void;
};

export function MedicationShapePickerSheet({ visible, value, onClose, onApply }: Props) {
  const FIGMA_MEDS = useFigmaMeds();
  const [draft, setDraft] = useState<PillShape>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  return (
    <MedicationSheetModal
      visible={visible}
      title={ka.meds.shapePickerTitle}
      onClose={onClose}
      footer={
        <MedicationSheetApplyButton
          onPress={() => {
            onApply(draft);
            onClose();
          }}
        />
      }
    >
      <View style={{ gap: 20, paddingVertical: 16 }}>
        {FIGMA_SHAPE_PICKER_ROWS.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={{ flexDirection: 'row', gap: 8 }}>
            {row.map((shape, colIndex) => (
              <Pressable
                key={`${shape}-${rowIndex}-${colIndex}`}
                onPress={() => setDraft(shape)}
                style={{ flex: 1, alignItems: 'center', gap: 8 }}
              >
                <View
                  style={{
                    borderRadius: 999,
                    borderWidth: draft === shape ? 1.33 : 0,
                    borderColor: FIGMA_MEDS.brand,
                    backgroundColor: draft === shape ? FIGMA_MEDS.brandQuaternary : 'transparent',
                    padding: draft === shape ? 2 : 0,
                  }}
                >
                  <MedicationPillIcon shape={shape} size={64} variant="figma" />
                </View>
                <Text style={{ fontSize: 14, color: FIGMA_MEDS.textPrimary, textAlign: 'center' }}>
                  {pillShapeLabel(shape, ka.meds.shapeLabels)}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </MedicationSheetModal>
  );
}
