import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MedicationSheetApplyButton, MedicationSheetModal } from '@/components/medications/MedicationSheetUI';
import { FIGMA_MEDS } from '@/constants/figmaMedicationsLayout';
import { ka } from '@/i18n/ka';
import { formatTime12h } from '@/lib/medications.shared';

type FocusField = 'hour' | 'minute';

type Props = {
  visible: boolean;
  value: string;
  onClose: () => void;
  onApply: (time24: string) => void;
};

function parseTime24(value: string) {
  const [h, m] = value.split(':').map(Number);
  const hour24 = Number.isFinite(h) ? h : 8;
  const minute = Number.isFinite(m) ? m : 0;
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return { hour12, minute, period };
}

function toTime24(hour12: number, minute: number, period: 'AM' | 'PM') {
  let h = hour12 % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function TimeBox({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, gap: 7 }}>
      <View
        style={{
          minHeight: 80,
          borderRadius: 16,
          borderWidth: active ? 2 : 1,
          borderColor: active ? FIGMA_MEDS.brand : FIGMA_MEDS.border,
          backgroundColor: active ? FIGMA_MEDS.brandQuaternary : FIGMA_MEDS.cardBg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          paddingHorizontal: 16,
        }}
      >
        <Text
          style={{
            fontSize: 48,
            lineHeight: 56,
            fontWeight: '600',
            letterSpacing: -0.75,
            color: active ? FIGMA_MEDS.brand : FIGMA_MEDS.textPrimary,
          }}
        >
          {value}
        </Text>
        {active ? (
          <View style={{ width: 2, height: 42, backgroundColor: FIGMA_MEDS.brand, marginLeft: 2 }} />
        ) : null}
      </View>
      <Text style={{ textAlign: 'center', fontSize: 14, fontWeight: '500', color: FIGMA_MEDS.textPrimary }}>{label}</Text>
    </Pressable>
  );
}

export function MedicationTimePickerSheet({ visible, value, onClose, onApply }: Props) {
  const parsed = useMemo(() => parseTime24(value), [value]);
  const [hour12, setHour12] = useState(parsed.hour12);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.period);
  const [focus, setFocus] = useState<FocusField>('hour');

  useEffect(() => {
    if (!visible) return;
    const next = parseTime24(value);
    setHour12(next.hour12);
    setMinute(next.minute);
    setPeriod(next.period);
    setFocus('hour');
  }, [visible, value]);

  const time24 = toTime24(hour12, minute, period);
  const preview = ka.meds.remindMeAt(formatTime12h(time24));

  const stepHour = (delta: number) => {
    setHour12((h) => {
      let next = h + delta;
      if (next > 12) next = 1;
      if (next < 1) next = 12;
      return next;
    });
  };

  const stepMinute = (delta: number) => {
    setMinute((m) => {
      let next = m + delta;
      if (next >= 60) next = 0;
      if (next < 0) next = 45;
      return next;
    });
  };

  return (
    <MedicationSheetModal
      visible={visible}
      title={ka.meds.timeSheetTitle}
      onClose={onClose}
      footer={
        <MedicationSheetApplyButton
          onPress={() => {
            onApply(time24);
            onClose();
          }}
        />
      }
    >
      <View style={{ paddingVertical: 24, gap: 24 }}>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: FIGMA_MEDS.cardBgTertiary,
            borderRadius: 16,
            padding: 4,
          }}
        >
          {(['AM', 'PM'] as const).map((p) => {
            const active = period === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={{
                  flex: 1,
                  minHeight: 36,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? FIGMA_MEDS.white : 'transparent',
                  ...(active ? FIGMA_MEDS.shadowInput : {}),
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: active ? FIGMA_MEDS.textPrimary : FIGMA_MEDS.textSecondary }}>
                  {p}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TimeBox
            label={ka.meds.hourLabel}
            value={String(hour12).padStart(2, '0')}
            active={focus === 'hour'}
            onPress={() => setFocus('hour')}
          />
          <TimeBox
            label={ka.meds.minuteLabel}
            value={String(minute).padStart(2, '0')}
            active={focus === 'minute'}
            onPress={() => setFocus('minute')}
          />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24 }}>
          <Pressable onPress={() => (focus === 'hour' ? stepHour(-1) : stepMinute(-15))}>
            <Text style={{ fontSize: 28, color: FIGMA_MEDS.brand, fontWeight: '600' }}>−</Text>
          </Pressable>
          <Pressable onPress={() => (focus === 'hour' ? stepHour(1) : stepMinute(15))}>
            <Text style={{ fontSize: 28, color: FIGMA_MEDS.brand, fontWeight: '600' }}>+</Text>
          </Pressable>
        </View>

        <Text style={{ textAlign: 'center', fontSize: 14, color: FIGMA_MEDS.textSecondary }}>{preview}</Text>
      </View>
    </MedicationSheetModal>
  );
}
