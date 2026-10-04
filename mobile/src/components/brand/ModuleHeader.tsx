import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import { ModuleWordmark } from '@/components/brand/ModuleWordmark';
import { tx } from '@/i18n/locale';
import { useThemeColors } from '@/theme/colors';
import type { ModuleBrandId } from '@/theme/moduleBrand';

/**
 * The standard MEDI module header (owner 2026-10-04: „სტანდარტული მოდული ჰედერით“ = exactly this),
 * taken 1:1 from the MEDIRUN hub: back button · wordmark (25) with one muted 11 px line · one icon
 * button. Both buttons are 44 × 44 rounded squares (radius 16) on `surface` with a 20 px ink icon.
 * It sits at the top of the page's ScrollView (scrolls away with the content); the scroll content
 * starts at `insets.top + 12` with the 20 px gutter, like MEDIRUN.
 */
export function ModuleHeader({
  module,
  subtitle,
  onBack,
  backLabel = tx('უკან', 'Back'),
  right,
  style,
  fallbackHref = '/(tabs)/home',
}: {
  module: ModuleBrandId;
  subtitle?: string;
  /** Defaults to router.back(), or Home when there is nothing to go back to. */
  onBack?: () => void;
  backLabel?: string;
  /** Usually one `ModuleHeaderButton`; an empty 44 px slot keeps the wordmark in place when omitted. */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Where back leads when there is no history (a cold start from a link or notification). */
  fallbackHref?: string;
}) {
  const c = useThemeColors();
  const router = useRouter();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace(fallbackHref as never)));
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, style]}>
      <ModuleHeaderButton label={backLabel} icon={ArrowLeft} onPress={back} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <ModuleWordmark module={module} />
        {subtitle ? (
          <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, lineHeight: 17, color: c.text200 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? <View style={{ width: 44 }} />}
    </View>
  );
}

/** The header's icon button (MEDIRUN's IconButton): 44 × 44, radius 16, `surface`, 20 px icon in ink. */
export function ModuleHeaderButton({ label, icon: Icon, onPress, color }: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  /** Icon colour; defaults to text100 like MEDIRUN. */
  color?: string;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={{ height: 44, width: 44, borderRadius: 16, backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center' }}
    >
      <Icon size={20} color={color ?? c.text100} />
    </Pressable>
  );
}

/**
 * The same header, pinned above a screen (stack `header`, chats, forms with a pinned footer): the
 * safe area, the canvas behind it and the 20 px gutter, so it looks exactly like the scrolling one.
 */
export function ModuleStackHeader(props: React.ComponentProps<typeof ModuleHeader>) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 20, backgroundColor: c.bg100 }}>
      <ModuleHeader {...props} />
    </View>
  );
}
