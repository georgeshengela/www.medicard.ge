import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowUpRight, Sparkles } from 'lucide-react-native';
import { homeAccentFor } from '@/constants/homeVisuals';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import type { ModuleTile } from '@/constants/modules';
import { ka } from '@/i18n/ka';
import { useIsDark, useThemeColors } from '@/theme/colors';

type Props = {
  spotlights: ModuleTile[];
  onPress: (tile: ModuleTile) => void;
};

export function HomeStartSection({ spotlights, onPress }: Props) {
  const isDark = useIsDark();
  const colors = useThemeColors();
  const doctor = spotlights.find((t) => t.key === 'doctor');
  const cycle = spotlights.find((t) => t.key === 'cycle');

  return (
    <View style={{ marginTop: S.sectionTop }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: S.sectionLabelBottom,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? colors.accent100 : colors.accent100,
            marginRight: 8,
          }}
        >
          <Sparkles size={12} color={colors.primary200} strokeWidth={2.4} />
        </View>
        <Text className="text-[15px] font-bold text-text-100">{ka.home.startHere}</Text>
      </View>

      <View style={{ gap: S.blockGap }}>
        {doctor ? (
          <StartFeatureRow
            tile={doctor}
            accentKey="doctor"
            eyebrow={ka.home.doctorEyebrow}
            isDark={isDark}
            featured
            onPress={() => onPress(doctor)}
          />
        ) : null}
        {cycle ? (
          <StartFeatureRow
            tile={cycle}
            accentKey="cycle"
            eyebrow={ka.home.cycleEyebrow}
            isDark={isDark}
            onPress={() => onPress(cycle)}
          />
        ) : null}
      </View>
    </View>
  );
}

function StartFeatureRow({
  tile,
  accentKey,
  eyebrow,
  isDark,
  featured,
  onPress,
}: {
  tile: ModuleTile;
  accentKey: string;
  eyebrow: string;
  isDark: boolean;
  featured?: boolean;
  onPress: () => void;
}) {
  const accent = homeAccentFor(accentKey, isDark);
  const onFeatured = featured && accentKey === 'doctor';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tile.title}
      onPress={onPress}
      className="active:opacity-90"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: S.cardRadius,
        borderWidth: 1,
        borderColor: onFeatured ? (isDark ? accent.border : '#ffffff28') : accent.border,
        backgroundColor: onFeatured ? accent.bg : accent.soft,
        paddingVertical: S.cardPad,
        paddingHorizontal: S.cardPad,
        overflow: 'hidden',
      }}
    >
      {onFeatured ? null : (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: accent.bg,
          }}
        />
      )}

      <View
        style={{
          width: S.iconMd,
          height: S.iconMd,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: onFeatured ? 'rgba(255,255,255,0.2)' : accent.bg,
          marginRight: 10,
        }}
      >
        <tile.icon size={20} color="#ffffff" strokeWidth={2.15} />
      </View>

      <View style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
        <Text
          style={{
            fontSize: 9,
            fontWeight: '800',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: onFeatured ? 'rgba(255,255,255,0.78)' : accent.ink,
          }}
        >
          {eyebrow}
        </Text>
        <Text
          style={{
            marginTop: 2,
            fontSize: 15,
            fontWeight: '700',
            lineHeight: 19,
            color: onFeatured ? '#ffffff' : undefined,
          }}
          className={onFeatured ? '' : 'text-text-100'}
          numberOfLines={1}
        >
          {tile.title}
        </Text>
        <Text
          style={{
            marginTop: 2,
            fontSize: 11,
            lineHeight: 15,
            color: onFeatured ? 'rgba(255,255,255,0.82)' : undefined,
          }}
          className={onFeatured ? '' : 'text-text-300'}
          numberOfLines={1}
        >
          {tile.subtitle}
        </Text>
      </View>

      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: onFeatured ? '#ffffff' : isDark ? 'rgba(255,255,255,0.08)' : '#ffffff',
          borderWidth: onFeatured ? 0 : 1,
          borderColor: accent.border,
        }}
      >
        <ArrowUpRight size={15} color={onFeatured ? accent.bg : accent.bg} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}
