import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { StreakDayCompleted } from '@/components/check-in/StreakAssets';
import { useFigmaStreak } from '@/constants/figmaStreakLayout';
import { ka } from '@/i18n/ka';

type Props = {
  points: number;
  currentStreak: number;
  onPress: () => void;
};

export function ProfilePointsCard({ points, currentStreak, onPress }: Props) {
  const FIGMA = useFigmaStreak();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ka.checkIn.pointsLabel}
      onPress={onPress}
      className="active:opacity-80"
      style={{
        marginTop: 12,
        backgroundColor: FIGMA.cardBg,
        borderWidth: 1,
        borderColor: FIGMA.border,
        borderRadius: FIGMA.cardRadius,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible' }}>
        <StreakDayCompleted size={32} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 22,
            lineHeight: 28,
            color: FIGMA.textPrimary,
          }}
        >
          {points} {ka.checkIn.pointsUnit}
        </Text>
        <Text
          style={{
            marginTop: 2,
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 13,
            lineHeight: 18,
            color: FIGMA.textSecondary,
          }}
        >
          {ka.checkIn.profileHint(currentStreak)}
        </Text>
      </View>
      <ChevronRight size={18} color={FIGMA.textSecondary} strokeWidth={2.1} />
    </Pressable>
  );
}
