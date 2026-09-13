import React from 'react';
import { Image, View } from 'react-native';
import { MEDI_WORLD_ART } from '@/lib/mediWorld/art';

export function WorldMediPortrait({
  size = 168,
  accessibilityLabel = 'მედი',
}: {
  size?: number;
  accessibilityLabel?: string;
}) {
  return (
    <Image
      source={MEDI_WORLD_ART.stitchMedi}
      accessibilityLabel={accessibilityLabel}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}

export function WorldMediMark({ size = 48 }: { size?: number }) {
  return (
    <View pointerEvents="none" accessible={false}>
      <Image source={MEDI_WORLD_ART.mediCanonical} resizeMode="contain" style={{ width: size, height: size }} />
    </View>
  );
}
