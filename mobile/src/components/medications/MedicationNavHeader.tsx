import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';

type StackHeaderProps = {
  navigation: { goBack: () => void; canGoBack: () => boolean };
  options: {
    title?: string;
    headerRight?: (props: { tintColor?: string; canGoBack?: boolean }) => React.ReactNode;
  };
};

/** Flat hub header: round back tile, centred title, optional right-hand actions. */
export function MedicationNavHeader({ navigation, options }: StackHeaderProps) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const title = typeof options.title === 'string' ? options.title : '';
  const HeaderRight = options.headerRight;

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: c.bg100 }}>
      <View
        style={{
          minHeight: 60,
          paddingHorizontal: HUB.gutter - 4,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={ka.common.back}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft size={22} color={c.text100} strokeWidth={2.2} />
        </Pressable>

        <Text
          numberOfLines={1}
          accessibilityRole="header"
          style={[hubText.sectionTitle, { flex: 1, textAlign: 'center', color: c.text100 }]}
        >
          {title}
        </Text>

        <View style={{ minWidth: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' }}>
          {HeaderRight ? <HeaderRight canGoBack={navigation.canGoBack()} tintColor={c.text100} /> : null}
        </View>
      </View>
    </View>
  );
}

/** Round header action in the same tile style as the back button. */
export function MedicationHeaderAction({
  icon: Icon,
  onPress,
  accessibilityLabel,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon size={20} color={c.text100} strokeWidth={2.1} />
    </Pressable>
  );
}

export function MedicationHeaderPlus({ onPress }: { onPress: () => void }) {
  return <MedicationHeaderAction icon={Plus} onPress={onPress} accessibilityLabel={ka.meds.quickAdd} />;
}
