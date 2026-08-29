import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { CycleCalendar } from '@/components/cycle/CycleCalendar';
import type { CycleDayMark } from '@/lib/api';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  visible: boolean;
  onClose: () => void;
  year: number;
  month: number;
  marks: Record<string, CycleDayMark>;
  selected: string;
  onSelect: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
};

export function CycleCalendarSheet({
  visible,
  onClose,
  year,
  month,
  marks,
  selected,
  onSelect,
  onPrev,
  onNext,
}: Props) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom + 16,
            borderTopWidth: 1,
            borderColor: c.border,
            maxHeight: '88%',
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.creamDeep,
              alignSelf: 'center',
              marginBottom: 14,
            }}
          />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 12,
              paddingHorizontal: 4,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 20, fontWeight: '800' }}>
                {ka.cycle.calendarTitle}
              </Text>
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 3 }}>
                {ka.cycle.calendarSheetHint}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: c.roseSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} color={c.rose} strokeWidth={2.4} />
            </Pressable>
          </View>

          <CycleCalendar
            year={year}
            month={month}
            marks={marks}
            selected={selected}
            onSelect={(d) => {
              onSelect(d);
              onClose();
            }}
            onPrev={onPrev}
            onNext={onNext}
          />

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 14,
              marginTop: 14,
            }}
          >
            <Legend dot={c.period} label={ka.cycle.legendPeriod} ink={c.muted} />
            <Legend dot={c.fertile} label={ka.cycle.legendFertile} ink={c.muted} />
            <Legend dot={c.ovulation} label={ka.cycle.legendOvulation} ink={c.muted} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Legend({ dot, label, ink }: { dot: string; label: string; ink: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
      <Text style={{ color: ink, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
