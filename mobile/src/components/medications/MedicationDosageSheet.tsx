import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { MedsChip, MedsRoundAction } from '@/components/medications/MedsHubUI';
import { MedicationSheetApplyButton, MedicationSheetModal } from '@/components/medications/MedicationSheetUI';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';
import { hubText } from '@/theme/hub';
import type { MedicationForm } from '@/types/medications';

const DOSAGE_FORMS: MedicationForm[] = ['pills', 'capsules', 'liquid', 'injection'];

type Props = {
  visible: boolean;
  amount: number;
  form: MedicationForm;
  onClose: () => void;
  onApply: (amount: number, form: MedicationForm) => void;
};

export function MedicationDosageSheet({ visible, amount, form, onClose, onApply }: Props) {
  const c = useThemeColors();
  const [draftAmount, setDraftAmount] = useState(amount);
  const [draftForm, setDraftForm] = useState<MedicationForm>(form);

  useEffect(() => {
    if (!visible) return;
    setDraftAmount(amount);
    setDraftForm(form);
  }, [visible, amount, form]);

  const step = (delta: number) => setDraftAmount((v) => Math.max(1, Math.min(99, v + delta)));

  return (
    <MedicationSheetModal
      visible={visible}
      title={ka.meds.dosageSheetTitle}
      subtitle={ka.meds.doseAmountHint}
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
      <View style={{ paddingVertical: 12, gap: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
          <MedsRoundAction icon={Minus} onPress={() => step(-1)} accessibilityLabel="−1" tone="quiet" size={52} />
          <View style={{ minWidth: 96, alignItems: 'center' }}>
            <Text
              accessibilityLiveRegion="polite"
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 54,
                lineHeight: 62,
                letterSpacing: -1,
                color: c.text100,
              }}
            >
              {draftAmount}
            </Text>
            <Text style={[hubText.body, { color: c.text200, marginTop: -4 }]}>{ka.meds.formLabels[draftForm]}</Text>
          </View>
          <MedsRoundAction icon={Plus} onPress={() => step(1)} accessibilityLabel="+1" tone="tonal" size={52} />
        </View>

        <View style={{ gap: 10 }}>
          <Text style={[hubText.caption, { color: c.text200 }]}>{ka.meds.formTypeLabel}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DOSAGE_FORMS.map((item) => (
              <MedsChip
                key={item}
                label={ka.meds.formLabels[item]}
                active={draftForm === item}
                onPress={() => setDraftForm(item)}
              />
            ))}
          </View>
        </View>
      </View>
    </MedicationSheetModal>
  );
}
