import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';
import { homeAccentFor } from '@/constants/homeVisuals';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import type { ModuleTile } from '@/constants/modules';
import { ka } from '@/i18n/ka';
import { useIsDark, useThemeColors } from '@/theme/colors';

type Props = {
  tools: ModuleTile[];
  onPress: (tile: ModuleTile) => void;
};

export function HomePowerToolsSection({ tools, onPress }: Props) {
  const isDark = useIsDark();
  const colors = useThemeColors();
  const pharmacy = tools.find((t) => t.key === 'pharmacy');
  const calendar = tools.find((t) => t.key === 'calendar');
  const visits = tools.find((t) => t.key === 'visits');

  if (!pharmacy && !calendar && !visits) return null;

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
            width: 4,
            height: 20,
            borderRadius: 2,
            backgroundColor: colors.primary200,
            marginRight: 9,
          }}
        />
        <View style={{ flex: 1 }}>
          <Text className="text-[15px] font-bold text-text-100">{ka.home.powerTools}</Text>
          <Text className="mt-0.5 text-[11px] text-text-300" numberOfLines={1}>
            {ka.home.powerToolsHint}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: S.blockGap, minHeight: 106 }}>
        {pharmacy ? (
          <PharmacyBento tile={pharmacy} isDark={isDark} onPress={() => onPress(pharmacy)} />
        ) : null}

        {calendar || visits ? (
          <View style={{ flex: 1, gap: S.blockGap }}>
            {calendar ? (
              <StackBento
                tile={calendar}
                accentKey="calendar"
                eyebrow={ka.home.calendarEyebrow}
                isDark={isDark}
                onPress={() => onPress(calendar)}
              />
            ) : null}
            {visits ? (
              <StackBento
                tile={visits}
                accentKey="visits"
                eyebrow={ka.home.visitsEyebrow}
                isDark={isDark}
                onPress={() => onPress(visits)}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function PharmacyBento({
  tile,
  isDark,
  onPress,
}: {
  tile: ModuleTile;
  isDark: boolean;
  onPress: () => void;
}) {
  const accent = homeAccentFor('pharmacy', isDark);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tile.title}
      onPress={onPress}
      className="active:opacity-92"
      style={{
        flex: 1.22,
        borderRadius: S.cardRadius,
        backgroundColor: accent.bg,
        padding: 11,
        justifyContent: 'space-between',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.35)',
      }}
    >
      <View
        style={{
          position: 'absolute',
          right: -22,
          bottom: -22,
          width: 88,
          height: 88,
          borderRadius: 44,
          borderWidth: 10,
          borderColor: 'rgba(255,255,255,0.14)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: 14,
          top: 10,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: 'rgba(255,255,255,0.12)',
        }}
      />

      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.22)',
        }}
      >
        <tile.icon size={19} color="#ffffff" strokeWidth={2.2} />
      </View>

      <View style={{ marginTop: 8 }}>
        <Text
          style={{
            fontSize: 8,
            fontWeight: '800',
            letterSpacing: 0.9,
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.72)',
          }}
        >
          {ka.home.pharmacyEyebrow}
        </Text>
        <Text
          style={{
            marginTop: 3,
            fontSize: 15,
            fontWeight: '800',
            lineHeight: 19,
            color: '#ffffff',
          }}
          numberOfLines={2}
        >
          {tile.title}
        </Text>
      </View>

      <View
        style={{
          position: 'absolute',
          right: 11,
          bottom: 11,
          width: 30,
          height: 30,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
        }}
      >
        <ArrowUpRight size={15} color={accent.bg} strokeWidth={2.6} />
      </View>
    </Pressable>
  );
}

function StackBento({
  tile,
  accentKey,
  eyebrow,
  isDark,
  onPress,
}: {
  tile: ModuleTile;
  accentKey: string;
  eyebrow: string;
  isDark: boolean;
  onPress: () => void;
}) {
  const accent = homeAccentFor(accentKey, isDark);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tile.title}
      onPress={onPress}
      className="active:opacity-92"
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: S.cardRadius - 2,
        backgroundColor: accent.bg,
        paddingHorizontal: 10,
        paddingVertical: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)',
        minHeight: 49,
      }}
    >
      <View
        style={{
          position: 'absolute',
          right: -12,
          top: -12,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(255,255,255,0.1)',
        }}
      />

      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.22)',
          marginRight: 8,
        }}
      >
        <tile.icon size={16} color="#ffffff" strokeWidth={2.2} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 7,
            fontWeight: '800',
            letterSpacing: 0.7,
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.68)',
          }}
          numberOfLines={1}
        >
          {eyebrow}
        </Text>
        <Text
          style={{
            marginTop: 1,
            fontSize: 12,
            fontWeight: '800',
            lineHeight: 15,
            color: '#ffffff',
          }}
          numberOfLines={2}
        >
          {tile.title}
        </Text>
      </View>

      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.95)',
          marginLeft: 4,
        }}
      >
        <ArrowUpRight size={13} color={accent.bg} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}
