import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Settings2 } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  monthLabel: string;
  subtitle: string;
  topInset: number;
  onBack: () => void;
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
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? c.cta : 'transparent',
      }}
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
  onSettings,
}: Props) {
  const c = useCycleColors();

  return (
    <View
      style={{
        paddingTop: topInset + 4,
        paddingHorizontal: 16,
        paddingBottom: 8,
        backgroundColor: 'transparent',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <IconBtn onPress={onBack} label={ka.common.back}>
          <ChevronLeft size={24} color={c.ink} strokeWidth={2.2} />
        </IconBtn>

        <View style={{ flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 8 }}>
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
            numberOfLines={2}
            style={{
              color: c.muted,
              fontFamily: 'NotoSansGeorgian_500Medium',
              fontSize: 12,
              lineHeight: 16,
              marginTop: 2,
              textAlign: 'center',
            }}
          >
            {subtitle}
          </Text>
        </View>

        <IconBtn onPress={onSettings} label={ka.cycle.settings} filled>
          <Settings2 size={20} color="#FFFFFF" strokeWidth={2.2} />
        </IconBtn>
      </View>
    </View>
  );
}
