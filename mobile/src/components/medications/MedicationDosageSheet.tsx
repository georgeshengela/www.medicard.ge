import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CircleMinus, CirclePlus } from 'lucide-react-native';
import { MedicationSheetApplyButton, MedicationSheetChip, MedicationSheetModal } from '@/components/medications/MedicationSheetUI';
import { useFigmaMeds } from '@/constants/figmaMedicationsLayout';
import { ka } from '@/i18n/ka';
import type { MedicationForm } from '@/types/medications';

const DOSAGE_FORMS: { id: MedicationForm; labelKey: keyof typeof ka.meds.dosageUnitLabels }[] = [
  { id: 'pills', labelKey: 'tablet' },
  { id: 'capsules', labelKey: 'pill' },
  { id: 'liquid', labelKey: 'teaspoon' },
];

type Props = {
  visible: boolean;
  amount: number;
  form: MedicationForm;
  onClose: () => void;
  onApply: (amount: number, form: MedicationForm) => void;
};

export function MedicationDosageSheet({ visible, amount, form, onClose, onApply }: Props) {
  const FIGMA_MEDS = useFigmaMeds();
  const [draftAmount, setDraftAmount] = useState(amount);
  const [draftForm, setDraftForm] = useState<MedicationForm>(form);

  useEffect(() => {
    if (!visible) return;
    setDraftAmount(amount);
    setDraftForm(form);
  }, [visible, amount, form]);

  const unitLabel = useMemo(() => {
    const key = DOSAGE_FORMS.find((f) => f.id === draftForm)?.labelKey ?? 'tablet';
    return ka.meds.dosageUnitLabels[key];
  }, [draftForm]);

  const step = (delta: number) => setDraftAmount((v) => Math.max(1, Math.min(99, v + delta)));

  return (
    <MedicationSheetModal
      visible={visible}
      title={ka.meds.dosageSheetTitle}
      onClose={onClose}
      footer={
        <MedicationSheetApplyButton
          onPress={() => {
            onApply(draftAmount, draftForm);
            onClose();
          }}
        />
      }
    >
      <View style={{ paddingVertical: 16, gap: 16, alignItems: 'center' }}>
        <View style={{ width: '100%', gap: 6, alignItems: 'center' }}>
          <View
            style={{
              width: '100%',
              flexDirection: 'row',
              alignItems: 'center',
              borderBottomWidth: 1,
              borderColor: FIGMA_MEDS.borderTertiary,
              paddingVertical: 12,
              gap: 20,
            }}
          >
            <Pressable onPress={() => step(-1)} hitSlop={10}>
              <CircleMinus size={28} color={FIGMA_MEDS.textSecondary} strokeWidth={1.8} />
            </Pressable>
            <Text
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 48,
                lineHeight: 54,
                fontWeight: '600',
                letterSpacing: -1,
                color: FIGMA_MEDS.textPrimary,
              }}
            >
              {draftAmount}
            </Text>
            <Pressable onPress={() => step(1)} hitSlop={10}>
              <CirclePlus size={28} color={FIGMA_MEDS.textSecondary} strokeWidth={1.8} />
            </Pressable>
          </View>
          <Text style={{ fontSize: 16, lineHeight: 22, color: FIGMA_MEDS.textPrimary }}>{unitLabel}</Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {DOSAGE_FORMS.map((item) => (
            <MedicationSheetChip
              key={item.id}
              label={ka.meds.dosageUnitLabels[item.labelKey]}
              active={draftForm === item.id}
              onPress={() => setDraftForm(item.id)}
            />
          ))}
        </View>
      </View>
    </MedicationSheetModal>
  );
}
