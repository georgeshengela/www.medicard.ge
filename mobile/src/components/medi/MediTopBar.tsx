import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Ellipsis, MessagesSquare, SquarePen } from 'lucide-react-native';
import { ModuleWordmark } from '@/components/brand/ModuleWordmark';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { mediInk } from './mediTheme';
import { tx } from '@/i18n/locale';

/**
 * Compact like every MEDI module header: back · wordmark with one muted line · icon buttons —
 * every conversation (owner 2026-10-10: they live with Medi, not in MEDILAB), new, options.
 */
export function MediTopBar({ subtitle, onBack, onHistory, onNew, onMenu, disabled }: {
  subtitle: string; onBack: () => void; onHistory: () => void; onNew?: () => void; onMenu: () => void; disabled?: boolean;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const icon = (label: string, onPress: () => void, node: React.ReactNode) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={4}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1 }}>
      {node}
    </Pressable>
  );
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.bg100 }}>
      <View style={{ height: 60, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('უკან დაბრუნება', 'Go back')} onPress={onBack}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={24} color={c.text100} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, paddingLeft: 2 }}>
          <ModuleWordmark module="medi" size={25} color={mediInk(dark)} />
          <Text numberOfLines={1} style={{ marginTop: -2, color: c.text200, fontSize: 11, lineHeight: 15, fontFamily: 'NotoSansGeorgian_400Regular' }}>{subtitle}</Text>
        </View>
        {icon(tx('ყველა საუბარი', 'All conversations'), onHistory, <MessagesSquare size={20} color={c.text200} />)}
        {onNew ? icon(tx('ახალი საუბარი', 'New conversation'), onNew, <SquarePen size={20} color={c.text200} />) : null}
        {icon(tx('საუბრის პარამეტრები', 'Conversation options'), onMenu, <Ellipsis size={22} color={c.text200} />)}
      </View>
    </View>
  );
}
