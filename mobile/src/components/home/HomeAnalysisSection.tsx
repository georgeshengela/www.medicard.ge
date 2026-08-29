import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { QuotaSheet } from '@/components/QuotaSheet';
import { useFigmaHomeDashboard } from '@/constants/figmaHomeDashboardLayout';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import { ka } from '@/i18n/ka';
import type { ModuleTile } from '@/constants/modules';
import { usePlanUsage } from '@/lib/planUsage';

type Props = {
  tiles: ModuleTile[];
  onPress: (tile: ModuleTile) => void;
};

const ICON_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
} as const;

/** Figma 11423:86807 — one 24-radius list card, circular icon wells, quota in the trailing slot. */
export function HomeAnalysisSection({ tiles, onPress }: Props) {
  const FIGMA = useFigmaHomeDashboard();
  const router = useRouter();
  const plan = usePlanUsage();
  const [quotaOpen, setQuotaOpen] = useState(false);

  if (!tiles.length) return null;

  const handlePress = (tile: ModuleTile) => {
    if (plan.exhausted) {
      setQuotaOpen(true);
      return;
    }
    onPress(tile);
  };

  return (
    <View style={{ marginTop: S.sectionTop }}>
      <HomeSectionTitle title={ka.home.analysisTools} />
      <View
        style={{
          backgroundColor: FIGMA.setupCardBg,
          borderWidth: 1,
          borderColor: FIGMA.border,
          borderRadius: 24,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        {tiles.map((tile, index) => (
          <AnalysisRow
            key={tile.key}
            tile={tile}
            last={index === tiles.length - 1}
            remaining={plan.remaining}
            limit={plan.limit}
            unlimited={plan.unlimited}
            exhausted={plan.exhausted}
            onPress={() => handlePress(tile)}
          />
        ))}
      </View>
      <QuotaSheet
        visible={quotaOpen}
        resetsInMs={plan.usage?.resetsInMs}
        onClose={() => setQuotaOpen(false)}
        onUpgrade={() => {
          setQuotaOpen(false);
          router.push('/package');
        }}
      />
    </View>
  );
}

function AnalysisRow({
  tile,
  last,
  remaining,
  limit,
  unlimited,
  exhausted,
  onPress,
}: {
  tile: ModuleTile;
  last: boolean;
  remaining: number | null;
  limit: number;
  unlimited: boolean;
  exhausted: boolean;
  onPress: () => void;
}) {
  const FIGMA = useFigmaHomeDashboard();
  const Icon = tile.icon;
  const quotaLabel = unlimited ? '∞' : ka.usage.quotaOf(remaining ?? 0, limit);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tile.title}, ${unlimited ? ka.plans.unlimited : ka.usage.remainingQueries(remaining ?? 0, limit)}`}
      accessibilityHint={exhausted ? ka.usage.exhaustedTitle : undefined}
      onPress={onPress}
      className="w-full active:opacity-88"
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 999,
            backgroundColor: FIGMA.badgeBg,
            borderWidth: 1,
            borderColor: FIGMA.borderTertiary,
            alignItems: 'center',
            justifyContent: 'center',
            ...ICON_SHADOW,
          }}
        >
          <Icon size={24} color={FIGMA.textSecondary} strokeWidth={2} />
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 14,
              lineHeight: 20,
              color: FIGMA.textPrimary,
            }}
            numberOfLines={1}
          >
            {tile.title}
          </Text>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 14,
              lineHeight: 20,
              color: FIGMA.textSecondary,
            }}
            numberOfLines={2}
          >
            {tile.subtitle}
          </Text>
        </View>

        <View
          style={{
            minWidth: 36,
            height: 20,
            paddingHorizontal: 6,
            borderRadius: 4,
            backgroundColor: exhausted ? 'transparent' : FIGMA.brand,
            borderWidth: exhausted ? 1 : 0,
            borderColor: exhausted ? FIGMA.badgeBorderExhausted : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 11,
              lineHeight: 16,
              color: exhausted ? '#F43F5E' : '#FFFFFF',
              letterSpacing: -0.2,
            }}
          >
            {quotaLabel}
          </Text>
        </View>
      </View>
      {last ? null : <View style={{ height: 1, backgroundColor: FIGMA.border }} />}
    </Pressable>
  );
}
