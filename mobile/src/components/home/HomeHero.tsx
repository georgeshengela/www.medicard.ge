import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MessageCircle, Sparkles } from 'lucide-react-native';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import { ka } from '@/i18n/ka';
import { greeting } from '@/lib/format';
import { useThemeColors, useIsDark } from '@/theme/colors';

type Props = {
  firstName: string;
  initials: string;
  onAskDoctor: () => void;
};

export function HomeHero({ firstName, initials, onAskDoctor }: Props) {
  const colors = useThemeColors();
  const isDark = useIsDark();
  const heroBg = isDark ? colors.accent100 : colors.accent100;
  const heroInk = colors.primary100;
  const heroBorder = isDark ? colors.accent200 : colors.accent200;

  return (
    <View
      style={{
        marginBottom: S.heroBottom,
        borderRadius: S.cardRadius,
        backgroundColor: heroBg,
        borderWidth: 1,
        borderColor: heroBorder,
        overflow: 'hidden',
      }}
    >
      <View style={{ padding: S.cardPad }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <View className="flex-row items-center">
              <BrandLogo size={28} variant="plain" />
              <Text style={{ color: heroInk, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginLeft: 6 }}>
                MEDICARD.GE
              </Text>
            </View>
            <Text className="mt-1 text-[21px] font-bold leading-[26px] text-text-100">
              {greeting()}
              {firstName ? `, ${firstName}` : ''}
            </Text>
            <Text className="mt-0.5 text-xs leading-4 text-text-200" numberOfLines={1}>
              {ka.home.tagline}
            </Text>
          </View>

          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderWidth: 2,
              borderColor: colors.primary200,
            }}
          >
            <Text className="text-sm font-bold text-primary-200">{initials || 'M'}</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onAskDoctor}
          className="mt-2.5 flex-row items-center active:opacity-90"
          style={{
            borderRadius: 12,
            backgroundColor: colors.primary200,
            paddingVertical: 9,
            paddingHorizontal: 10,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.22)',
            }}
          >
            <MessageCircle size={16} color={colors.onPrimary} strokeWidth={2.2} />
          </View>
          <View className="ml-2.5 flex-1">
            <Text className="text-[13px] font-bold text-white" numberOfLines={1}>
              {ka.home.question}
            </Text>
          </View>
          <Sparkles size={16} color={colors.onPrimary} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}
