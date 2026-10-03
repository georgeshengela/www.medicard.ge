import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import { ModuleWordmark } from '@/components/brand/ModuleWordmark';
import React from 'react';
import { Text, View } from 'react-native';
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
}: {
  onPress: () => void;
  children: React.ReactNode;
  label: string;
}) {
  const c = useCycleColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      hitSlop={8}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.card,
      }}
    >
      {children}
    </Pressable>
  );
}

/**
 * Hub-style header: back, the module name with one quiet context line, settings.
 * The month lives here (the strip and calendar below follow it); status lives in the hero, not twice.
 */
export function CycleHomeHeader({
  monthLabel,
  subtitle,
  topInset,
  onBack,
  onSettings,
}: Props) {
  const c = useCycleColors();

  return (
    <View style={{ paddingTop: topInset + 6, paddingHorizontal: 20, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBtn onPress={onBack} label={ka.common.back}>
          <ChevronLeft size={21} color={c.ink} strokeWidth={2.1} />
        </IconBtn>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ModuleWordmark module="cycle" color={c.ink} />
          <Text
            numberOfLines={1}
            accessibilityLabel={subtitle ? `${monthLabel}. ${subtitle}` : monthLabel}
            style={{ color: c.mutedSoft, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 17 }}
          >
            {monthLabel}
          </Text>
        </View>
        <IconBtn onPress={onSettings} label={ka.cycle.settings}>
          <Settings2 size={19} color={c.ink} strokeWidth={2} />
        </IconBtn>
      </View>
    </View>
  );
}
