import React from 'react';
import { View } from 'react-native';
import { MediCompanionFigure } from '@/components/companion/MediCompanionFigure';
import { useIsDark, useThemeColors } from '@/theme/colors';

const AURA: Record<string, string> = {
  aura_teal_origin: '#14B8A6',
  aura_hydration_wave: '#38BDF8',
  aura_calm_glow: '#A78BFA',
};

type Props = {
  stageKey?: string;
  size?: number;
  auraKey?: string | null;
  trail?: boolean;
  charm?: boolean;
  accent?: boolean;
  reducedMotion?: boolean;
};

export function CareMediFigure({
  stageKey = 'spark',
  size = 128,
  auraKey,
  trail,
  charm,
  accent,
  reducedMotion,
}: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const aura = AURA[auraKey || ''] || (dark ? colors.primary200 : '#14B8A6');
  const pad = Math.round(size * 0.28);

  return (
    <View
      accessible
      accessibilityLabel={`Medi ${stageKey}`}
      style={{ width: size + pad, height: size + pad, alignItems: 'center', justifyContent: 'center' }}
    >
      {accent ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size + pad,
            height: size + pad,
            borderRadius: (size + pad) / 2,
            borderWidth: 1.5,
            borderColor: `${aura}55`,
            opacity: reducedMotion ? 0.35 : 0.7,
          }}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size + 18,
          height: size + 18,
          borderRadius: (size + 18) / 2,
          backgroundColor: `${aura}22`,
        }}
      />
      {trail ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 8,
            width: size * 0.55,
            height: 8,
            borderRadius: 8,
            backgroundColor: `${aura}44`,
          }}
        />
      ) : null}
      <MediCompanionFigure size={size} accentColor={aura} reducedMotion={reducedMotion} animate={!reducedMotion} accessibilityLabel={null} />
      {charm ? (
        <View
          accessibilityLabel="care charm"
          style={{
            position: 'absolute',
            top: 10,
            right: 14,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: aura,
          }}
        />
      ) : null}
    </View>
  );
}
