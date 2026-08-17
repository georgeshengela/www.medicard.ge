import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { PHARMACY_SOURCES } from '@/constants/pharmacyVisuals';
import { sourceColor, sourceLabel } from '@/lib/pharmacyCompare';
import { useThemeColors } from '@/theme/colors';

type Props = {
  sourceId: string;
  logoUrl?: string | null;
  size?: number;
  showFallbackText?: boolean;
};

export function PharmacySourceLogo({ sourceId, logoUrl, size = 22, showFallbackText = true }: Props) {
  const colors = useThemeColors();
  const [failed, setFailed] = useState(false);
  const meta = PHARMACY_SOURCES.find((s) => s.id === sourceId);
  const uri = logoUrl ?? meta?.logoUrl ?? null;
  const accent = sourceColor(sourceId);
  const label = sourceLabel(sourceId);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    );
  }

  if (!showFallbackText) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 4,
          backgroundColor: `${accent}18`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: Math.max(8, size * 0.34), fontWeight: '800', color: accent }}>
          {label.slice(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <Text style={{ fontSize: Math.max(9, size * 0.42), fontWeight: '700', color: accent }} numberOfLines={1}>
      {label}
    </Text>
  );
}
