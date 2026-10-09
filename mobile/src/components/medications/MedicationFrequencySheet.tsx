import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MedicationSheetApplyButton, MedicationSheetModal } from '@/components/medications/MedicationSheetUI';
import { ka } from '@/i18n/ka';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { hubInk, hubText, hubTint } from '@/theme/hub';
import { medsInk } from '@/components/medications/MedsHubUI';
import { MAX_TIMES_PER_DAY } from '@/lib/medications.shared';

// No more than the server accepts: picking 9–12 used to fail only at save, with a generic error.
const OPTIONS = Array.from({ length: MAX_TIMES_PER_DAY }, (_, i) => i + 1);

type Props = {
  visible: boolean;
  value: number;
  onClose: () => void;
  onApply: (timesPerDay: number) => void;
};

/** How many times a day — a 4×2 grid of counts instead of a scrolling list. */
export function MedicationFrequencySheet({ visible, value, onClose, onApply }: Props) {
  const c = useThemeColors();
  const dark = useIsDark();
  const accent = medsInk(dark);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  return (
    <MedicationSheetModal
      visible={visible}
      title={ka.meds.frequencySheetTitle}
      subtitle={ka.meds.frequencyPickerHint}
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
      <View style={{ paddingVertical: 10, gap: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {OPTIONS.map((n) => {
            const active = draft === n;
            return (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={ka.meds.timesPerDayLabel(n)}
                onPress={() => setDraft(n)}
                style={{
                  flexBasis: '22%',
                  flexGrow: 1,
                  minHeight: 56,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? hubTint(accent, dark) : c.bg200,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 22,
                    lineHeight: 28,
                    color: active ? accent : c.text100,
                  }}
                >
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[hubText.body, { color: c.text200, textAlign: 'center' }]}>{ka.meds.timesPerDayLabel(draft)}</Text>
      </View>
    </MedicationSheetModal>
  );
}
