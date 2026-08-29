import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { HomePackageQuotaBadge } from '@/components/home/HomePackageQuotaBadge';
import { HomeStreakChip } from '@/components/home/HomeStreakChip';
import { AVATAR_SOURCES, isAvatarId, normalizeAvatarForGender } from '@/constants/avatarAssets';
import { useFigmaHomeDashboard } from '@/constants/figmaHomeDashboardLayout';
import { ka } from '@/i18n/ka';
import type { Gender } from '@/lib/api';

type Props = {
  firstName: string;
  initials: string;
  gender?: Gender | null;
  avatarId?: string | null;
  streak?: number;
  onPackagePress?: () => void;
  onAvatarPress?: () => void;
  onStreakPress?: () => void;
};

export function HomeDashboardHeader({
  firstName,
  initials,
  gender,
  avatarId,
  streak = 0,
  onPackagePress,
  onAvatarPress,
  onStreakPress,
}: Props) {
  const FIGMA_HOME_DASHBOARD = useFigmaHomeDashboard();
  const dateLabel = new Date().toLocaleDateString('ka-GE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const normalizedAvatar = normalizeAvatarForGender(avatarId ?? null, gender ?? null);
  const avatarSource = isAvatarId(normalizedAvatar) ? AVATAR_SOURCES[normalizedAvatar] : null;
  const displayName = firstName || ka.home.defaultName;

  return (
    <View style={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 14,
                lineHeight: 20,
                color: '#FFFFFF',
              }}
            >
              {dateLabel}
            </Text>
            <HomeStreakChip streak={streak} onPress={onStreakPress} />
          </View>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 24,
              lineHeight: 32,
              color: '#FFFFFF',
              letterSpacing: -0.25,
            }}
          >
            {ka.home.helloName(displayName)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <HomePackageQuotaBadge onPress={onPackagePress} />

          <Pressable accessibilityRole="button" onPress={onAvatarPress}>
            <View style={{ width: 40, height: 40 }}>
              {avatarSource ? (
                <Image source={avatarSource} style={{ width: 40, height: 40, borderRadius: 20 }} />
              ) : (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: FIGMA_HOME_DASHBOARD.avatarBg,
                    borderWidth: 1,
                    borderColor: FIGMA_HOME_DASHBOARD.borderTertiary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 14,
                      color: FIGMA_HOME_DASHBOARD.brand,
                    }}
                  >
                    {initials || 'M'}
                  </Text>
                </View>
              )}
              <View
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: FIGMA_HOME_DASHBOARD.success,
                  borderWidth: 1.5,
                  borderColor: FIGMA_HOME_DASHBOARD.avatarRing,
                }}
              />
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
