import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MedicationSheetApplyButton, MedicationSheetModal } from '@/components/medications/MedicationSheetUI';
import { useFigmaMeds } from '@/constants/figmaMedicationsLayout';
import { ka } from '@/i18n/ka';

const OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

type Props = {
  visible: boolean;
  value: number;
  onClose: () => void;
  onApply: (timesPerDay: number) => void;
};

export function MedicationFrequencySheet({ visible, value, onClose, onApply }: Props) {
  const FIGMA_MEDS = useFigmaMeds();
  const [draft, setDraft] = useState(value);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    requestAnimationFrame(() => {
      const index = Math.max(0, value - 1);
      scrollRef.current?.scrollTo({ y: index * 48 - 88, animated: false });
    });
  }, [visible, value]);

  return (
    <MedicationSheetModal
      visible={visible}
      title={ka.meds.frequencySheetTitle}
      onClose={onClose}
      contentStyle={{ paddingHorizontal: 0 }}
      footer={
        <MedicationSheetApplyButton
          onPress={() => {
            onApply(draft);
            onClose();
          }}
        />
      }
    >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        style={{ maxHeight: 220 }}
        contentContainerStyle={{ paddingVertical: 4, paddingHorizontal: 16 }}
      >
        {OPTIONS.map((n) => {
          const active = draft === n;
          const muted = Math.abs(n - draft) > 1;
          return (
            <Pressable
              key={n}
              onPress={() => setDraft(n)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                marginBottom: 2,
                borderRadius: active ? 18 : 0,
                borderWidth: active ? 1 : 0,
                borderColor: FIGMA_MEDS.brand,
                backgroundColor: active ? FIGMA_MEDS.brandQuaternary : 'transparent',
              }}
            >
              <Text
                style={{
                  textAlign: 'center',
                  fontSize: active ? 24 : 20,
                  lineHeight: active ? 30 : 26,
                  fontWeight: '400',
                  letterSpacing: -0.25,
                  color: active ? FIGMA_MEDS.brand : muted ? FIGMA_MEDS.textMuted : FIGMA_MEDS.textSecondary,
                }}
              >
                {n}
              </Text>
              {active ? (
                <Text style={{ textAlign: 'center', fontSize: 12, color: FIGMA_MEDS.textSecondary, marginTop: 2 }}>
                  {ka.meds.timesPerDayLabel(n)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </MedicationSheetModal>
  );
}
