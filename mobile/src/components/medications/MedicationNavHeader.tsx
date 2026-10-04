import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';
import { HUB } from '@/theme/hub';

type StackHeaderProps = {
  navigation: { goBack: () => void; canGoBack: () => boolean };
  options: {
    title?: string;
    headerRight?: (props: { tintColor?: string; canGoBack?: boolean }) => React.ReactNode;
  };
};

/**
 * Every MEDIPILL inner page wears the standard module header (owner 2026-10-04): back · MEDIPILL
 * wordmark with the page's name as its one line · one icon button. It stays pinned above the page,
 * so the way back and the page's one action are always in reach.
 */
export function MedicationNavHeader({ navigation, options }: StackHeaderProps) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const title = typeof options.title === 'string' ? options.title : '';
  const HeaderRight = options.headerRight;

  return (
    <View style={{ paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: HUB.gutter, backgroundColor: c.bg100 }}>
      <ModuleHeader
        module="pill"
        subtitle={title}
        backLabel={ka.common.back}
        onBack={() => navigation.goBack()}
        right={HeaderRight ? <HeaderRight canGoBack={navigation.canGoBack()} tintColor={c.text100} /> : undefined}
      />
    </View>
  );
}

/** The header's one action — the standard square module button. */
export function MedicationHeaderAction({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: LucideIcon;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return <ModuleHeaderButton label={accessibilityLabel} icon={icon} onPress={onPress} />;
}
