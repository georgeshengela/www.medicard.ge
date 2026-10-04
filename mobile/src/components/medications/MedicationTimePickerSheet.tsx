import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { MedsChip, MedsRoundAction, medsInk } from '@/components/medications/MedsHubUI';
import { MedicationSheetApplyButton, MedicationSheetModal } from '@/components/medications/MedicationSheetUI';
import { ka } from '@/i18n/ka';
import { formatTime24h } from '@/lib/medications.shared';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { hubInk, hubText, hubTint } from '@/theme/hub';

type FocusField = 'hour' | 'minute';

type Props = {
  visible: boolean;
  value: string;
  onClose: () => void;
  onApply: (time24: string) => void;
};

const QUICK_TIMES = ['07:00', '08:00', '12:00', '14:00', '18:00', '20:00', '22:00'];
const MINUTE_STEP = 5;

function parseTime24(value: string) {
  const [h, m] = value.split(':').map(Number);
  const hour = Number.isFinite(h) ? Math.max(0, Math.min(23, h)) : 8;
  const minute = Number.isFinite(m) ? Math.max(0, Math.min(59, m)) : 0;
  return { hour, minute };
}

function TimeBox({ label, value, active, onPress }: { label: string; value: string; active: boolean; onPress: () => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const accent = medsInk(dark);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} ${value}`}
      onPress={onPress}
      style={{ flex: 1, gap: 8, alignItems: 'center' }}
    >
      <View
        style={{
          alignSelf: 'stretch',
          minHeight: 88,
          borderRadius: 20,
          backgroundColor: active ? hubTint(accent, dark) : c.bg200,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 46,
            lineHeight: 54,
            letterSpacing: -1,
            color: active ? accent : c.text100,
          }}
        >
          {value}
        </Text>
      </View>
      <Text style={[hubText.caption, { color: active ? accent : c.text200 }]}>{label}</Text>
    </Pressable>
  );
}

/** 24-hour picker: tap a box, nudge it with the round buttons, or grab a common time. */
export function MedicationTimePickerSheet({ visible, value, onClose, onApply }: Props) {
  const c = useThemeColors();
  const initial = parseTime24(value);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [focus, setFocus] = useState<FocusField>('hour');

  useEffect(() => {
    if (!visible) return;
    const next = parseTime24(value);
    setHour(next.hour);
    setMinute(next.minute);
    setFocus('hour');
  }, [visible, value]);

  const time24 = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const stepHour = (delta: number) => setHour((h) => (h + delta + 24) % 24);
  const stepMinute = (delta: number) =>
    setMinute((m) => {
      const snapped = Math.round(m / MINUTE_STEP) * MINUTE_STEP;
      return (snapped + delta + 60) % 60;
    });
  const nudge = (dir: 1 | -1) => (focus === 'hour' ? stepHour(dir) : stepMinute(dir * MINUTE_STEP));

  const pick = (time: string) => {
    const next = parseTime24(time);
    setHour(next.hour);
    setMinute(next.minute);
  };

  return (
    <MedicationSheetModal
      visible={visible}
      title={ka.meds.timeSheetTitle}
      subtitle={ka.meds.remindMeAt(formatTime24h(time24))}
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
      <View style={{ paddingVertical: 12, gap: 20 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <TimeBox label={ka.meds.hourLabel} value={String(hour).padStart(2, '0')} active={focus === 'hour'} onPress={() => setFocus('hour')} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 40, lineHeight: 88, color: c.text300 }}>:</Text>
          <TimeBox label={ka.meds.minuteLabel} value={String(minute).padStart(2, '0')} active={focus === 'minute'} onPress={() => setFocus('minute')} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18 }}>
          <MedsRoundAction icon={Minus} onPress={() => nudge(-1)} accessibilityLabel="−" tone="quiet" size={52} />
          <MedsRoundAction icon={Plus} onPress={() => nudge(1)} accessibilityLabel="+" tone="tonal" size={52} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {QUICK_TIMES.map((t) => (
            <MedsChip key={t} label={t} active={t === time24} onPress={() => pick(t)} />
          ))}
        </View>
      </View>
    </MedicationSheetModal>
  );
}
