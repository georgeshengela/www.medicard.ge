import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, Droplets, Heart } from 'lucide-react-native';
import { FIGMA_HOME_DASHBOARD } from '@/constants/figmaHomeDashboardLayout';
import { ka } from '@/i18n/ka';

type Props = {
  score: number | null;
  label: string;
  statusLabel?: string;
  waterLiters?: number | null;
  onPress?: () => void;
};

export function HomeHealthScoreCard({
  score,
  label,
  statusLabel,
  waterLiters,
  onPress,
}: Props) {
  const scoreText = score != null ? Math.round(score).toString() : '—';

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: FIGMA_HOME_DASHBOARD.cardRadius,
          borderWidth: 1,
          borderColor: FIGMA_HOME_DASHBOARD.border,
          padding: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 2,
          elevation: 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: FIGMA_HOME_DASHBOARD.scoreBoxSize,
              height: FIGMA_HOME_DASHBOARD.scoreBoxSize,
              borderRadius: FIGMA_HOME_DASHBOARD.scoreBoxRadius,
              borderWidth: 1,
              borderColor: FIGMA_HOME_DASHBOARD.brand,
              backgroundColor: FIGMA_HOME_DASHBOARD.brandQuaternary,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 30,
                lineHeight: 38,
                color: FIGMA_HOME_DASHBOARD.brand,
                letterSpacing: -0.25,
              }}
            >
              {scoreText}
            </Text>
          </View>

          <View style={{ flex: 1, gap: 8 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 16,
                lineHeight: 22,
                color: FIGMA_HOME_DASHBOARD.textPrimary,
              }}
            >
              {label}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Heart size={18} color="#F43F5E" fill="#F43F5E" strokeWidth={0} />
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_400Regular',
                    fontSize: 14,
                    lineHeight: 20,
                    color: FIGMA_HOME_DASHBOARD.textPrimary,
                  }}
                >
                  {statusLabel ?? ka.home.healthyStatus}
                </Text>
              </View>
              {waterLiters != null ? (
                <>
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: FIGMA_HOME_DASHBOARD.border,
                    }}
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Droplets size={18} color={FIGMA_HOME_DASHBOARD.brand} strokeWidth={2.2} />
                    <Text
                      style={{
                        fontFamily: 'NotoSansGeorgian_400Regular',
                        fontSize: 14,
                        lineHeight: 20,
                        color: FIGMA_HOME_DASHBOARD.textPrimary,
                      }}
                    >
                      {ka.home.waterIntake(waterLiters)}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>

          <ChevronRight size={24} color="#9CA3AF" strokeWidth={2} />
        </View>
      </Pressable>
    </View>
  );
}
