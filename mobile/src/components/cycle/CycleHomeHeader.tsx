import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CalendarDays, ChevronLeft, Settings2 } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  monthLabel: string;
  subtitle: string;
  topInset: number;
  onBack: () => void;
  onCalendar: () => void;
  onSettings: () => void;
};

function IconBtn({
  onPress,
  children,
  label,
  filled,
}: {
  onPress: () => void;
  children: React.ReactNode;
  label: string;
  filled?: boolean;
}) {
  const c = useCycleColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      hitSlop={10}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? c.cta : 'transparent',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

export function CycleHomeHeader({
  monthLabel,
  subtitle,
  topInset,
  onBack,
  onCalendar,
  onSettings,
}: Props) {
  const c = useCycleColors();

  return (
    <View
      style={{
        paddingTop: topInset + 4,
        paddingHorizontal: 16,
        paddingBottom: 8,
        backgroundColor: c.cream,
        minHeight: 56,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconBtn onPress={onBack} label={ka.common.back}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </IconBtn>

        <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
          <Text
            numberOfLines={1}
            style={{
              color: c.ink,
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 18,
              lineHeight: 24,
            }}
          >
            {monthLabel}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: c.muted,
              fontFamily: 'NotoSansGeorgian_500Medium',
              fontSize: 12,
              lineHeight: 16,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <IconBtn onPress={onCalendar} label={ka.cycle.openFullCalendar}>
            <CalendarDays size={22} color={c.ink} strokeWidth={2.1} />
          </IconBtn>
          <IconBtn onPress={onSettings} label={ka.cycle.settings} filled>
            <Settings2 size={20} color="#FFFFFF" strokeWidth={2.2} />
          </IconBtn>
        </View>
      </View>
    </View>
  );
}
