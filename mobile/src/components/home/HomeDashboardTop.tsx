import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FIGMA_HOME_DASHBOARD } from '@/constants/figmaHomeDashboardLayout';
import { HomeDashboardHeader } from '@/components/home/HomeDashboardHeader';
import { HomeHealthScoreCard } from '@/components/home/HomeHealthScoreCard';
import type { Gender } from '@/lib/api';

type Props = {
  firstName: string;
  initials: string;
  gender?: Gender | null;
  avatarId?: string | null;
  streak?: number;
  score: number | null;
  scoreLabel: string;
  statusLabel?: string;
  waterLiters?: number | null;
  onPackagePress?: () => void;
  onAvatarPress?: () => void;
  onScorePress?: () => void;
};

/** Figma 8911:62356 — gradient header + health score card. */
export function HomeDashboardTop(props: Props) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[FIGMA_HOME_DASHBOARD.brand, 'rgba(20,184,166,0)']}
      style={{ width: '100%', paddingTop: insets.top }}
    >
      <HomeDashboardHeader
        firstName={props.firstName}
        initials={props.initials}
        gender={props.gender}
        avatarId={props.avatarId}
        streak={props.streak}
        onPackagePress={props.onPackagePress}
        onAvatarPress={props.onAvatarPress}
      />
      <HomeHealthScoreCard
        score={props.score}
        label={props.scoreLabel}
        statusLabel={props.statusLabel}
        waterLiters={props.waterLiters}
        onPress={props.onScorePress}
      />
    </LinearGradient>
  );
}
