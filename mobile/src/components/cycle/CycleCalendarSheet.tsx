import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { CycleCalendar } from '@/components/cycle/CycleCalendar';
import type { CycleDayMark } from '@/lib/api';
import { ka } from '@/i18n/ka';
import { useCycleColors, type CyclePalette } from '@/theme/cycle';

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
  onToday?: () => void;
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
  onToday,
}: Props) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();

  const legend = [
    { fill: c.period, label: ka.cycle.legendPeriod },
    { ring: c.period, label: ka.cycle.legendPeriodPredicted },
    { fill: c.fertile, label: ka.cycle.legendFertile },
    { fill: c.ovulation, label: ka.cycle.legendOvulation },
    { dot: c.blushDeep, label: ka.cycle.legendLogged },
  ];

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.close}
          onPress={onClose}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: c.overlay }]}
        />

        <View
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            borderTopWidth: 1,
            borderColor: c.border,
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.creamDeep,
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 16,
              gap: 10,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  color: c.ink,
                  fontSize: 20,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  letterSpacing: -0.3,
                }}
              >
                {ka.cycle.calendarTitle}
              </Text>
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 4, lineHeight: 16 }}>
                {ka.cycle.calendarSheetHint}
              </Text>
            </View>
            {onToday ? (
              <Pressable
                onPress={onToday}
                accessibilityRole="button"
                accessibilityLabel={ka.cycle.jumpToday}
                style={({ pressed }) => ({
                  height: 36,
                  paddingHorizontal: 14,
                  borderRadius: 18,
                  backgroundColor: c.cardSoft,
                  borderWidth: 1,
                  borderColor: c.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text
                  style={{
                    color: c.brand,
                    fontSize: 13,
                    fontFamily: 'NotoSansGeorgian_700Bold',
                  }}
                >
                  {ka.cycle.jumpToday}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={ka.common.close}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: c.cardSoft,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <X size={18} color={c.ink} strokeWidth={2.4} />
            </Pressable>
          </View>

          <CycleCalendar
            embedded
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

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, rowGap: 10 }}>
            {legend.map((item) => (
              <Legend key={item.label} {...item} c={c} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Legend({
  fill,
  ring,
  dot,
  label,
  c,
}: {
  fill?: string;
  ring?: string;
  dot?: string;
  label: string;
  c: CyclePalette;
}) {
  return (
    <View style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: fill || (dot ? dot : 'transparent'),
          borderWidth: ring ? 2 : 0,
          borderColor: ring || 'transparent',
        }}
      />
      <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
});
