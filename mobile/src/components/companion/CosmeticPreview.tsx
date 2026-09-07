import React from 'react';
import { View } from 'react-native';
import { MediCompanionFigure } from '@/components/companion/MediCompanionFigure';
import {
  ACCENT_COLORS,
  BACKGROUND_PALETTES,
  visualKeyForCosmetic,
} from '@/lib/companion/cosmeticVisuals';
import { useIsDark } from '@/theme/colors';

type Props = {
  cosmeticKey: string;
  visualKey?: string | null;
  slot?: string;
  size?: number;
};

/** Honest collection thumbnail — mirrors equipped result. */
export function CosmeticPreview({ cosmeticKey, visualKey: visualKeyProp, slot, size = 40 }: Props) {
  const dark = useIsDark();
  const visualKey = visualKeyProp || visualKeyForCosmetic(cosmeticKey);
  if (!visualKey) {
    return <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: '#374151' }} />;
  }

  if (visualKey.startsWith('accent.')) {
    const color = ACCENT_COLORS[visualKey] || '#14B8A6';
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: dark ? '#1F2937' : '#F0FDFA',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: size * 0.45, height: size * 0.45, borderRadius: size * 0.22, backgroundColor: color }} />
      </View>
    );
  }

  if (visualKey.startsWith('bg.')) {
    const bg = BACKGROUND_PALETTES[visualKey] || BACKGROUND_PALETTES['bg.calm_navy'];
    return (
      <View style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden' }}>
        <View style={{ flex: 1, backgroundColor: dark ? bg.darkTop : bg.top }} />
        <View style={{ flex: 1, backgroundColor: dark ? bg.darkMid : bg.mid }} />
        <View style={{ flex: 1, backgroundColor: dark ? bg.darkBottom : bg.bottom }} />
      </View>
    );
  }

  if (visualKey.startsWith('pose.') || visualKey.startsWith('accessory.')) {
    const poseKey = visualKey.startsWith('pose.') ? visualKey : null;
    const accessoryKey = visualKey.startsWith('accessory.') ? visualKey : null;
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: dark ? '#1F2937' : '#F0FDFA',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MediCompanionFigure
          preview
          size={size * 0.85}
          poseKey={poseKey}
          accessoryKey={accessoryKey}
          accentColor="#14B8A6"
          stage="STAGE_3"
        />
      </View>
    );
  }

  if (visualKey.startsWith('decor.')) {
    const color = '#14B8A6';
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: dark ? '#1F2937' : '#ECFDF5',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: color,
          opacity: 0.9,
        }}
      >
        <View
          style={{
            width: size * 0.35,
            height: size * 0.45,
            borderRadius: 4,
            backgroundColor: color,
            opacity: slot === 'decoration' ? 0.7 : 0.5,
          }}
        />
      </View>
    );
  }

  return <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: '#374151' }} />;
}
