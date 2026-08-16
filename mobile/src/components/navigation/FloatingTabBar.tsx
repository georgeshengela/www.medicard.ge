import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CalendarClock, FolderHeart, House, User, type LucideIcon } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';

export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_SIDE = 20;

/** Extra gap under the last card. The bar sits outside the screen, so only a little is needed. */
export function useTabBarInset(extra = 16): number {
  return extra;
}

type TabHref = '/(tabs)/home' | '/(tabs)/records' | '/(tabs)/medications' | '/(tabs)/profile';

type TabDef = {
  href: TabHref;
  name: 'home' | 'records' | 'medications' | 'profile';
  title: string;
  Icon: LucideIcon;
};

const TABS: TabDef[] = [
  { href: '/(tabs)/home', name: 'home', title: ka.tabs.home, Icon: House },
  { href: '/(tabs)/records', name: 'records', title: ka.tabs.records, Icon: FolderHeart },
  { href: '/(tabs)/medications', name: 'medications', title: ka.tabs.medications, Icon: CalendarClock },
  { href: '/(tabs)/profile', name: 'profile', title: ka.tabs.profile, Icon: User },
];

const SPRING = { damping: 22, stiffness: 260, mass: 0.7 };

/**
 * App tab chrome. Rendered in the root layout, *outside* the native stack,
 * so screen views cannot cover it or steal taps.
 */
export function FloatingTabBar() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  const current = ((segments as string[])[1] as TabDef['name'] | undefined) ?? 'home';
  const [selected, setSelected] = useState<TabDef['name']>(current);

  useEffect(() => {
    setSelected(current);
  }, [current]);

  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useSharedValue(0);
  const innerPad = 5;
  const activeIndex = Math.max(0, TABS.findIndex((tab) => tab.name === selected));
  const tabWidth = trackWidth > 0 ? (trackWidth - innerPad * 2) / TABS.length : 0;

  useEffect(() => {
    if (tabWidth === 0) return;
    translateX.value = withSpring(innerPad + activeIndex * tabWidth, SPRING);
  }, [activeIndex, tabWidth, translateX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={{
        backgroundColor: colors.bg100,
        paddingHorizontal: TAB_BAR_SIDE,
        paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, 12),
      }}
    >
      <View
        onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
        collapsable={false}
        style={{
          height: TAB_BAR_HEIGHT,
          borderRadius: TAB_BAR_HEIGHT / 2,
          backgroundColor: colors.surfaceRaised,
          borderWidth: 1,
          borderColor: colors.bg300,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: innerPad,
          overflow: 'hidden',
        }}
      >
        {tabWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: 0,
                top: innerPad,
                width: tabWidth,
                height: TAB_BAR_HEIGHT - innerPad * 2,
                borderRadius: (TAB_BAR_HEIGHT - innerPad * 2) / 2,
                backgroundColor: colors.accent100,
              },
              indicatorStyle,
            ]}
          />
        ) : null}

        {TABS.map((tab) => {
          const focused = tab.name === selected;
          const color = focused ? colors.primary200 : colors.text300;

          return (
            <TouchableOpacity
              key={tab.name}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.title}
              activeOpacity={0.65}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => undefined);
                setSelected(tab.name);
                if (!focused) router.replace(tab.href);
              }}
              style={{
                flex: 1,
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              <tab.Icon size={21} color={color} strokeWidth={focused ? 2.5 : 1.85} />
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 3,
                  fontSize: 10,
                  lineHeight: 13,
                  fontWeight: focused ? '700' : '600',
                  color,
                }}
              >
                {tab.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
