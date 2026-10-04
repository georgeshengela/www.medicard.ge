import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, View, type LayoutChangeEvent } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { FolderHeart, Footprints, House, Pill, User, type LucideIcon } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { getRunState } from '@/lib/run/store';
import { useThemeColors } from '@/theme/colors';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import { tx } from '@/i18n/locale';

export const TAB_BAR_HEIGHT = 64;
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
  { href: '/(tabs)/medications', name: 'medications', title: ka.tabs.medications, Icon: Pill },
  { href: '/(tabs)/profile', name: 'profile', title: ka.tabs.profile, Icon: User },
];

/**
 * Centre of a tab in slot units. Each side owns two of the five slots (RUN sits in the middle one);
 * when an admin pauses a tab's module the other tab on that side takes the whole half.
 */
function slotCenter(name: TabDef['name'] | 'run', left: TabDef[], right: TabDef[]): number | null {
  const l = left.findIndex((tab) => tab.name === name);
  if (l >= 0) return (l + 0.5) * (2 / left.length);
  const r = right.findIndex((tab) => tab.name === name);
  if (r >= 0) return 3 + (r + 0.5) * (2 / right.length);
  return null;
}

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
  const reduceMotion = usePrefersReducedMotion();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  const reveal = useSharedValue(visible ? 1 : 0);
  // Records and medications tabs leave the bar while their module is paused (admin „მოდულები“).
  const features = useFeatureState();
  const leftTabs = LEFT_TABS.filter((tab) => isHrefAvailable(tab.href, features));
  const rightTabs = RIGHT_TABS.filter((tab) => isHrefAvailable(tab.href, features));

  useEffect(() => {
    reveal.value = withTiming(visible ? 1 : 0, {
      duration: visible && !reduceMotion ? 180 : 0,
      easing: Easing.out(Easing.cubic),
    });
  }, [reveal, visible, reduceMotion]);

  const barRevealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - reveal.value) * 10 }],
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
  const activeCenter = slotCenter(selected, leftTabs, rightTabs);
  const tabWidth = trackWidth > 0 ? (trackWidth - innerPad * 2) / slotCount : 0;

  useEffect(() => {
    if (tabWidth === 0 || activeCenter == null) return;
    const position = innerPad + (activeCenter - 0.5) * tabWidth;
    translateX.value = reduceMotion ? position : withTiming(position, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [activeCenter, tabWidth, translateX, reduceMotion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const goTab = (tab: TabDef) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setSelected(tab.name);
    if (tab.name === selected) return;
    router.replace(tab.href);
  };

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      aria-hidden={!visible}
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
        {tabWidth > 0 && activeCenter != null ? (
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

        <View style={{ flex: 2, height: '100%', flexDirection: 'row' }}>
          {leftTabs.map((tab) => (
            <TabButton key={tab.name} tab={tab} focused={tab.name === selected} color={tab.name === selected ? colors.primary100 : colors.text200} onPress={() => goTab(tab)} />
          ))}
        </View>

        <View style={{ flex: 1, height: '100%' }} />

        <View style={{ flex: 2, height: '100%', flexDirection: 'row' }}>
          {rightTabs.map((tab) => (
            <TabButton key={tab.name} tab={tab} focused={tab.name === selected} color={tab.name === selected ? colors.primary100 : colors.text200} onPress={() => goTab(tab)} />
          ))}
        </View>
      </View>

      {/* Hidden bar: the RUN overlay must drop touches too — on web a child's „box-none“ re-enables them under a „none“ parent. */}
      <View
        pointerEvents={visible ? 'box-none' : 'none'}
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
            shadowColor: colors.primary100,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
          }}
        >
          <Footprints size={22} color="#FFFFFF" strokeWidth={2.2} /><Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 8, fontWeight: '700', marginTop: 1 }}>RUN</Text>
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
      <tab.Icon size={20} color={color} strokeWidth={focused ? 2.3 : 1.8} />
      <Text numberOfLines={1} style={{ color, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 9, marginTop: 4 }}>{tab.name === 'medications' ? tx('წამლები', 'Meds') : tab.name === 'records' ? tx('ბარათი', 'Card') : tab.title}</Text>
    </TouchableOpacity>
  );
}
