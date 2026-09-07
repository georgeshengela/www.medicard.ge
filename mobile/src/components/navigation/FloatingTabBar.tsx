import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CalendarClock, FolderHeart, Footprints, House, User, type LucideIcon } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { getHomeLanding, resolveInitialRoute } from '@/lib/homeScreenPrefs';
import { getRunState } from '@/lib/run/store';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';

export const TAB_BAR_HEIGHT = 58;
export const TAB_BAR_SIDE = 20;
/** Extra clearance so the last Home / Meds cards sit above the overlay pill (OBS-VIS-01). */
export const TAB_BAR_SCROLL_EXTRA = 96;

/** Space so scroll content clears the overlay pill. */
export function useTabBarInset(extra = TAB_BAR_SCROLL_EXTRA): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + 10 + Math.max(insets.bottom, 12) + extra;
}

type TabHref = '/(tabs)/home' | '/(tabs)/records' | '/(tabs)/medications' | '/(tabs)/profile';

type TabDef = {
  href: TabHref;
  name: 'home' | 'records' | 'medications' | 'profile';
  title: string;
  Icon: LucideIcon;
};

const LEFT_TABS: TabDef[] = [
  { href: '/(tabs)/home', name: 'home', title: ka.tabs.home, Icon: House },
  { href: '/(tabs)/records', name: 'records', title: ka.tabs.records, Icon: FolderHeart },
];

const RIGHT_TABS: TabDef[] = [
  { href: '/(tabs)/medications', name: 'medications', title: ka.tabs.medications, Icon: CalendarClock },
  { href: '/(tabs)/profile', name: 'profile', title: ka.tabs.profile, Icon: User },
];

const SPRING = { damping: 22, stiffness: 260, mass: 0.7 };

function openLiveRun(router: ReturnType<typeof useRouter>) {
  const phase = getRunState().phase;
  if (phase === 'running' || phase === 'paused' || phase === 'ready' || phase === 'preparing') {
    router.push('/run/active' as never);
    return;
  }
  router.push('/run' as never);
}

/**
 * App tab chrome. Rendered in the root layout, *outside* the native stack,
 * so screen views cannot cover it or steal taps.
 */
export function FloatingTabBar({ visible = true }: { visible?: boolean }) {
  const colors = useThemeColors();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  const reveal = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    reveal.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 220 : 0,
      easing: Easing.out(Easing.cubic),
    });
  }, [reveal, visible]);

  const barRevealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 18 }],
  }));
  const segs = segments as string[];
  const onRunHub = segs[0] === 'run' && (segs.length === 1 || segs[1] === 'index');
  const current: TabDef['name'] | 'run' = onRunHub ? 'run' : ((segs[1] as TabDef['name'] | undefined) ?? 'home');
  const [selected, setSelected] = useState<TabDef['name'] | 'run'>(current);

  useEffect(() => {
    setSelected(current);
  }, [current]);

  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useSharedValue(0);
  const innerPad = 5;
  const slotCount = 5;
  const activeSlot =
    selected === 'home' ? 0 : selected === 'records' ? 1 : selected === 'medications' ? 3 : selected === 'profile' ? 4 : -1;
  const tabWidth = trackWidth > 0 ? (trackWidth - innerPad * 2) / slotCount : 0;

  useEffect(() => {
    if (tabWidth === 0 || activeSlot < 0) return;
    translateX.value = withSpring(innerPad + activeSlot * tabWidth, SPRING);
  }, [activeSlot, tabWidth, translateX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const goTab = (tab: TabDef) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setSelected(tab.name);
    if (tab.name === selected) return;
    if (tab.name === 'home') {
      void getHomeLanding().then((landing) => {
        router.replace(resolveInitialRoute(landing, user?.gender) as never);
      });
      return;
    }
    router.replace(tab.href);
  };

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 20,
          backgroundColor: 'transparent',
          paddingHorizontal: TAB_BAR_SIDE,
          paddingTop: 18,
          paddingBottom: Math.max(insets.bottom, 12),
        },
        barRevealStyle,
      ]}
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
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 16,
        }}
      >
        {tabWidth > 0 && activeSlot >= 0 ? (
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

        {LEFT_TABS.map((tab) => (
          <TabButton key={tab.name} tab={tab} focused={tab.name === selected} color={tab.name === selected ? colors.primary200 : colors.text300} onPress={() => goTab(tab)} />
        ))}

        <View style={{ flex: 1, height: '100%' }} />

        {RIGHT_TABS.map((tab) => (
          <TabButton key={tab.name} tab={tab} focused={tab.name === selected} color={tab.name === selected ? colors.primary200 : colors.text300} onPress={() => goTab(tab)} />
        ))}
      </View>

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          alignItems: 'center',
        }}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={ka.run.title}
          activeOpacity={0.85}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
            if (onRunHub) return;
            openLiveRun(router);
          }}
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary200,
            borderWidth: 4,
            borderColor: onRunHub ? colors.accent200 : colors.bg100,
            elevation: 10,
            shadowColor: '#0F766E',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
          }}
        >
          <Footprints size={24} color="#FFFFFF" strokeWidth={2.4} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function TabButton({
  tab,
  focused,
  color,
  onPress,
}: {
  tab: TabDef;
  focused: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={tab.title}
      activeOpacity={0.65}
      onPress={onPress}
      style={{
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
      }}
    >
      <tab.Icon size={23} color={color} strokeWidth={focused ? 2.5 : 1.9} />
    </TouchableOpacity>
  );
}
