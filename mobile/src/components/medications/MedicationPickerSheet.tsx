import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { MedicationBottomSheet } from '@/components/medications/MedicationBottomSheet';
import { FIGMA_MEDS } from '@/constants/figmaMedicationsLayout';

export type MedicationPickerOption = {
  id: string;
  label: string;
  hint?: string;
  leading?: React.ReactNode;
};

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: MedicationPickerOption[];
  value: string;
  onClose: () => void;
  onSelect: (id: string) => void;
};

export function MedicationPickerSheet({ visible, title, subtitle, options, value, onClose, onSelect }: Props) {
  return (
    <MedicationBottomSheet visible={visible} title={title} subtitle={subtitle} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        {options.map((opt, index) => {
          const active = opt.id === value;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onSelect(opt.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 14,
                paddingHorizontal: 4,
                borderBottomWidth: index < options.length - 1 ? 1 : 0,
                borderColor: FIGMA_MEDS.border,
              }}
            >
              {opt.leading ? (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: active ? FIGMA_MEDS.brandQuaternary : FIGMA_MEDS.cardBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {opt.leading}
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: active ? '700' : '600', color: FIGMA_MEDS.textPrimary }}>
                  {opt.label}
                </Text>
                {opt.hint ? (
                  <Text style={{ fontSize: 13, color: FIGMA_MEDS.textSecondary, marginTop: 2 }}>{opt.hint}</Text>
                ) : null}
              </View>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  borderWidth: active ? 0 : 1.5,
                  borderColor: FIGMA_MEDS.borderTertiary,
                  backgroundColor: active ? FIGMA_MEDS.brand : FIGMA_MEDS.white,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {active ? <Check size={16} color="#fff" strokeWidth={2.8} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </MedicationBottomSheet>
  );
}

type GridProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: { id: string; label: string }[];
  value: string;
  onClose: () => void;
  onSelect: (id: string) => void;
};

export function MedicationTimePickerSheet({ visible, title, subtitle, options, value, onClose, onSelect }: GridProps) {
  return (
    <MedicationBottomSheet visible={visible} title={title} subtitle={subtitle} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt) => {
          const active = opt.id === value;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onSelect(opt.id)}
              style={{
                width: '31%',
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: 'center',
                backgroundColor: active ? FIGMA_MEDS.brandQuaternary : FIGMA_MEDS.white,
                borderWidth: 1,
                borderColor: active ? FIGMA_MEDS.brand : FIGMA_MEDS.borderTertiary,
                ...FIGMA_MEDS.shadowInput,
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 14, color: active ? FIGMA_MEDS.brand : FIGMA_MEDS.textSecondary }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
        </View>
      </ScrollView>
    </MedicationBottomSheet>
  );
}
