import React from 'react';
import { Text, View } from 'react-native';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { BrandWordmark } from '@/components/ui/BrandWordmark';
import { FIGMA_AUTH } from '@/constants/figmaAuthLayout';
import { ka } from '@/i18n/ka';

type Props = {
  subtitle: string;
  compact?: boolean;
};

/** Nightingale auth hero — plain teal mark, wordmark, subtitle (no tile). */
export function AuthBrandHeader({ subtitle, compact }: Props) {
  const logoSize = compact ? 88 : FIGMA_AUTH.heroLogoSize;

  return (
    <View
      className="items-center"
      style={{ marginBottom: compact ? 24 : FIGMA_AUTH.heroBottom }}
    >
      <BrandLogo size={logoSize} variant="plain" />
      <BrandWordmark
        size={compact ? 28 : 38}
        style={{ marginTop: compact ? 14 : 20 }}
      />
      <Text
        className="max-w-[320px] text-center font-sans text-text-200"
        style={{
          marginTop: FIGMA_AUTH.heroGap,
          fontSize: FIGMA_AUTH.heroSubtitleSize,
          lineHeight: 22,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}
