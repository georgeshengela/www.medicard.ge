import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { MediCompanionFigure } from '@/components/companion/MediCompanionFigure';
import type { CompanionEquipment, CompanionMoodKey, CompanionStage } from '@/lib/companion/api';
import {
  BACKGROUND_PALETTES,
  resolveLoadoutVisuals,
} from '@/lib/companion/cosmeticVisuals';
import { useIsDark, useThemeColors } from '@/theme/colors';

type Props = {
  stage?: CompanionStage | string;
  moodKey?: CompanionMoodKey | string;
  equipment?: CompanionEquipment | null;
  reducedMotion?: boolean;
  /** Hero home size vs compact */
  size?: 'hero' | 'compact';
};

/**
 * Layered Companion Home scene:
 * 1 background wash
 * 2 decoration (left/right)
 * 3 Medi figure (accent + pose + accessory)
 */
export function MediCompanionScene({
  stage = 'STAGE_1',
  moodKey = 'CALM',
  equipment,
  reducedMotion,
  size = 'hero',
}: Props) {
  const dark = useIsDark();
  const colors = useThemeColors();
  const loadout = resolveLoadoutVisuals(equipment || {});
  const bg = BACKGROUND_PALETTES[loadout.backgroundVk] || BACKGROUND_PALETTES['bg.calm_navy'];
  const top = dark ? bg.darkTop : bg.top;
  const mid = dark ? bg.darkMid : bg.mid;
  const bottom = dark ? bg.darkBottom : bg.bottom;
  const accent = dark ? bg.darkAccent : bg.accent;
  const figureSize = size === 'hero' ? undefined : 72;

  return (
    <View
      accessible
      accessibilityLabel={`Medi companion scene, ${stage}`}
      style={{
        borderRadius: 20,
        overflow: 'hidden',
        minHeight: size === 'hero' ? 220 : 120,
        backgroundColor: mid,
      }}
    >
      {/* Background layers */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '42%', backgroundColor: top }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '38%', backgroundColor: bottom }} />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -30,
          top: -20,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: accent,
          opacity: dark ? 0.18 : 0.22,
        }}
      />
      {loadout.backgroundVk === 'bg.city_night' ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, top: 18, flexDirection: 'row', gap: 6 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: 3, height: 3 + i, borderRadius: 2, backgroundColor: accent, opacity: 0.7 }} />
          ))}
        </View>
      ) : null}
      {loadout.backgroundVk === 'bg.dawn' ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 18,
            top: 14,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: accent,
            opacity: 0.55,
          }}
        />
      ) : null}

      {/* Decoration */}
      {loadout.decorationVk ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 10, bottom: 10, zIndex: 2 }}>
          <DecorationMark visualKey={loadout.decorationVk} color={loadout.accentColor} dark={dark} />
        </View>
      ) : null}
      {loadout.decorationVk === 'decor.window' ? (
        <View pointerEvents="none" style={{ position: 'absolute', right: 12, top: 16, zIndex: 2 }}>
          <DecorationMark visualKey="decor.window" color={accent} dark={dark} />
        </View>
      ) : null}

      <View style={{ paddingVertical: size === 'hero' ? 20 : 12, alignItems: 'center', zIndex: 3 }}>
        <MediCompanionFigure
          stage={stage}
          moodKey={moodKey}
          reducedMotion={reducedMotion}
          size={figureSize}
          accentColor={loadout.accentColor}
          poseKey={loadout.poseVk}
          accessoryKey={loadout.physicalAccessory}
        />
      </View>

      {/* Floor line */}
      <View
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          bottom: 12,
          height: 2,
          borderRadius: 1,
          backgroundColor: dark ? colors.bg300 : accent,
          opacity: 0.25,
        }}
      />
    </View>
  );
}

function DecorationMark({ visualKey, color, dark }: { visualKey: string; color: string; dark: boolean }) {
  const stroke = dark ? '#E5E7EB' : color;
  switch (visualKey) {
    case 'decor.plant':
      return (
        <Svg width={36} height={40} viewBox="0 0 36 40">
          <Path d="M18 28V14" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
          <Path d="M18 18C12 14 10 10 12 6C16 10 18 14 18 18Z" fill={stroke} opacity={0.75} />
          <Path d="M18 20C24 16 26 11 24 7C20 11 18 16 18 20Z" fill={stroke} opacity={0.55} />
          <Rect x={12} y={28} width={12} height={8} rx={2} fill={stroke} opacity={0.45} />
        </Svg>
      );
    case 'decor.lamp':
      return (
        <Svg width={28} height={40} viewBox="0 0 28 40">
          <Path d="M14 12V30" stroke={stroke} strokeWidth={2} />
          <Path d="M6 14L14 6L22 14Z" fill={stroke} opacity={0.7} />
          <Circle cx={14} cy={34} r={4} fill={stroke} opacity={0.4} />
        </Svg>
      );
    case 'decor.shelf':
      return (
        <Svg width={44} height={28} viewBox="0 0 44 28">
          <Rect x={2} y={18} width={40} height={3} rx={1} fill={stroke} opacity={0.55} />
          <Rect x={8} y={8} width={8} height={10} rx={1} fill={stroke} opacity={0.4} />
          <Rect x={20} y={10} width={6} height={8} rx={1} fill={stroke} opacity={0.5} />
          <Circle cx={34} cy={14} r={4} fill={stroke} opacity={0.35} />
        </Svg>
      );
    case 'decor.frame':
      return (
        <Svg width={34} height={34} viewBox="0 0 34 34">
          <Rect x={4} y={4} width={26} height={26} rx={3} stroke={stroke} strokeWidth={2} fill="none" />
          <Rect x={9} y={9} width={16} height={16} rx={2} fill={stroke} opacity={0.25} />
        </Svg>
      );
    case 'decor.window':
      return (
        <Svg width={36} height={36} viewBox="0 0 36 36">
          <Rect x={4} y={4} width={28} height={28} rx={3} stroke={stroke} strokeWidth={2} fill={stroke} fillOpacity={0.12} />
          <Path d="M18 4V32M4 18H32" stroke={stroke} strokeWidth={1.5} />
        </Svg>
      );
    default:
      return null;
  }
}
