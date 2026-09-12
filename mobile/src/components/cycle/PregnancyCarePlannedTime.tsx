import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { formatClockTime, isClockTime, parseClockTime } from '@/lib/pregnancyCareAppointmentTimeContract.js';
import { isCivilDateKey } from '@/lib/pregnancyCareCatalog.js';

type Colors = {
  ink: string;
  muted: string;
  border: string;
  card: string;
  roseSoft: string;
  brand: string;
};

type Copy = {
  plannedTime: string;
  plannedTimeAdd: string;
  plannedTimeChange: string;
  plannedTimeClear: string;
  plannedTimeHint: string;
  plannedTimeNeedDate: string;
};

type Props = {
  plannedDate: string;
  plannedTime: string | null;
  disabled?: boolean;
  colors: Colors;
  copy: Copy;
  onPick: (time: string) => void;
  onClear: () => void;
};

function dateForPicker(time: string | null) {
  const now = new Date();
  const parsed = parseClockTime(time || '');
  if (!parsed) return now;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), parsed.hour, parsed.minute, 0, 0);
}

export function PregnancyCarePlannedTime({
  plannedDate,
  plannedTime,
  disabled,
  colors: c,
  copy,
  onPick,
  onClear,
}: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(() => dateForPicker(plannedTime));
  const hasDate = isCivilDateKey(plannedDate);
  const saved = isClockTime(plannedTime) ? plannedTime : null;

  function apply(date: Date | undefined) {
    if (!date) return;
    const next = formatClockTime(date.getHours(), date.getMinutes());
    if (next) onPick(next);
  }

  function openPicker() {
    if (!hasDate || disabled) return;
    const value = dateForPicker(saved);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'time',
        is24Hour: true,
        onValueChange: (_event, date) => apply(date),
        onDismiss: () => {},
      });
      return;
    }
    setIosDraft(value);
    setIosOpen(true);
  }

  if (!hasDate) {
    return (
      <View style={{ marginTop: 10 }}>
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{copy.plannedTimeNeedDate}</Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{copy.plannedTime}</Text>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{copy.plannedTimeHint}</Text>
      {saved ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, marginTop: 8 }}
        >
          {saved}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <Pressable
          onPress={openPicker}
          accessibilityRole="button"
          accessibilityLabel={saved ? `${copy.plannedTimeChange}, ${saved}` : copy.plannedTimeAdd}
          disabled={disabled}
          style={{
            minHeight: 44,
            paddingHorizontal: 14,
            borderRadius: 12,
            backgroundColor: c.roseSoft,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>
            {saved ? copy.plannedTimeChange : copy.plannedTimeAdd}
          </Text>
        </Pressable>
        {saved ? (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={copy.plannedTimeClear}
            disabled={disabled}
            style={{
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.card,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold' }}>{copy.plannedTimeClear}</Text>
          </Pressable>
        ) : null}
      </View>
      {iosOpen ? (
        <DateTimePicker
          value={iosDraft}
          mode="time"
          display="spinner"
          is24Hour
          onChange={(event, date) => {
            if (event.type === 'dismissed') {
              setIosOpen(false);
              return;
            }
            if (date) setIosDraft(date);
            if (event.type === 'set') {
              apply(date);
              setIosOpen(false);
            }
          }}
        />
      ) : null}
    </View>
  );
}
