import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ka } from '@/i18n/ka';
import { useIsDark, useThemeColors } from '@/theme/colors';

type BoneProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

const PulseContext = createContext<Animated.Value | null>(null);

function makePulse(value: Animated.Value) {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, {
        toValue: 1,
        duration: 780,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 0.4,
        duration: 780,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]),
  );
}

function SkeletonPulse({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = makePulse(opacity);
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <PulseContext.Provider value={opacity}>{children}</PulseContext.Provider>;
}

function useBoneOpacity() {
  const shared = useContext(PulseContext);
  const local = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    if (shared) return;
    const loop = makePulse(local);
    loop.start();
    return () => loop.stop();
  }, [shared, local]);
  return shared ?? local;
}

/**
 * Layout on a normal View — Reanimated Animated.View drops % widths in Expo.
 * Only opacity is native-driven.
 */
export function Bone({ width = '100%', height = 14, radius = 10, style }: BoneProps) {
  const dark = useIsDark();
  const opacity = useBoneOpacity();
  const fill = dark ? '#4B5563' : '#D1D5DB';

  return (
    <View style={[{ width, height, borderRadius: radius, overflow: 'hidden' }, style]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: fill, borderRadius: radius, opacity },
        ]}
      />
    </View>
  );
}

function SkeletonSurface({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <SkeletonPulse>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={ka.common.loading}
        style={[
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.bg300,
            borderRadius: 24,
            padding: padded ? 16 : 0,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        {children}
      </View>
    </SkeletonPulse>
  );
}

/** Home hub: title stays, card is bones — same as შემდეგი მიღება. */
export function HomeBlockSkeleton({
  title,
  children,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      {title}
      <SkeletonSurface>{children}</SkeletonSurface>
    </View>
  );
}

export function MetricCardSkeleton() {
  return (
    <SkeletonSurface>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Bone width={48} height={48} radius={999} />
        <View style={{ flex: 1, gap: 8 }}>
          <Bone width="42%" height={12} />
          <Bone width="70%" height={22} radius={8} />
          <Bone width="55%" height={12} />
        </View>
      </View>
      <Bone height={56} radius={14} style={{ marginTop: 16 }} />
    </SkeletonSurface>
  );
}

export function ChartCardSkeleton() {
  return (
    <SkeletonSurface>
      <Bone width="38%" height={28} radius={8} />
      <Bone width="52%" height={14} style={{ marginTop: 10 }} />
      <Bone height={120} radius={16} style={{ marginTop: 16 }} />
      <Bone width="72%" height={12} style={{ marginTop: 12 }} />
    </SkeletonSurface>
  );
}

export function DoseCarouselSkeleton() {
  return (
    <SkeletonSurface>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, minHeight: 88, justifyContent: 'center', gap: 8 }}>
          <Bone width="46%" height={12} />
          <Bone width="78%" height={18} />
          <Bone width="58%" height={12} />
        </View>
        <Bone width={56} height={56} radius={999} />
      </View>
    </SkeletonSurface>
  );
}

export function ListRowsSkeleton({ rows = 4, padded = true }: { rows?: number; padded?: boolean }) {
  const colors = useThemeColors();
  return (
    <SkeletonPulse>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={ka.common.loading}
        style={{ gap: 10, paddingHorizontal: padded ? 16 : 0 }}
      >
        {Array.from({ length: rows }, (_, i) => (
          <View
            key={i}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.bg300,
              borderRadius: 16,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Bone width={44} height={44} radius={14} />
            <View style={{ flex: 1, gap: 8 }}>
              <Bone width="62%" height={14} />
              <Bone width="40%" height={11} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonPulse>
  );
}

export function CyclePageSkeleton() {
  return (
    <SkeletonPulse>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={ka.common.loading}
        style={{ flex: 1, paddingTop: 16, paddingHorizontal: 16 }}
      >
        <View style={{ alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <Bone width={168} height={168} radius={999} />
          <Bone width="48%" height={18} />
          <Bone width="64%" height={12} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <View key={i} style={{ alignItems: 'center', gap: 6 }}>
              <Bone width={22} height={8} />
              <Bone width={36} height={36} radius={999} />
            </View>
          ))}
        </View>
        <SkeletonSurface style={{ marginBottom: 12 }}>
          <Bone width="55%" height={16} />
          <Bone width="90%" height={12} style={{ marginTop: 12 }} />
          <Bone width="72%" height={12} style={{ marginTop: 8 }} />
        </SkeletonSurface>
        <SkeletonSurface>
          <Bone width="40%" height={16} />
          <Bone height={72} radius={14} style={{ marginTop: 14 }} />
        </SkeletonSurface>
      </View>
    </SkeletonPulse>
  );
}

export function MedsHubSkeleton() {
  return (
    <SkeletonPulse>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={ka.common.loading}
        style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}
      >
        <SkeletonSurface style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
              <Bone width={48} height={22} />
              <Bone width="70%" height={10} />
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
              <Bone width={48} height={22} />
              <Bone width="70%" height={10} />
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
              <Bone width={48} height={22} />
              <Bone width="70%" height={10} />
            </View>
          </View>
          <Bone height={88} radius={16} style={{ marginTop: 16 }} />
        </SkeletonSurface>
        <Bone width="36%" height={14} style={{ marginBottom: 10, marginLeft: 4 }} />
        <ListRowsSkeleton rows={3} padded={false} />
      </View>
    </SkeletonPulse>
  );
}

export function RecordsPageSkeleton() {
  return (
    <SkeletonPulse>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Bone width={72} height={32} radius={999} />
          <Bone width={88} height={32} radius={999} />
          <Bone width={64} height={32} radius={999} />
        </View>
        <ListRowsSkeleton rows={5} padded={false} />
      </View>
    </SkeletonPulse>
  );
}

export function PackagePageSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 16 }}>
      <SkeletonSurface>
        <Bone width="40%" height={12} />
        <Bone width="55%" height={28} style={{ marginTop: 12 }} />
        <Bone height={8} radius={999} style={{ marginTop: 16 }} />
      </SkeletonSurface>
      <SkeletonSurface>
        <Bone width="50%" height={18} />
        <Bone height={72} radius={16} style={{ marginTop: 16 }} />
        <Bone height={72} radius={16} style={{ marginTop: 10 }} />
      </SkeletonSurface>
    </View>
  );
}

export function InsightCardsSkeleton() {
  return (
    <View style={{ gap: 10 }}>
      {[0, 1].map((i) => (
        <SkeletonSurface key={i}>
          <Bone width="48%" height={14} />
          <Bone width="92%" height={12} style={{ marginTop: 10 }} />
          <Bone width="70%" height={12} style={{ marginTop: 8 }} />
        </SkeletonSurface>
      ))}
    </View>
  );
}

export function StreakPageSkeleton() {
  return (
    <SkeletonPulse>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={ka.common.loading}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16 }}
      >
        <Bone width={140} height={140} radius={999} />
        <Bone width="70%" height={22} />
        <Bone width="50%" height={14} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <Bone key={i} width={36} height={36} radius={999} />
          ))}
        </View>
      </View>
    </SkeletonPulse>
  );
}

export function ProductHeroSkeleton() {
  return (
    <SkeletonPulse>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={ka.common.loading}
        style={{ paddingHorizontal: 16, paddingTop: 8, alignItems: 'center', gap: 16 }}
      >
        <Bone width={120} height={120} radius={18} />
        <Bone width="70%" height={22} />
        <Bone width="40%" height={14} />
        <SkeletonSurface style={{ width: '100%', marginTop: 8 }}>
          <Bone width="100%" height={14} />
          <Bone width="100%" height={14} style={{ marginTop: 12 }} />
          <Bone width="80%" height={14} style={{ marginTop: 12 }} />
        </SkeletonSurface>
      </View>
    </SkeletonPulse>
  );
}

export function DetailCardSkeleton() {
  return (
    <SkeletonPulse>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={ka.common.loading}
        style={{ gap: 12 }}
      >
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Bone width={72} height={24} radius={999} />
          <Bone width={120} height={12} />
        </View>
        <Bone height={200} radius={16} />
        <SkeletonSurface>
          <Bone width="90%" height={12} />
          <Bone width="100%" height={12} style={{ marginTop: 10 }} />
          <Bone width="75%" height={12} style={{ marginTop: 10 }} />
          <Bone width="88%" height={12} style={{ marginTop: 10 }} />
        </SkeletonSurface>
      </View>
    </SkeletonPulse>
  );
}

export function PermissionsPageSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, gap: 12 }}>
      {Array.from({ length: 6 }, (_, i) => (
        <SkeletonSurface key={i}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Bone width={40} height={40} radius={12} />
            <View style={{ flex: 1, gap: 8 }}>
              <Bone width="55%" height={14} />
              <Bone width="80%" height={11} />
            </View>
            <Bone width={44} height={24} radius={999} />
          </View>
        </SkeletonSurface>
      ))}
    </View>
  );
}

export function HydrationHubSkeleton() {
  return (
    <SkeletonPulse>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={ka.common.loading}
        style={{ paddingHorizontal: 16, paddingTop: 8, gap: 16, flex: 1 }}
      >
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Bone width={180} height={180} radius={999} />
          <Bone width="40%" height={28} />
          <Bone width="55%" height={14} />
        </View>
        <ChartCardSkeleton />
      </View>
    </SkeletonPulse>
  );
}
